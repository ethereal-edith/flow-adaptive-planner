// Default starting state for new users — clean slate, no sample data.
// Preferences and a neutral daily state are set; everything else starts empty.

const todayStr = new Date().toISOString().split('T')[0];

export const INITIAL_USER_PREFERENCES = {
  wake_time: '08:00',
  sleep_time: '23:30',
  buffer_minutes: 15,
  max_high_focus_blocks_per_day: 2,
  google_calendar_ids: [],
  category_multipliers: {
    coding: 1.40,
    coursework: 1.25,
    admin: 1.15,
    chores: 0.95,
    language: 1.10,
    personal: 1.00,
  }
};

export const INITIAL_DAILY_STATE = {
  id: 'state-today',
  date: todayStr,
  energy: 3,
  stress: 3,
  available_time_minutes: 480,
  note: '',
  updated_at: new Date().toISOString()
};

// New users start with no calendar events
export const INITIAL_CALENDAR_EVENTS = [];

// New users start with no tasks
export const INITIAL_TASKS = [];

// New users start with no completion history
export const INITIAL_TASK_OUTCOMES = [];

export const INITIAL_SCHEDULING_DECISION = {
  id: 'dec-initial',
  timestamp: new Date().toISOString(),
  trigger: 'initial_plan',
  available_minutes: 0,
  scheduled_minutes: 0,
  is_unrealistic: false,
  reality_warning: null,
  plain_explanation: 'No tasks or events yet. Add some tasks to get started.',
  changes_json: []
};
