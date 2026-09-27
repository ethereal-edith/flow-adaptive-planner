// ============================================================================
// Flow Adaptive Planner — Pure Deterministic Planning Module
// ============================================================================
// Architectural Rule:
// Zero LLM intuition in scheduling. All constraint satisfaction, scoring,
// conflict detection, and slot allocation are 100% deterministic code.
// Portable to Python / Django REST API.
// ============================================================================

/**
 * Converts "HH:MM" string to minutes from midnight
 * @param {string} timeStr - e.g. "08:30"
 * @returns {number}
 */
export function time_string_to_minutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts minutes from midnight to "HH:MM"
 * @param {number} minutes
 * @returns {string}
 */
export function minutes_to_time_string(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hrs = Math.floor(clamped / 60).toString().padStart(2, '0');
  const mins = (clamped % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}`;
}

// ----------------------------------------------------------------------------
// 1. calculate_urgency(task, currentTime)
// Evaluates deadline proximity and overdue status deterministically.
// ----------------------------------------------------------------------------
export function calculate_urgency(task, currentTime = new Date()) {
  if (!task.deadline) {
    return {
      urgencyScore: 5,
      isOverdue: false,
      hoursRemaining: null,
      reason: 'No hard deadline specified'
    };
  }

  const deadlineDate = new Date(task.deadline);
  const now = new Date(currentTime);
  const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining < 0) {
    const overdueHours = Math.abs(Math.round(hoursRemaining));
    return {
      urgencyScore: 120,
      isOverdue: true,
      hoursRemaining,
      reason: `Overdue by ${overdueHours} hours (Critical priority)`
    };
  }

  if (hoursRemaining <= 12) {
    return {
      urgencyScore: 90,
      isOverdue: false,
      hoursRemaining,
      reason: `Imminent deadline: due in ${Math.round(hoursRemaining)} hours`
    };
  }

  if (hoursRemaining <= 24) {
    return {
      urgencyScore: 70,
      isOverdue: false,
      hoursRemaining,
      reason: 'Due within 24 hours'
    };
  }

  if (hoursRemaining <= 48) {
    return {
      urgencyScore: 45,
      isOverdue: false,
      hoursRemaining,
      reason: 'Due within 48 hours'
    };
  }

  if (hoursRemaining <= 96) {
    return {
      urgencyScore: 25,
      isOverdue: false,
      hoursRemaining,
      reason: 'Due in 2 to 4 days'
    };
  }

  return {
    urgencyScore: 10,
    isOverdue: false,
    hoursRemaining,
    reason: 'Due later in the week'
  };
}

// ----------------------------------------------------------------------------
// 2. calculate_energy_match(task_cognitive_load, user_energy, user_stress)
// Evaluates compatibility between task difficulty and user capacity.
// Core rule: High load tasks are prohibited when energy is depleted.
// ----------------------------------------------------------------------------
export function calculate_energy_match(cognitiveLoad = 3, userEnergy = 3, userStress = 3) {
  const cogLoad = Math.min(5, Math.max(1, Number(cognitiveLoad) || 3));
  const energy = Math.min(5, Math.max(1, Number(userEnergy) || 3));
  const stress = Math.min(5, Math.max(1, Number(userStress) || 3));

  // High stress dampens usable cognitive capacity
  const stressPenalty = stress >= 4 ? 1 : 0;
  const effectiveEnergy = Math.max(1, energy - stressPenalty);

  let matchScore = 0;
  let isCompatible = true;
  let recommendation = '';

  if (effectiveEnergy <= 2) {
    // Low energy / exhausted state
    if (cogLoad >= 4) {
      matchScore = -80;
      isCompatible = false;
      recommendation = `Cognitive load (${cogLoad}/5) exceeds low energy (${effectiveEnergy}/5). Defers to next rested focus window.`;
    } else if (cogLoad <= 2) {
      matchScore = 55;
      isCompatible = true;
      recommendation = `Low cognitive demand (${cogLoad}/5) ideal for low energy state; minimizes initiation friction.`;
    } else {
      matchScore = -10;
      isCompatible = true;
      recommendation = `Moderate cognitive demand (${cogLoad}/5); feasible if broken into smaller steps.`;
    }
  } else if (effectiveEnergy >= 4) {
    // High energy / peak focus state
    if (cogLoad >= 4) {
      matchScore = 65;
      isCompatible = true;
      recommendation = `Capitalizes on high energy (${effectiveEnergy}/5) for deep focus work (${cogLoad}/5).`;
    } else if (cogLoad <= 2) {
      matchScore = -15;
      isCompatible = true;
      recommendation = `Low cognitive load; can be done anytime, so high-focus tasks take precedence.`;
    } else {
      matchScore = 25;
      isCompatible = true;
      recommendation = `Good baseline fit for high energy state.`;
    }
  } else {
    // Moderate baseline energy (3)
    if (cogLoad === 3 || cogLoad === 2) {
      matchScore = 30;
      isCompatible = true;
      recommendation = `Well balanced with standard energy level.`;
    } else if (cogLoad >= 5) {
      matchScore = -20;
      isCompatible = false;
      recommendation = `Heavy focus (${cogLoad}/5) ideally needs peak energy block.`;
    } else {
      matchScore = 15;
      isCompatible = true;
      recommendation = `Gentle task suitable for filling buffer gaps.`;
    }
  }

  return {
    matchScore,
    effectiveEnergy,
    isCompatible,
    recommendation
  };
}

// ----------------------------------------------------------------------------
// 3. calculate_task_suitability(task, daily_state, target_slot, preferences, current_time)
// Composite scoring combining urgency, importance, energy match, duration bias,
// and anti-stall postpone damping.
// ----------------------------------------------------------------------------
export function calculate_task_suitability(
  task,
  dailyState = {},
  targetSlot = null,
  preferences = {},
  currentTime = new Date()
) {
  const energy = dailyState.energy ?? 3;
  const stress = dailyState.stress ?? 3;
  const categoryMultipliers = preferences.category_multipliers || {};

  // 1. Urgency evaluation
  const urgency = calculate_urgency(task, currentTime);

  // 2. Energy match evaluation
  const energyMatch = calculate_energy_match(task.cognitive_load, energy, stress);

  // 3. Importance weighting (1-5 scaled to 12-60)
  const importanceWeight = (task.importance || 3) * 12;

  // 4. Repeated postponement anti-stall bump
  const postponeBump = (task.postponed_count || 0) >= 2 ? (task.postponed_count * 15) : 0;

  // 5. Time-of-day preference match
  let timeOfDayScore = 0;
  if (targetSlot && task.preferred_time_of_day && task.preferred_time_of_day !== 'any') {
    const slotHour = Math.floor(targetSlot.startMin / 60);
    const pref = task.preferred_time_of_day;
    if (slotHour >= 6 && slotHour < 12 && pref === 'morning') timeOfDayScore = 20;
    else if (slotHour >= 12 && slotHour < 18 && pref === 'afternoon') timeOfDayScore = 20;
    else if (slotHour >= 18 && slotHour <= 23 && pref === 'evening') timeOfDayScore = 20;
    else timeOfDayScore = -15;
  }

  // 6. Time blindness duration multiplier
  const multiplier = categoryMultipliers[task.category] || 1.0;
  const adjustedDuration = Math.round((task.estimated_duration || 30) * multiplier);

  // Composite score
  const totalScore = Math.round(
    urgency.urgencyScore +
    importanceWeight +
    energyMatch.matchScore +
    postponeBump +
    timeOfDayScore
  );

  const reasons = [];
  if (urgency.reason) reasons.push(urgency.reason);
  if (energyMatch.recommendation) reasons.push(energyMatch.recommendation);
  if (postponeBump > 0) reasons.push(`Postponed ${task.postponed_count}x: boosted to prevent stalling`);

  return {
    taskId: task.id,
    taskTitle: task.title,
    suitabilityScore: totalScore,
    urgencyScore: urgency.urgencyScore,
    energyMatchScore: energyMatch.matchScore,
    isEnergyCompatible: energyMatch.isCompatible,
    adjustedDuration,
    reasons
  };
}

// ----------------------------------------------------------------------------
// 4. detect_conflicts(startMin, endMin, fixedEvents, scheduledTasks, bufferMin)
// Pure collision detector for schedule bounds and protected skeleton.
// ----------------------------------------------------------------------------
export function detect_conflicts(
  startMin,
  endMin,
  fixedEvents = [],
  scheduledTasks = [],
  bufferMin = 15
) {
  // Check collision with fixed events (rigid skeleton)
  for (const evt of fixedEvents) {
    // If intervals overlap
    if (startMin < evt.endMin && endMin > evt.startMin) {
      return {
        hasConflict: true,
        conflictType: 'fixed_event_overlap',
        conflictingWith: evt.title,
        reason: `Overlaps with protected ${evt.category}: "${evt.title}" (${minutes_to_time_string(evt.startMin)} - ${minutes_to_time_string(evt.endMin)})`
      };
    }
  }

  // Check collision with already scheduled tasks including buffer
  for (const t of scheduledTasks) {
    const tStart = time_string_to_minutes(t.startTimeStr);
    const tEnd = time_string_to_minutes(t.endTimeStr) + bufferMin;
    if (startMin < tEnd && endMin > tStart) {
      return {
        hasConflict: true,
        conflictType: 'task_overlap',
        conflictingWith: t.title,
        reason: `Overlaps with scheduled task "${t.title}" or its required buffer`
      };
    }
  }

  return {
    hasConflict: false,
    conflictType: null,
    conflictingWith: null,
    reason: null
  };
}

// ----------------------------------------------------------------------------
// 5. find_available_blocks(dateStr, calendarEvents, preferences)
// Extracts non-overlapping open windows between wake and sleep
// after strictly subtracting protected fixed commitments.
// ----------------------------------------------------------------------------
export function find_available_blocks(dateStr, calendarEvents = [], preferences = {}) {
  const wakeMin = time_string_to_minutes(preferences.wake_time || '08:00');
  const sleepMin = time_string_to_minutes(preferences.sleep_time || '23:30');

  // Filter fixed events for this target date
  const dayEvents = calendarEvents
    .filter(evt => {
      if (!evt.start_time || !evt.is_fixed) return false;
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
        category: evt.category,
        is_fixed: true
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const availableBlocks = [];
  let currentPointer = wakeMin;

  for (const evt of dayEvents) {
    if (evt.startMin > currentPointer) {
      const durationMin = evt.startMin - currentPointer;
      if (durationMin >= 15) {
        availableBlocks.push({
          startMin: currentPointer,
          endMin: evt.startMin,
          durationMin,
          startTimeStr: minutes_to_time_string(currentPointer),
          endTimeStr: minutes_to_time_string(evt.startMin)
        });
      }
    }
    currentPointer = Math.max(currentPointer, evt.endMin);
  }

  // Window before sleep
  if (sleepMin > currentPointer) {
    const durationMin = sleepMin - currentPointer;
    if (durationMin >= 15) {
      availableBlocks.push({
        startMin: currentPointer,
        endMin: sleepMin,
        durationMin,
        startTimeStr: minutes_to_time_string(currentPointer),
        endTimeStr: minutes_to_time_string(sleepMin)
      });
    }
  }

  const totalAvailableMinutes = availableBlocks.reduce((acc, b) => acc + b.durationMin, 0);

  return {
    availableBlocks,
    totalAvailableMinutes,
    fixedEvents: dayEvents
  };
}

// ----------------------------------------------------------------------------
// 6. generate_schedule(params)
// Master deterministic schedule generator. Evaluates constraints, suitability,
// fits tasks into available blocks, and generates structured proposal diff.
// ----------------------------------------------------------------------------
export function generate_schedule({
  tasks = [],
  calendarEvents = [],
  dailyState = {},
  preferences = {},
  currentTime = new Date(),
  trigger = 'initial_plan'
}) {
  const dateStr = currentTime.toISOString().split('T')[0];
  const { availableBlocks, totalAvailableMinutes, fixedEvents } = find_available_blocks(
    dateStr,
    calendarEvents,
    preferences
  );

  const bufferMinutes = preferences.buffer_minutes ?? 15;
  const energy = dailyState.energy ?? 3;
  const stress = dailyState.stress ?? 3;

  // Filter uncompleted tasks
  const eligibleTasks = tasks.filter(t => t.status !== 'completed');

  // Evaluate suitability score for all tasks
  const evaluatedTasks = eligibleTasks.map(task => {
    const suitability = calculate_task_suitability(
      task,
      dailyState,
      availableBlocks[0] || null,
      preferences,
      currentTime
    );
    return {
      ...task,
      ...suitability
    };
  });

  // Sort deterministically by suitability score descending
  evaluatedTasks.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  const scheduledToday = [];
  const postponedTasks = [];
  const decisionLogs = [];

  // Track running slots
  const runningBlocks = availableBlocks.map(b => ({ ...b, currentPointer: b.startMin }));

  for (const task of evaluatedTasks) {
    const taskDuration = task.adjustedDuration || task.estimated_duration || 30;

    // Rule: If energy is low (1 or 2) and cognitive load is high (>=4), defer to protect energy
    if (!task.isEnergyCompatible && task.flexibility !== 'fixed') {
      postponedTasks.push({
        ...task,
        status: 'postponed',
        postponed_count: (task.postponed_count || 0) + 1,
        postpone_reason: `Energy is low (${energy}/5). High effort task (${task.cognitive_load}/5) deferred to tomorrow's focus window.`
      });
      decisionLogs.push({
        taskId: task.id,
        title: task.title,
        action: 'postponed',
        reason: `Energy mismatch: cognitive load ${task.cognitive_load}/5 vs energy ${energy}/5`
      });
      continue;
    }

    // Attempt placement in available blocks
    let placed = false;

    for (const block of runningBlocks) {
      const remainingTime = block.endMin - block.currentPointer;
      if (remainingTime >= taskDuration) {
        const startMin = block.currentPointer;
        const endMin = startMin + taskDuration;

        // Verify conflict
        const conflict = detect_conflicts(startMin, endMin, fixedEvents, scheduledToday, bufferMinutes);
        if (!conflict.hasConflict) {
          const startTimeStr = minutes_to_time_string(startMin);
          const endTimeStr = minutes_to_time_string(endMin);

          scheduledToday.push({
            ...task,
            scheduled_start: `${dateStr}T${startTimeStr}:00.000Z`,
            scheduled_end: `${dateStr}T${endTimeStr}:00.000Z`,
            startTimeStr,
            endTimeStr,
            status: task.status === 'in_progress' ? 'in_progress' : 'pending'
          });

          decisionLogs.push({
            taskId: task.id,
            title: task.title,
            action: 'scheduled',
            reason: `Assigned to ${startTimeStr} - ${endTimeStr}. Suitability score: ${task.suitabilityScore}`
          });

          // Advance pointer with buffer
          block.currentPointer = endMin + bufferMinutes;
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      postponedTasks.push({
        ...task,
        status: 'postponed',
        postponed_count: (task.postponed_count || 0) + 1,
        postpone_reason: `Available discretionary blocks exhausted for today (${totalAvailableMinutes}m total). Deferred.`
      });
      decisionLogs.push({
        taskId: task.id,
        title: task.title,
        action: 'postponed',
        reason: 'Time budget exhausted without infringing on sleep or fixed commitments.'
      });
    }
  }

  // Reality check
  const totalScheduledMinutes = scheduledToday.reduce((acc, t) => acc + (t.adjustedDuration || t.estimated_duration || 0), 0);
  const totalBufferTime = Math.max(0, scheduledToday.length - 1) * bufferMinutes;
  const totalRequiredTime = totalScheduledMinutes + totalBufferTime;

  // Include tasks deferred purely due to time exhaustion (not energy mismatch) in the demand total
  const timeExhaustedPostponed = postponedTasks.filter(t =>
    t.postpone_reason && t.postpone_reason.includes('exhausted')
  );
  const totalDemandMinutes = totalRequiredTime + timeExhaustedPostponed.reduce(
    (acc, t) => acc + (t.adjustedDuration || t.estimated_duration || 0), 0
  );

  const deficitMinutes = Math.max(0, totalDemandMinutes - totalAvailableMinutes);
  const isUnrealistic = deficitMinutes > 0 || timeExhaustedPostponed.length > 0;

  const availableHours = (totalAvailableMinutes / 60).toFixed(1).replace('.0', '');
  const requiredHours = (totalDemandMinutes / 60).toFixed(1).replace('.0', '');

  let realityWarning = null;
  if (deficitMinutes > 0) {
    realityWarning = `You have ${availableHours} hours available but ${requiredHours} hours required (${deficitMinutes}m deficit). At least one flexible task needs to move.`;
  }

  const decisionRecord = {
    id: `dec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger,
    available_minutes: totalAvailableMinutes,
    scheduled_minutes: totalScheduledMinutes,
    is_unrealistic: isUnrealistic,
    reality_warning: realityWarning,
    changes_json: decisionLogs,
    plain_explanation: '' // Generated by LLM explanation layer
  };

  return {
    scheduledToday,
    postponedTasks,
    fixedEvents,
    availableBlocks,
    totalAvailableMinutes,
    reality: {
      isUnrealistic,
      deficitMinutes,
      totalScheduledMinutes,
      totalRequiredTime,
      totalAvailableMinutes,
      availableHours,
      requiredHours,
      warning: realityWarning
    },
    decisionRecord
  };
}

// ----------------------------------------------------------------------------
// 7. replan_schedule(params)
// Adaptive recalculation triggered by missed task, delay, or energy change.
// ----------------------------------------------------------------------------
export function replan_schedule({
  missedTaskId = null,
  tasks = [],
  calendarEvents = [],
  dailyState = {},
  preferences = {},
  trigger = 'replan',
  reason = 'User requested adaptive replan'
}) {
  const updatedTasks = tasks.map(t => {
    if (missedTaskId && t.id === missedTaskId) {
      return {
        ...t,
        status: 'postponed',
        postponed_count: (t.postponed_count || 0) + 1,
        postpone_reason: reason
      };
    }
    return t;
  });

  return generate_schedule({
    tasks: updatedTasks,
    calendarEvents,
    dailyState,
    preferences,
    trigger
  });
}

// ----------------------------------------------------------------------------
// 8. record_task_outcome(outcome)
// Logs actual vs estimated duration and updates personal time model ratios.
// ----------------------------------------------------------------------------
export function record_task_outcome({
  task_id,
  category = 'other',
  estimated_duration = 30,
  actual_duration = 30,
  energy_at_time = 3,
  cognitive_load = 3,
  completed_at = new Date().toISOString()
}) {
  const est = Math.max(1, Number(estimated_duration) || 30);
  const act = Math.max(1, Number(actual_duration) || 30);
  const ratio = Number((act / est).toFixed(2));

  return {
    id: `out-${Date.now()}`,
    task_id,
    category,
    estimated_duration: est,
    actual_duration: act,
    ratio,
    energy_at_time,
    cognitive_load,
    completed_at
  };
}

// Aliases matching camelCase conventions for backward compatibility
export const calculateUrgency = calculate_urgency;
export const calculateEnergyMatch = calculate_energy_match;
export const calculateTaskSuitability = calculate_task_suitability;
export const detectConflicts = detect_conflicts;
export const findAvailableBlocks = find_available_blocks;
export const generateSchedule = generate_schedule;
export const replanSchedule = replan_schedule;
export const recordTaskOutcome = record_task_outcome;
