// Pure deterministic scoring layer for tasks based on energy, stress, deadline, and cognitive load

/**
 * Calculates priority score for a task at a given evaluation moment.
 * Returns { score, reasons, recommendationAction }
 */
export function calculateTaskScore(task, dailyState, currentTime = new Date(), options = {}) {
  const { energy = 3, stress = 3 } = dailyState || {};
  const { categoryMultipliers = {} } = options;

  let score = 0;
  const reasons = [];

  // Effective energy capacity adjusted by stress
  // High stress (4 or 5) dampens usable focus capacity
  const stressPenalty = stress >= 4 ? 1 : 0;
  const effectiveEnergy = Math.max(1, energy - stressPenalty);

  // 1. Deadline Urgency
  if (task.deadline) {
    const deadlineDate = new Date(task.deadline);
    const hoursRemaining = (deadlineDate - currentTime) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      score += 120;
      reasons.push(`Overdue by ${Math.abs(Math.round(hoursRemaining))} hours`);
    } else if (hoursRemaining <= 12) {
      score += 90;
      reasons.push(`Imminent deadline (${Math.round(hoursRemaining)}h remaining)`);
    } else if (hoursRemaining <= 24) {
      score += 70;
      reasons.push('Due within 24 hours');
    } else if (hoursRemaining <= 48) {
      score += 45;
      reasons.push('Due within 48 hours');
    } else if (hoursRemaining <= 96) {
      score += 25;
      reasons.push('Due in 2-4 days');
    } else {
      score += 10;
    }
  } else {
    score += 5;
  }

  // 2. Base Importance (1-5 scale)
  const importanceWeight = (task.importance || 3) * 12;
  score += importanceWeight;
  reasons.push(`Importance rating: ${task.importance}/5`);

  // 3. Cognitive Load vs. Effective Energy Match
  // Rule: High cognitive load in high energy; Low cognitive load in low energy
  const cogLoad = task.cognitive_load || 3;

  if (effectiveEnergy <= 2) {
    // Low energy mode
    if (cogLoad >= 4) {
      score -= 75; // Heavily penalize deep focus tasks when drained
      reasons.push(`Heavy cognitive load (${cogLoad}/5) conflicts with current low energy (${effectiveEnergy}/5)`);
    } else if (cogLoad <= 2) {
      score += 50; // Boost low-friction, repetitive, or physical tasks
      reasons.push(`Low cognitive barrier (${cogLoad}/5) fits low energy state well`);
    } else {
      score -= 10;
    }
  } else if (effectiveEnergy >= 4) {
    // High energy mode
    if (cogLoad >= 4) {
      score += 60; // Maximize high focus window
      reasons.push(`High focus task (${cogLoad}/5) leverages peak energy (${effectiveEnergy}/5)`);
    } else if (cogLoad <= 2) {
      score -= 20; // Save high energy for demanding work
      reasons.push(`Light task deprioritized to preserve high-focus window`);
    } else {
      score += 20;
    }
  } else {
    // Moderate energy (3)
    if (cogLoad === 3 || cogLoad === 2) {
      score += 25;
      reasons.push(`Moderate load (${cogLoad}/5) matches baseline energy`);
    } else if (cogLoad >= 5) {
      score -= 20;
      reasons.push(`Very heavy load (${cogLoad}/5) requires peak focus`);
    }
  }

  // 4. Repeated Postponement Safeguard
  // Prevent tasks from being indefinitely pushed without resolution
  if ((task.postponed_count || 0) >= 2) {
    const bump = (task.postponed_count || 0) * 15;
    score += bump;
    reasons.push(`Repeatedly postponed (${task.postponed_count}x): bumped to prevent stalling`);
  }

  // 5. Time Blindness multiplier estimate
  const multiplier = categoryMultipliers[task.category] || 1.0;
  const adjustedDuration = Math.round(task.estimated_duration * multiplier);

  return {
    taskId: task.id,
    taskTitle: task.title,
    score: Math.round(score),
    effectiveEnergy,
    adjustedDuration,
    reasons
  };
}

/**
 * Checks if a task aligns with a specific time-of-day slot
 */
export function getTimeOfDayScore(taskPreference, slotHour) {
  if (!taskPreference || taskPreference === 'any') return 10;
  
  if (slotHour >= 6 && slotHour < 12 && taskPreference === 'morning') return 25;
  if (slotHour >= 12 && slotHour < 18 && taskPreference === 'afternoon') return 25;
  if (slotHour >= 18 && slotHour <= 23 && taskPreference === 'evening') return 25;
  
  return -10;
}
