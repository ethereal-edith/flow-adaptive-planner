// Master Deterministic Planning Engine for Flow — Adaptive Planner
// Separated cleanly to allow future porting to Django REST API if needed.

import { calculateTaskScore, getTimeOfDayScore } from './scoring.js';
import { checkScheduleReality } from './realityCheck.js';

/**
 * Parses time string "HH:MM" into minutes from midnight
 */
export function timeStringToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Formats minutes from midnight into "HH:MM"
 */
export function minutesToTimeString(minutes) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hrs = Math.floor(m / 60).toString().padStart(2, '0');
  const mins = (m % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}`;
}

/**
 * Extracts free discretionary windows for a given date between wake and sleep
 * after subtracting all fixed calendar events (the rigid skeleton).
 *
 * A calendar event counts as "fixed" (protected) unless it's explicitly
 * tagged origin: 'adaptive'. This matches the data model where Google-synced
 * events and manually added commitments both default to origin: 'committed'.
 */
export function calculateFreeWindows({ dateStr, calendarEvents = [], preferences = {}, now = new Date() }) {
  const wakeMin = timeStringToMinutes(preferences.wake_time || '08:00');
  const sleepMin = timeStringToMinutes(preferences.sleep_time || '23:30');

  // If we're building today's windows, never offer a slot that's already in
  // the past — start from whichever is later: configured wake time, or the
  // actual current clock time. Future dates always start from wake time.
  const isToday = dateStr === now.toISOString().split('T')[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const effectiveStartMin = isToday ? Math.max(wakeMin, nowMin) : wakeMin;

  // Filter fixed events for this specific date
  const dayEvents = calendarEvents
    .filter(evt => {
      if (!evt.start_time) return false;
      if (evt.origin === 'adaptive') return false; // adaptive tasks aren't protected
      const evtDate = new Date(evt.start_time).toISOString().split('T')[0];
      return evtDate === dateStr;
    })
    .map(evt => {
      const start = new Date(evt.start_time);
      const end = new Date(evt.end_time);
      return {
        id: evt.id,
        title: evt.title,
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: end.getHours() * 60 + end.getMinutes(),
        category: evt.category
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Derive non-overlapping free intervals between effectiveStartMin and sleep
  const freeWindows = [];
  let currentPointer = effectiveStartMin;

  for (const evt of dayEvents) {
    // Skip (or clip) any event that's already fully in the past relative to
    // our effective start — nothing to protect there anymore today.
    if (evt.endMin <= currentPointer) continue;

    if (evt.startMin > currentPointer) {
      const windowDuration = evt.startMin - currentPointer;
      if (windowDuration >= 20) { // Minimum useful block is 20 minutes
        freeWindows.push({
          startMin: currentPointer,
          endMin: evt.startMin,
          durationMin: windowDuration,
          startTimeStr: minutesToTimeString(currentPointer),
          endTimeStr: minutesToTimeString(evt.startMin)
        });
      }
    }
    currentPointer = Math.max(currentPointer, evt.endMin);
  }

  // Final window before sleep
  if (sleepMin > currentPointer) {
    const windowDuration = sleepMin - currentPointer;
    if (windowDuration >= 20) {
      freeWindows.push({
        startMin: currentPointer,
        endMin: sleepMin,
        durationMin: windowDuration,
        startTimeStr: minutesToTimeString(currentPointer),
        endTimeStr: minutesToTimeString(sleepMin)
      });
    }
  }

  const totalFreeMinutes = freeWindows.reduce((acc, w) => acc + w.durationMin, 0);

  return {
    freeWindows,
    totalFreeMinutes,
    fixedEvents: dayEvents
  };
}

/**
 * Core Deterministic Scheduler
 * Allocates candidate tasks into available free windows based on capacity,
 * cognitive load match, urgency, importance, and time preferences.
 */
export function generateAdaptiveSchedule({
  tasks = [],
  calendarEvents = [],
  dailyState = {},
  preferences = {},
  currentDate = new Date(),
  trigger = 'initial_plan'
}) {
  const dateStr = currentDate.toISOString().split('T')[0];
  const { freeWindows, totalFreeMinutes, fixedEvents } = calculateFreeWindows({
    dateStr,
    calendarEvents,
    preferences,
    now: currentDate
  });

  const bufferMinutes = preferences.buffer_minutes || 15;
  const energy = dailyState.energy ?? 3;
  const stress = dailyState.stress ?? 3;

  // Filter pending / in_progress tasks
  const eligibleTasks = tasks.filter(t => t.status !== 'completed');

  // Score all tasks
  const scoredTasks = eligibleTasks.map(task => {
    const scoreResult = calculateTaskScore(task, dailyState, currentDate, {
      categoryMultipliers: preferences.category_multipliers || {}
    });
    return {
      ...task,
      ...scoreResult
    };
  });

  // Sort tasks by priority score descending
  scoredTasks.sort((a, b) => b.score - a.score);

  const scheduledToday = [];
  const postponedTasks = [];
  const decisionLogs = [];

  // Track windows and remaining capacity
  const windowSlots = freeWindows.map(w => ({ ...w, currentMin: w.startMin }));

  // Rule of thumb: If energy is low (1 or 2), prohibit heavy cognitive tasks (load >= 4) from today's plan
  // Move them explicitly to tomorrow with reason
  for (const task of scoredTasks) {
    const cogLoad = task.cognitive_load || 3;
    const taskDuration = task.adjustedDuration || task.estimated_duration || 30;

    if (energy <= 2 && cogLoad >= 4 && task.flexibility !== 'fixed') {
      postponedTasks.push({
        ...task,
        status: 'postponed',
        postponed_count: (task.postponed_count || 0) + 1,
        postpone_reason: `Energy is low (${energy}/5). High cognitive load (${cogLoad}/5) requires a rested focus block; moved to tomorrow.`
      });
      decisionLogs.push({
        taskId: task.id,
        title: task.title,
        action: 'postponed',
        reason: `Cognitive load (${cogLoad}/5) is too heavy for energy state (${energy}/5).`
      });
      continue;
    }

    // Try to find a fitting window for this task
    let placed = false;

    for (const slot of windowSlots) {
      const remainingTime = slot.endMin - slot.currentMin;
      if (remainingTime >= taskDuration) {
        const startMin = slot.currentMin;
        const endMin = startMin + taskDuration;

        const startTimeStr = minutesToTimeString(startMin);
        const endTimeStr = minutesToTimeString(endMin);

        // Calculate ISO date strings
        const startIso = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
        const endIso = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();

        scheduledToday.push({
          ...task,
          scheduled_start: startIso,
          scheduled_end: endIso,
          startTimeStr,
          endTimeStr,
          status: task.status === 'in_progress' ? 'in_progress' : 'pending'
        });

        decisionLogs.push({
          taskId: task.id,
          title: task.title,
          action: 'scheduled',
          reason: `Fitted in ${startTimeStr} - ${endTimeStr}. ${task.reasons?.[0] || 'Matches available window'}`
        });

        // Advance slot pointer plus buffer
        slot.currentMin = endMin + bufferMinutes;
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Could not fit in available free windows
      postponedTasks.push({
        ...task,
        status: 'postponed',
        postponed_count: (task.postponed_count || 0) + 1,
        postpone_reason: `Available windows for today are exhausted (${totalFreeMinutes}m total). Moved to next cycle.`
      });
      decisionLogs.push({
        taskId: task.id,
        title: task.title,
        action: 'postponed',
        reason: 'Exceeds available time slots today without encroaching on protected sleep/commitments.'
      });
    }
  }

  // Reality check diagnostic
  const reality = checkScheduleReality({
    scheduledTasks: scheduledToday,
    availableMinutes: totalFreeMinutes,
    bufferMinutes
  });

  // Plain-spoken explanation of the decision
  let plainExplanation = '';
  if (energy <= 2) {
    plainExplanation = `Current energy is drained (${energy}/5). Heavy cognitive tasks (${postponedTasks.filter(t => t.cognitive_load >= 4).map(t => t.title).join(', ') || 'deep focus items'}) have been deferred to tomorrow's focus window. Today is populated with manageable, lower-friction tasks.`;
  } else if (energy >= 4) {
    plainExplanation = `Energy is strong (${energy}/5). High-focus tasks have been prioritized into today's primary focus windows before fatigue sets in.`;
  } else {
    plainExplanation = `Balanced schedule generated for normal energy (${energy}/5). Tasks aligned according to deadline urgency and available free slots.`;
  }

  if (reality.isUnrealistic) {
    plainExplanation += ` Note: ${reality.warning}`;
  }

  const decisionRecord = {
    id: `dec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger,
    available_minutes: totalFreeMinutes,
    scheduled_minutes: scheduledToday.reduce((a, b) => a + (b.adjustedDuration || b.estimated_duration || 0), 0),
    is_unrealistic: reality.isUnrealistic,
    reality_warning: reality.warning,
    changes_json: decisionLogs,
    plain_explanation: plainExplanation
  };

  return {
    scheduledToday,
    postponedTasks,
    fixedEvents,
    freeWindows,
    totalFreeMinutes,
    reality,
    decisionRecord
  };
}

/**
 * Adaptive Rescheduling: Recalculates when a task was missed, duration exceeded, or energy shifted.
 */
export function handleAdaptiveReschedule({
  missedTaskId,
  tasks = [],
  calendarEvents = [],
  dailyState = {},
  preferences = {},
  reason = 'Task missed / fell behind schedule'
}) {
  const updatedTasks = tasks.map(t => {
    if (t.id === missedTaskId) {
      return {
        ...t,
        postponed_count: (t.postponed_count || 0) + 1,
        postpone_reason: reason
      };
    }
    return t;
  });

  return generateAdaptiveSchedule({
    tasks: updatedTasks,
    calendarEvents,
    dailyState,
    preferences,
    trigger: 'missed_task'
  });
}