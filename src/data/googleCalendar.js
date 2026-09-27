import { getSupabaseClient } from './storage';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_STATE_KEY = 'flow_google_oauth_state';

function redirectUri() {
  return `${window.location.origin}/oauth/google/callback`;
}

async function invoke(action, payload = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');
  const { data, error } = await client.functions.invoke('google-calendar', {
    body: { action, ...payload }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function isGoogleCalendarConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

export function beginGoogleCalendarConnect() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Set VITE_GOOGLE_CLIENT_ID before connecting Google Calendar.');

  const state = crypto.randomUUID();
  sessionStorage.setItem(GOOGLE_STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPE,
    state
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function completeGoogleCalendarConnect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const expectedState = sessionStorage.getItem(GOOGLE_STATE_KEY);
  if (!expectedState || expectedState !== params.get('state')) {
    throw new Error('Google OAuth state validation failed. Please try connecting again.');
  }
  sessionStorage.removeItem(GOOGLE_STATE_KEY);
  await invoke('exchange_code', { code, redirect_uri: redirectUri() });
  return invoke('list_calendars');
}

export async function loadGoogleCalendars() {
  return invoke('list_calendars');
}

export async function syncGoogleCalendar(calendarIds) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return invoke('sync_events', {
    calendar_ids: calendarIds,
    time_min: start.toISOString(),
    time_max: end.toISOString()
  });
}
