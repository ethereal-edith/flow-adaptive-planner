// ============================================================================
// Flow Adaptive Planner — Personal Time-Estimation Learning
// ============================================================================
// Pure functions, no I/O. Converts completed-task outcome history (estimated
// vs actual duration) into personalized per-category duration multipliers.
// Called from App.jsx after each recorded outcome; the result is merged into
// preferences.category_multipliers, which planningEngine.js / scoring.js
// already read — so no changes to the scheduling engine itself are needed.
// ============================================================================

const MIN_SAMPLES_TO_TRUST = 3;   // don't trust a category until it has a few data points
const MAX_ADJUSTMENT_PER_RUN = 0.5; // never swing a multiplier by more than +/-0.5 in one recompute
const LEARNING_WEIGHT = 0.6;      // how strongly the observed ratio pulls the multiplier toward itself
const MIN_MULTIPLIER = 0.5;
const MAX_MULTIPLIER = 2.0;

/**
 * Groups outcomes by category and averages the actual/estimated duration ratio.
 * @param {Array} outcomes - rows shaped like { category, ratio } (ratio = actual/estimated)
 * @returns {Object} e.g. { coding: { avgRatio: 1.42, sampleSize: 6 }, ... }
 */
export function summarizeOutcomesByCategory(outcomes = []) {
  const byCategory = {};
  for (const outcome of outcomes) {
    const category = outcome.category || 'personal';
    const ratio = Number(outcome.ratio);
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(ratio);
  }

  const summary = {};
  for (const [category, ratios] of Object.entries(byCategory)) {
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    summary[category] = {
      avgRatio: Number(avgRatio.toFixed(2)),
      sampleSize: ratios.length
    };
  }
  return summary;
}

/**
 * Blends learned per-category ratios into the existing multipliers.
 * - Categories with fewer than MIN_SAMPLES_TO_TRUST completed tasks keep
 *   their current multiplier untouched (not enough evidence yet).
 * - Categories with enough history get nudged toward the observed ratio,
 *   capped per-run so one unusual estimate can't swing the whole schedule.
 *
 * @param {Array} outcomes - full outcome history
 * @param {Object} currentMultipliers - preferences.category_multipliers
 * @returns {Object} new multipliers object (does not mutate the input)
 */
export function deriveLearnedMultipliers(outcomes = [], currentMultipliers = {}) {
  const summary = summarizeOutcomesByCategory(outcomes);
  const updated = { ...currentMultipliers };

  for (const [category, { avgRatio, sampleSize }] of Object.entries(summary)) {
    if (sampleSize < MIN_SAMPLES_TO_TRUST) continue;

    const current = updated[category] ?? 1.0;
    const target = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, avgRatio));
    const desiredMove = (target - current) * LEARNING_WEIGHT;
    const cappedMove = Math.max(-MAX_ADJUSTMENT_PER_RUN, Math.min(MAX_ADJUSTMENT_PER_RUN, desiredMove));

    updated[category] = Number((current + cappedMove).toFixed(2));
  }

  return updated;
}

/**
 * Human-readable lines per category, suitable for an "why is this scheduled
 * longer/shorter than I typed?" explanation surface in the UI.
 */
export function explainLearning(outcomes = []) {
  const summary = summarizeOutcomesByCategory(outcomes);
  return Object.entries(summary)
    .filter(([, { sampleSize }]) => sampleSize >= MIN_SAMPLES_TO_TRUST)
    .map(([category, { avgRatio, sampleSize }]) => {
      if (avgRatio > 1.1) {
        return `${category}: tasks are taking ${avgRatio}× longer than estimated on average (${sampleSize} logged) — durations have been adjusted up.`;
      }
      if (avgRatio < 0.9) {
        return `${category}: tasks are finishing faster than estimated (${avgRatio}×, ${sampleSize} logged) — durations have been trimmed.`;
      }
      return `${category}: estimates are tracking well (${avgRatio}×, ${sampleSize} logged).`;
    });
}
