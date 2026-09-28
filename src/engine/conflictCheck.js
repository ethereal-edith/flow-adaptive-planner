// ============================================================================
// Flow Adaptive Planner — Schedule Conflict Check
// ============================================================================
// Defense-in-depth: calculateFreeWindows() in planningEngine.js is supposed
// to make an overlap impossible by construction, but this gives Ask Flow an
// explicit "check-in" step that verifies the plan it's about to apply never
// actually collides with a locked commitment (class, meeting, anything
// origin: 'committed') — instead of silently trusting the math.
//
// Common real causes of a collision even when the engine logic is correct:
//   - The calendar sync hadn't pulled in a class/event yet when the plan
//     was generated (stale calendarEvents).
//   - A manually-added committed event overlaps another committed event
//     (two "fixed" things at once — the engine can't move either).
//   - A task carried over from a previous plan still has an old
//     scheduled_start/scheduled_end that's now stale.
// ============================================================================

import { timeStringToMinutes } from './planningEngine.js';

/**
 * @param {Array} scheduledTasks - result.scheduledToday from generateAdaptiveSchedule
 *   (each has startTimeStr / endTimeStr, "HH:MM")
 * @param {Array} fixedEvents - result.fixedEvents from generateAdaptiveSchedule
 *   (each has startMin / endMin, minutes since midnight)
 * @returns {Array} conflicts, each shaped as:
 *   { taskId, taskTitle, taskRange, eventTitle, eventRange }
 */
export function detectScheduleConflicts({ scheduledTasks = [], fixedEvents = [] } = {}) {
  const conflicts = [];

  for (const task of scheduledTasks) {
    if (!task.startTimeStr || !task.endTimeStr) continue;
    const taskStart = timeStringToMinutes(task.startTimeStr);
    const taskEnd = timeStringToMinutes(task.endTimeStr);

    for (const evt of fixedEvents) {
      const overlaps = taskStart < evt.endMin && taskEnd > evt.startMin;
      if (overlaps) {
        conflicts.push({
          taskId: task.id,
          taskTitle: task.title,
          taskRange: `${task.startTimeStr}–${task.endTimeStr}`,
          eventTitle: evt.title,
          eventRange: `${minutesToHHMM(evt.startMin)}–${minutesToHHMM(evt.endMin)}`
        });
      }
    }
  }

  return conflicts;
}

function minutesToHHMM(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = Math.round(minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * One short, plain-language line summarizing the conflicts, suitable for a
 * check-in banner shown before the person applies an AI-generated plan.
 */
export function explainConflicts(conflicts = []) {
  if (conflicts.length === 0) return null;
  if (conflicts.length === 1) {
    const c = conflicts[0];
    return `"${c.taskTitle}" (${c.taskRange}) overlaps your locked "${c.eventTitle}" (${c.eventRange}). This plan hasn't been applied — review before continuing.`;
  }
  return `${conflicts.length} scheduled tasks overlap locked commitments (e.g. "${conflicts[0].taskTitle}" vs "${conflicts[0].eventTitle}"). This plan hasn't been applied — review before continuing.`;
}