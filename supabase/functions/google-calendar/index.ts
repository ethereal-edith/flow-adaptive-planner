import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_API_URL = 'https://www.googleapis.com/calendar/v3';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization header.');

  const authClient = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new Error('Invalid Supabase session.');
  return user;
}

function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SB_SERVICE_ROLE_KEY'));
}

async function refreshAccessTokenIfNeeded(userId: string) {
  const admin = adminClient();
  const { data: token, error } = await admin
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!token) throw new Error('Google Calendar is not connected.');

  const expiresAt = new Date(token.expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) return token.access_token;

  const body = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token'
  });
  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const refreshed = await refreshResponse.json();
  if (!refreshResponse.ok) throw new Error(refreshed.error_description || 'Google token refresh failed.');

  const updated = {
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
    token_type: refreshed.token_type || token.token_type,
    scope: refreshed.scope || token.scope,
    updated_at: new Date().toISOString()
  };
  const { error: updateError } = await admin.from('user_google_tokens').update(updated).eq('user_id', userId);
  if (updateError) throw updateError;
  return updated.access_token;
}

async function googleRequest(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`${GOOGLE_API_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const googleResponse = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await googleResponse.json();
  if (!googleResponse.ok) throw new Error(data.error?.message || 'Google Calendar request failed.');
  return data;
}

async function exchangeCode(userId: string, code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(token.error_description || 'Google authorization exchange failed.');

  const { data: existingToken } = await adminClient()
    .from('user_google_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await adminClient().from('user_google_tokens').upsert({
    user_id: userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token || existingToken?.refresh_token,
    expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    token_type: token.token_type || 'Bearer',
    scope: token.scope || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) throw error;
  return { connected: true };
}

async function listCalendars(userId: string) {
  const accessToken = await refreshAccessTokenIfNeeded(userId);
  const calendars = [];
  let pageToken = '';
  do {
    const data = await googleRequest('/users/me/calendarList', accessToken, {
      maxResults: '250',
      ...(pageToken ? { pageToken } : {})
    });
    calendars.push(...(data.items || []).map((calendar: any) => ({
      id: calendar.id,
      name: calendar.summary || calendar.id,
      color: calendar.backgroundColor || '#8E8E93',
      primary: Boolean(calendar.primary)
    })));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return { calendars };
}

function eventTimes(event: any) {
  if (event.start?.dateTime) {
    return { start_time: new Date(event.start.dateTime).toISOString(), end_time: new Date(event.end.dateTime).toISOString() };
  }
  const start = new Date(`${event.start.date}T00:00:00Z`);
  const end = new Date(`${event.end.date}T00:00:00Z`);
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}

async function syncEvents(userId: string, calendarIds: string[], timeMin: string, timeMax: string) {
  const accessToken = await refreshAccessTokenIfNeeded(userId);
  const admin = adminClient();
  let syncedCount = 0;

  const { data: existingGoogleEvents, error: existingError } = await admin
    .from('calendar_events')
    .select('id, google_calendar_id')
    .eq('user_id', userId)
    .eq('source', 'google');
  if (existingError) throw existingError;
  await Promise.all((existingGoogleEvents || [])
    .filter((event: any) => !calendarIds.includes(event.google_calendar_id))
    .map((event: any) => admin.from('calendar_events').delete().eq('id', event.id).eq('user_id', userId)));

  for (const calendarId of calendarIds) {
    const events = [];
    let pageToken = '';
    do {
      const data = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        showDeleted: 'true',
        maxResults: '2500',
        ...(pageToken ? { pageToken } : {})
      });
      events.push(...(data.items || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    const activeRows = events
      .filter((event: any) => event.status !== 'cancelled' && event.start && event.end)
      .map((event: any) => ({
        id: `google-${calendarId}-${event.id}`,
        user_id: userId,
        title: event.summary || '(Untitled event)',
        ...eventTimes(event),
        origin: 'committed',
        source: 'google',
        google_event_id: event.id,
        google_calendar_id: calendarId,
        category: 'other',
        is_fixed: true,
        location: event.location || null
      }));

    const { error: deleteError } = await admin
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'google')
      .eq('google_calendar_id', calendarId);
    if (deleteError) throw deleteError;

    if (activeRows.length) {
      const { error: upsertError } = await admin
        .from('calendar_events')
        .upsert(activeRows, { onConflict: 'user_id,google_event_id' });
      if (upsertError) throw upsertError;
      syncedCount += activeRows.length;
    }
  }

  return { synced_count: syncedCount };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(request);
    const body = await request.json();
    switch (body.action) {
      case 'exchange_code':
        return response(await exchangeCode(user.id, body.code, body.redirect_uri));
      case 'list_calendars':
        return response(await listCalendars(user.id));
      case 'sync_events':
        return response(await syncEvents(user.id, body.calendar_ids || [], body.time_min, body.time_max));
      default:
        return response({ error: 'Unknown action.' }, 400);
    }
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Google Calendar request failed.' }, 400);
  }
});
