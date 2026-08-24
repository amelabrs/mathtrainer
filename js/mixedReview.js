// Mixed review: picks an operation+level to draw the next problem from,
// weighted toward areas the learner is weaker or slower at. Pure logic,
// separated from storage/DOM so it's easy to reason about and test.

import { OPERATIONS } from './problemGenerator.js';
import { rollingStats } from './adaptive.js';

/**
 * @param {object} levels current unlocked level per operation, e.g. {addition:3, ...}
 * @param {function} getRecent (operation, level) => recent attempts array
 * @param {function} rng injectable RNG
 * @returns {{operation: string, level: number}}
 */
export function pickWeightedTarget(levels, getRecent, rng = Math.random) {
  const candidates = [];
  for (const operation of OPERATIONS) {
    const unlocked = levels[operation] || 1;
    for (let level = 1; level <= unlocked; level++) {
      const recent = getRecent(operation, level);
      const stats = rollingStats(recent);
      // No data yet -> neutral weight so new levels still get sampled.
      // Otherwise weight up when accuracy is low or answers are slow.
      const accuracyWeight = stats.n === 0 ? 1 : 1 - stats.accuracy + 0.2; // 0.2 floor
      const speedWeight = stats.n === 0 || stats.avgTimeMs === 0 ? 1 : Math.min(stats.avgTimeMs / 5000, 3);
      // Current (highest unlocked) level per operation gets a bump — that's
      // the growing edge, not the already-mastered lower levels.
      const edgeBump = level === unlocked ? 1.5 : 1;
      const weight = accuracyWeight * speedWeight * edgeBump;
      candidates.push({ operation, level, weight });
    }
  }
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = rng() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return { operation: c.operation, level: c.level };
  }
  const last = candidates[candidates.length - 1];
  return { operation: last.operation, level: last.level };
}
