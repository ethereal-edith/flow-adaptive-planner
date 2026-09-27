// Reality check engine: Plain, direct calculations of time budgets without patronizing cheerleading.

/**
 * Checks schedule feasibility against available discretionary time.
 * Returns direct diagnostic object.
 */
export function checkScheduleReality({ scheduledTasks = [], availableMinutes = 300, bufferMinutes = 15 }) {
  const taskCount = scheduledTasks.length;
  const rawTaskMinutes = scheduledTasks.reduce((acc, t) => acc + (t.adjustedDuration || t.estimated_duration || 0), 0);
  const totalBufferMinutes = Math.max(0, taskCount - 1) * bufferMinutes;
  const totalRequiredMinutes = rawTaskMinutes + totalBufferMinutes;

  const deficitMinutes = totalRequiredMinutes - availableMinutes;
  const isUnrealistic = deficitMinutes > 0;

  const availableHours = (availableMinutes / 60).toFixed(1).replace('.0', '');
  const requiredHours = (totalRequiredMinutes / 60).toFixed(1).replace('.0', '');
  const deficitHours = (deficitMinutes / 60).toFixed(1).replace('.0', '');

  let warning = null;
  let severity = 'normal'; // normal | tight | overbooked | impossible

  if (deficitMinutes > 120) {
    severity = 'impossible';
    warning = `Severely overbooked: You have ${availableHours}h available but ${requiredHours}h scheduled. You are ${deficitHours}h over capacity. Lower-priority or high-load tasks must be moved.`;
  } else if (deficitMinutes > 0) {
    severity = 'overbooked';
    warning = `Unrealistic schedule: You have ${availableHours} hours available but ${requiredHours} hours scheduled (${deficitMinutes} min deficit). At least one flexible task needs to move.`;
  } else if (availableMinutes - totalRequiredMinutes < 30 && taskCount > 0) {
    severity = 'tight';
    warning = `Zero buffer: Schedule uses ${requiredHours}h of your ${availableHours}h. Any unexpected delay will derail the rest of the day.`;
  }

  return {
    isUnrealistic,
    severity,
    rawTaskMinutes,
    totalBufferMinutes,
    totalRequiredMinutes,
    availableMinutes,
    deficitMinutes: Math.max(0, deficitMinutes),
    surplusMinutes: Math.max(0, availableMinutes - totalRequiredMinutes),
    warning,
    availableHours,
    requiredHours
  };
}

/**
 * Generates direct recommendations on which tasks to postpone or split when overbooked.
 */
export function suggestCutbacks(scoredTasks, deficitMinutes) {
  // Sort by lowest score ascending (least suitable to do right now)
  const flexibleOnly = scoredTasks.filter(t => t.flexibility !== 'fixed');
  let accumulatedReduction = 0;
  const recommendedCuts = [];

  for (const t of flexibleOnly) {
    if (accumulatedReduction >= deficitMinutes) break;
    const duration = t.adjustedDuration || t.estimated_duration || 0;
    accumulatedReduction += duration;
    recommendedCuts.push({
      taskId: t.id || t.taskId,
      title: t.title || t.taskTitle,
      savedMinutes: duration,
      reason: t.reasons ? t.reasons[0] : 'Lower priority relative to deadlines and capacity'
    });
  }

  return {
    recommendedCuts,
    accumulatedReduction,
    canResolve: accumulatedReduction >= deficitMinutes
  };
}
