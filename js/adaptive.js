// Adaptive leveling: rolling accuracy/speed over the last ~10 drill attempts
// decides whether to advance, hold, or drop a level. Lives here so app.js
// stays a thin UI layer and this logic can be reasoned about (and tested)
// on its own.

export const ROLLING_WINDOW = 10;
export const ADVANCE_MIN_CORRECT = 8; // out of ROLLING_WINDOW
export const DROP_ACCURACY_THRESHOLD = 0.6;

// Rough "should feel fast" targets per operation/level, in ms. Advancing
// requires both accuracy AND speed under threshold — hitting 8/10 by
// guessing slowly shouldn't push someone up a level.
export const TIME_THRESHOLD_MS = {
  addition: [4000, 6000, 9000, 15000],
  subtraction: [4000, 6000, 9000, 15000],
  multiplication: [4000, 7000, 12000, 10000],
  division: [5000, 8000, 12000, 15000],
};

export function rollingStats(attempts) {
  const n = attempts.length;
  if (n === 0) return { n: 0, correct: 0, accuracy: 0, avgTimeMs: 0 };
  const correct = attempts.filter((a) => a.correct).length;
  const avgTimeMs = attempts.reduce((sum, a) => sum + a.timeMs, 0) / n;
  return { n, correct, accuracy: correct / n, avgTimeMs };
}

/**
 * Decide the next level given the most recent attempts at the current level.
 * `recentAttempts` should be the last ROLLING_WINDOW attempts for this
 * operation+level (oldest first), as returned by storage.getRecentAttempts.
 */
export function evaluateLevel(operation, level, recentAttempts) {
  const stats = rollingStats(recentAttempts);
  const result = { action: 'hold', level, ...stats };

  if (stats.n < ROLLING_WINDOW) return result; // not enough data yet

  const threshold = TIME_THRESHOLD_MS[operation][level - 1];

  if (stats.correct >= ADVANCE_MIN_CORRECT && stats.avgTimeMs <= threshold && level < 4) {
    return { ...result, action: 'advance', level: level + 1 };
  }
  if (stats.accuracy < DROP_ACCURACY_THRESHOLD && level > 1) {
    return { ...result, action: 'drop', level: level - 1 };
  }
  return result;
}
