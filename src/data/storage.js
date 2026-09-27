// Supabase persistence layer with a one-time localStorage import path.
import { createClient } from '@supabase/supabase-js';
import { INITIAL_DAILY_STATE, INITIAL_USER_PREFERENCES } from './initialData.js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LEGACY_KEYS = {
  TASKS: 'flow_tasks',
  CALENDAR: 'flow_calendar_events',
  DAILY_STATE: 'flow_daily_state',
  PREFERENCES: 'flow_preferences',
  DECISIONS: 'flow_decisions',
  OUTCOMES: 'flow_outcomes',
  SUPABASE_CONFIG: 'flow_supabase_config',
  GEMINI_API_KEY: 'flow_gemini_api_key',
  DATA_VERSION: 'flow_data_version'
};

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('You must be signed in to access Flow data.');
  return user.id;
}

function throwOnError(result, message) {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  return result.data;
}

function withoutUserId(row) {
  const copy = { ...row };
  delete copy.user_id;
  return copy;
}

function parseLegacyValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function hasLegacyData() {
  if (typeof localStorage === 'undefined') return false;
  return Object.values(LEGACY_KEYS)
    .filter((key) => ![LEGACY_KEYS.DATA_VERSION, LEGACY_KEYS.SUPABASE_CONFIG, LEGACY_KEYS.GEMINI_API_KEY].includes(key))
    .some((key) => localStorage.getItem(key));
}

export function discardLegacyData() {
  if (typeof localStorage === 'undefined') return;
  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function migrateDataIfNeeded() {
  // Kept as a compatibility no-op. Legacy data is imported after login.
}

export async function importLegacyData() {
  if (!hasLegacyData()) return;

  const tasks = parseLegacyValue(LEGACY_KEYS.TASKS, []);
  const calendarEvents = parseLegacyValue(LEGACY_KEYS.CALENDAR, []);
  const dailyState = parseLegacyValue(LEGACY_KEYS.DAILY_STATE, INITIAL_DAILY_STATE);
  const preferences = parseLegacyValue(LEGACY_KEYS.PREFERENCES, INITIAL_USER_PREFERENCES);
  const decisions = parseLegacyValue(LEGACY_KEYS.DECISIONS, []);
  const outcomes = parseLegacyValue(LEGACY_KEYS.OUTCOMES, []);

  await saveTasks(tasks);
  await saveCalendarEvents(calendarEvents);
  await saveDailyState(dailyState);
  await savePreferences(preferences);
  await Promise.all(decisions.map((decision) => saveSchedulingDecision(decision)));
  await Promise.all(outcomes.map((outcome) => recordTaskOutcome(outcome)));
  discardLegacyData();
}

export function getGeminiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function getSupabaseClient() {
  return supabase;
}

export async function ensureUserProfile() {
  const client = requireClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to initialize Flow.');

  throwOnError(
    await client.from('users').upsert({ id: user.id, email: user.email }, { onConflict: 'id' }),
    'Could not initialize user profile'
  );
  return { preferences: await loadPreferences(), dailyState: await loadDailyState() };
}

export async function loadTasks() {
  const userId = await currentUserId();
  const result = await requireClient().from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return (throwOnError(result, 'Failed to load tasks') || []).map(withoutUserId);
}

export async function saveTasks(tasks) {
  const client = requireClient();
  const userId = await currentUserId();
  const existing = throwOnError(await client.from('tasks').select('id').eq('user_id', userId), 'Failed to inspect tasks') || [];
  await Promise.all(existing.filter((row) => !tasks.some((task) => task.id === row.id)).map((row) =>
    throwOnError(client.from('tasks').delete().eq('user_id', userId).eq('id', row.id), 'Failed to delete task')
  ));

  if (tasks.length) {
    const rows = tasks.map((task) => {
      const row = { ...task, user_id: userId, origin: task.origin || 'adaptive' };
      delete row.adjustedDuration;
      delete row.reasons;
      delete row.suitabilityScore;
      return row;
    });
    throwOnError(await client.from('tasks').upsert(rows), 'Failed to save tasks');
  }
}

export async function loadCalendarEvents() {
  const userId = await currentUserId();
  const result = await requireClient().from('calendar_events').select('*').eq('user_id', userId).order('start_time');
  return (throwOnError(result, 'Failed to load calendar events') || []).map(withoutUserId);
}

export async function saveCalendarEvents(events) {
  const client = requireClient();
  const userId = await currentUserId();
  const existing = throwOnError(await client.from('calendar_events').select('id').eq('user_id', userId), 'Failed to inspect calendar events') || [];
  await Promise.all(existing.filter((row) => !events.some((event) => event.id === row.id)).map((row) =>
    throwOnError(client.from('calendar_events').delete().eq('user_id', userId).eq('id', row.id), 'Failed to delete calendar event')
  ));

  if (events.length) {
    const rows = events.map((event) => ({ ...event, user_id: userId }));
    throwOnError(await client.from('calendar_events').upsert(rows), 'Failed to save calendar events');
  }
}

export async function loadDailyState() {
  const userId = await currentUserId();
  const result = await requireClient().from('daily_states').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1);
  const rows = throwOnError(result, 'Failed to load daily state') || [];
  if (!rows[0]) return { ...INITIAL_DAILY_STATE };
  return withoutUserId(rows[0]);
}

export async function saveDailyState(state) {
  const userId = await currentUserId();
  throwOnError(await requireClient().from('daily_states').upsert({ ...state, user_id: userId }, { onConflict: 'id' }), 'Failed to save daily state');
}

export async function loadPreferences() {
  const userId = await currentUserId();
  const result = await requireClient().from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  const row = throwOnError(result, 'Failed to load preferences');
  if (!row) return { ...INITIAL_USER_PREFERENCES };
  return withoutUserId(row);
}

export async function savePreferences(preferences) {
  const userId = await currentUserId();
  throwOnError(await requireClient().from('user_preferences').upsert({ ...preferences, user_id: userId }, { onConflict: 'user_id' }), 'Failed to save preferences');
}

export async function loadSchedulingDecisions() {
  const userId = await currentUserId();
  const result = await requireClient().from('scheduling_decisions').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
  return (throwOnError(result, 'Failed to load scheduling decisions') || []).map(withoutUserId);
}

export async function saveSchedulingDecision(decision) {
  const userId = await currentUserId();
  throwOnError(await requireClient().from('scheduling_decisions').upsert({ ...decision, user_id: userId }), 'Failed to save scheduling decision');
}

export async function loadTaskOutcomes() {
  const userId = await currentUserId();
  const result = await requireClient().from('task_outcomes').select('*').eq('user_id', userId).order('completed_at', { ascending: false });
  return (throwOnError(result, 'Failed to load task outcomes') || []).map((row) => {
    const outcome = withoutUserId(row);
    const ratio = outcome.duration_ratio;
    delete outcome.duration_ratio;
    return { ...outcome, ratio: Number(ratio ?? outcome.ratio ?? 0) };
  });
}

export async function saveTaskOutcomes(outcomes) {
  await Promise.all(outcomes.map((outcome) => recordTaskOutcome(outcome)));
}

export async function recordTaskOutcome(outcome) {
  const userId = await currentUserId();
  const row = { ...outcome, user_id: undefined };
  delete row.ratio;
  delete row.user_id;
  throwOnError(await requireClient().from('task_outcomes').upsert({ ...row, user_id: userId }), 'Failed to save task outcome');
}

export async function resetToSeedData() {
  const client = requireClient();
  const userId = await currentUserId();
  for (const table of ['tasks', 'calendar_events', 'scheduling_decisions', 'task_outcomes', 'daily_states']) {
    throwOnError(await client.from(table).delete().eq('user_id', userId), `Failed to reset ${table}`);
  }
  await saveDailyState(INITIAL_DAILY_STATE);
  await savePreferences(INITIAL_USER_PREFERENCES);
}
