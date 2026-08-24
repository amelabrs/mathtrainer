// localStorage persistence: current levels, attempt log, session summaries.
// Single user, no backend — everything lives in the browser.

const KEYS = {
  levels: 'mmt_levels_v1',
  attempts: 'mmt_attempts_v1',
  sessions: 'mmt_sessions_v1',
};

const MAX_ATTEMPTS = 1000; // cap so localStorage doesn't grow unbounded
const OPERATIONS = ['addition', 'subtraction', 'multiplication', 'division'];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`Failed to read ${key} from storage, using fallback`, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to write ${key} to storage`, e);
  }
}

export function getLevels() {
  const defaults = Object.fromEntries(OPERATIONS.map((op) => [op, 1]));
  return { ...defaults, ...readJSON(KEYS.levels, {}) };
}

export function setLevel(operation, level) {
  const levels = getLevels();
  levels[operation] = level;
  writeJSON(KEYS.levels, levels);
  return levels;
}

export function getAttempts() {
  return readJSON(KEYS.attempts, []);
}

/** Record one attempt: { operation, level, mode, problem, userAnswer, correct, timeMs, timestamp } */
export function logAttempt(attempt) {
  const attempts = getAttempts();
  attempts.push(attempt);
  if (attempts.length > MAX_ATTEMPTS) attempts.splice(0, attempts.length - MAX_ATTEMPTS);
  writeJSON(KEYS.attempts, attempts);
  return attempts;
}

/** Last n attempts for a given operation+level (most recent last). */
export function getRecentAttempts(operation, level, n = 10) {
  const attempts = getAttempts().filter((a) => a.operation === operation && a.level === level);
  return attempts.slice(-n);
}

export function getSessions() {
  return readJSON(KEYS.sessions, []);
}

/** Save a session summary: { id, date, operation, level, mode, problemsAttempted, correct, accuracy, avgTimeMs } */
export function logSession(session) {
  const sessions = getSessions();
  sessions.push(session);
  writeJSON(KEYS.sessions, sessions);
  return sessions;
}

export function getSessionsFor(operation, level) {
  return getSessions().filter((s) => s.operation === operation && s.level === level);
}

/** Wipe everything — used from the stats screen's "reset" control. */
export function resetAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
