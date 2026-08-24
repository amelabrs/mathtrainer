import { generateProblem, OPERATIONS, LEVEL_LABELS } from './problemGenerator.js';
import { getTechniqueHint } from './techniques.js';
import * as storage from './storage.js';
import { evaluateLevel, ROLLING_WINDOW, TIME_THRESHOLD_MS } from './adaptive.js';
import { pickWeightedTarget } from './mixedReview.js';
import { renderStats } from './statsView.js';

const SESSION_LENGTH = 10;
const SLOW_MULTIPLIER = 1.3; // an answer counts as "slow" past this x the level's time threshold

const MODE_DESCRIPTIONS = {
  technique: 'Untimed. Hints are always available — the goal is the right method, not speed.',
  drill: 'Timed, no upfront hints. Speed and accuracy drive automatic leveling.',
  mixed: 'Pulls from every unlocked level, weighted toward your weaker or slower spots.',
};

// ---------- state ----------

const state = {
  mode: 'technique',
  operation: null,
  levels: storage.getLevels(),
  session: null,
};

// ---------- DOM refs ----------

const el = {
  screens: {
    home: document.getElementById('screen-home'),
    session: document.getElementById('screen-session'),
    summary: document.getElementById('screen-summary'),
    stats: document.getElementById('screen-stats'),
  },
  modeTabs: document.querySelectorAll('.mode-tab'),
  modeDescription: document.getElementById('mode-description'),
  operationGrid: document.getElementById('operation-grid'),
  startBtn: document.getElementById('start-btn'),
  statsNavBtn: document.getElementById('stats-nav-btn'),
  statsBackBtn: document.getElementById('stats-back-btn'),
  statsBody: document.getElementById('stats-body'),
  resetBtn: document.getElementById('reset-btn'),

  quitSessionBtn: document.getElementById('quit-session-btn'),
  sessionOpLevel: document.getElementById('session-op-level'),
  sessionProgress: document.getElementById('session-progress'),
  sessionTimer: document.getElementById('session-timer'),
  problemDisplay: document.getElementById('problem-display'),
  answerForm: document.getElementById('answer-form'),
  answerInput: document.getElementById('answer-input'),
  feedback: document.getElementById('feedback'),
  hintBtn: document.getElementById('hint-btn'),
  hintBox: document.getElementById('hint-box'),

  summaryBody: document.getElementById('summary-body'),
  summaryAgainBtn: document.getElementById('summary-again-btn'),
  summaryHomeBtn: document.getElementById('summary-home-btn'),
};

// ---------- screen management ----------

function showScreen(name) {
  Object.entries(el.screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
}

// ---------- home screen ----------

function selectMode(mode) {
  state.mode = mode;
  el.modeTabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
  el.modeDescription.textContent = MODE_DESCRIPTIONS[mode];
  if (mode === 'mixed') {
    state.operation = null;
    el.startBtn.disabled = false;
    el.startBtn.textContent = 'Start mixed review';
  } else if (state.operation) {
    el.startBtn.disabled = false;
    el.startBtn.textContent = `Start ${mode === 'technique' ? 'technique practice' : 'timed drill'}: ${capitalize(state.operation)}`;
  } else {
    el.startBtn.disabled = true;
    el.startBtn.textContent = 'Choose an operation to start';
  }
  renderOperationGrid();
}

function selectOperation(operation) {
  if (state.mode === 'mixed') return;
  state.operation = operation;
  renderOperationGrid();
  selectMode(state.mode); // refresh start button label
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function renderOperationGrid() {
  el.operationGrid.innerHTML = '';
  for (const operation of OPERATIONS) {
    const level = state.levels[operation] || 1;
    const recent = storage.getRecentAttempts(operation, level, ROLLING_WINDOW);
    const accuracy = recent.length ? Math.round((recent.filter((a) => a.correct).length / recent.length) * 100) : null;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'operation-card';
    if (state.operation === operation) card.classList.add('selected');
    if (state.mode === 'mixed') card.classList.add('informational');
    card.innerHTML = `
      <div class="operation-name">${capitalize(operation)}</div>
      <div class="operation-level">Level ${level} — ${LEVEL_LABELS[operation][level - 1]}</div>
      <div class="operation-accuracy">${accuracy === null ? 'No recent data' : `${accuracy}% recent accuracy`}</div>
    `;
    card.addEventListener('click', () => selectOperation(operation));
    el.operationGrid.appendChild(card);
  }
}

el.modeTabs.forEach((btn) => btn.addEventListener('click', () => selectMode(btn.dataset.mode)));
el.startBtn.addEventListener('click', startSession);
el.statsNavBtn.addEventListener('click', openStats);
el.statsBackBtn.addEventListener('click', () => showScreen('home'));
el.resetBtn.addEventListener('click', () => {
  if (confirm('Reset all saved progress and history? This cannot be undone.')) {
    storage.resetAll();
    state.levels = storage.getLevels();
    renderOperationGrid();
    openStats();
  }
});

function openStats() {
  showScreen('stats');
  renderStats(el.statsBody, state.levels);
}

// ---------- session ----------

function startSession() {
  state.session = {
    mode: state.mode,
    operation: state.operation, // null when mixed
    index: 0,
    results: [],
    awaitingNext: false,
    timerInterval: null,
    problemStartTs: 0,
  };
  showScreen('session');
  el.sessionTimer.classList.toggle('hidden', state.mode === 'technique');
  el.hintBtn.classList.toggle('hidden', state.mode !== 'technique');
  nextProblem();
  el.answerInput.focus();
}

function pickTargetForProblem() {
  if (state.mode !== 'mixed') {
    return { operation: state.operation, level: state.levels[state.operation] };
  }
  return pickWeightedTarget(state.levels, (op, lvl) => storage.getRecentAttempts(op, lvl, ROLLING_WINDOW));
}

function nextProblem() {
  const s = state.session;
  if (s.index >= SESSION_LENGTH) {
    finishSession();
    return;
  }
  const { operation, level } = pickTargetForProblem();
  const problem = generateProblem(operation, level);
  s.currentProblem = problem;
  s.currentOperation = operation;
  s.currentLevel = level;
  s.awaitingNext = false;

  el.sessionOpLevel.textContent = `${capitalize(operation)} — Level ${level}`;
  el.sessionProgress.textContent = `Problem ${s.index + 1} of ${SESSION_LENGTH}`;
  el.problemDisplay.textContent = `${problem.display} =`;
  el.answerInput.value = '';
  el.answerInput.readOnly = false;
  el.feedback.textContent = '';
  el.feedback.className = 'feedback';
  el.hintBox.classList.add('hidden');
  el.hintBox.textContent = '';
  if (state.mode === 'technique') {
    el.hintBtn.classList.remove('hidden');
    el.hintBtn.textContent = 'Show technique hint';
  }

  s.problemStartTs = performance.now();
  if (state.mode !== 'technique') startTimer();
  el.answerInput.focus();
}

function startTimer() {
  clearInterval(state.session.timerInterval);
  el.sessionTimer.textContent = '0.0s';
  state.session.timerInterval = setInterval(() => {
    const elapsed = (performance.now() - state.session.problemStartTs) / 1000;
    el.sessionTimer.textContent = `${elapsed.toFixed(1)}s`;
  }, 100);
}

function stopTimer() {
  clearInterval(state.session.timerInterval);
  state.session.timerInterval = null;
}

el.hintBtn.addEventListener('click', () => {
  const hint = getTechniqueHint(state.session.currentProblem);
  el.hintBox.classList.remove('hidden');
  el.hintBox.innerHTML = `<strong>${hint.label}.</strong> ${hint.blurb}<br><span class="worked">${hint.worked}</span>`;
});

el.answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const s = state.session;
  if (s.awaitingNext) {
    nextProblem();
    return;
  }
  const raw = el.answerInput.value.trim();
  if (raw === '') return;
  submitAnswer(Number(raw));
});

function submitAnswer(userAnswer) {
  const s = state.session;
  stopTimer();
  const problem = s.currentProblem;
  const timeMs = Math.round(performance.now() - s.problemStartTs);
  const correct = userAnswer === problem.correctAnswer;
  const threshold = timeThresholdFor(s.currentOperation, s.currentLevel);
  const slow = timeMs > threshold * SLOW_MULTIPLIER;

  storage.logAttempt({
    operation: s.currentOperation,
    level: s.currentLevel,
    mode: state.mode,
    problem: { a: problem.a, b: problem.b, technique: problem.technique },
    userAnswer,
    correct,
    timeMs,
    timestamp: Date.now(),
  });

  s.results.push({ operation: s.currentOperation, level: s.currentLevel, correct, timeMs, technique: problem.technique });
  s.index += 1;
  s.awaitingNext = true;

  // readOnly (not disabled) — a disabled input can't receive the Enter
  // keypress that advances to the next problem.
  el.answerInput.readOnly = true;
  if (correct) {
    el.feedback.textContent = slow ? `Correct — but a bit slow (${(timeMs / 1000).toFixed(1)}s).` : 'Correct!';
    el.feedback.className = slow ? 'feedback feedback-slow' : 'feedback feedback-correct';
  } else {
    el.feedback.textContent = `Not quite — the answer is ${problem.correctAnswer}.`;
    el.feedback.className = 'feedback feedback-wrong';
  }

  // Technique mode: hint stays available on demand (already visible).
  // Drill/mixed: hints are gated during solving, but surfaced now as a
  // teaching moment whenever the answer was wrong or slow.
  if (state.mode !== 'technique' && (!correct || slow)) {
    const hint = getTechniqueHint(problem);
    el.hintBox.classList.remove('hidden');
    el.hintBox.innerHTML = `<strong>${hint.label}.</strong> ${hint.blurb}<br><span class="worked">${hint.worked}</span>`;
  }

  el.sessionProgress.textContent = `Problem ${s.index} of ${SESSION_LENGTH} — press Enter for next`;
}

function timeThresholdFor(operation, level) {
  return TIME_THRESHOLD_MS[operation][level - 1];
}

el.quitSessionBtn.addEventListener('click', () => {
  stopTimer();
  if (state.session && state.session.results.length > 0) {
    finishSession();
  } else {
    showScreen('home');
  }
});

function finishSession() {
  stopTimer();
  const s = state.session;
  const results = s.results;
  const problemsAttempted = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = problemsAttempted ? correct / problemsAttempted : 0;
  const avgTimeMs = problemsAttempted ? results.reduce((sum, r) => sum + r.timeMs, 0) / problemsAttempted : 0;

  // Adaptive leveling for drill/mixed — evaluate every operation+level pair touched this session.
  const levelChanges = [];
  if (state.mode !== 'technique' && problemsAttempted > 0) {
    const touched = new Set(results.map((r) => `${r.operation}:${r.level}`));
    for (const key of touched) {
      const [operation, levelStr] = key.split(':');
      const level = Number(levelStr);
      const recent = storage.getRecentAttempts(operation, level, ROLLING_WINDOW);
      const verdict = evaluateLevel(operation, level, recent);
      if (verdict.action !== 'hold') {
        storage.setLevel(operation, verdict.level);
        state.levels[operation] = verdict.level;
        levelChanges.push({ operation, from: level, to: verdict.level, action: verdict.action });
      }
    }
  }

  if (problemsAttempted > 0) {
    storage.logSession({
      id: Date.now(),
      date: Date.now(),
      mode: state.mode,
      operation: state.operation || 'mixed',
      level: state.operation ? state.levels[state.operation] : null,
      problemsAttempted,
      correct,
      accuracy,
      avgTimeMs,
    });
  }

  renderSummary({ problemsAttempted, correct, accuracy, avgTimeMs, levelChanges, results });
  showScreen('summary');
}

function renderSummary({ problemsAttempted, correct, accuracy, avgTimeMs, levelChanges, results }) {
  if (problemsAttempted === 0) {
    el.summaryBody.innerHTML = '<p>No problems attempted.</p>';
    return;
  }
  const byTechnique = {};
  for (const r of results) {
    byTechnique[r.technique] = byTechnique[r.technique] || { total: 0, correct: 0 };
    byTechnique[r.technique].total += 1;
    if (r.correct) byTechnique[r.technique].correct += 1;
  }
  const techniqueRows = Object.entries(byTechnique)
    .map(([t, v]) => `<li>${t}: ${v.correct}/${v.total}</li>`)
    .join('');

  const changeRows = levelChanges
    .map((c) => `<li class="level-change level-change-${c.action}">${capitalize(c.operation)}: Level ${c.from} → ${c.to} (${c.action === 'advance' ? 'leveled up 🎉' : 'stepped back to rebuild fluency'})</li>`)
    .join('');

  el.summaryBody.innerHTML = `
    <div class="summary-stats">
      <div class="summary-stat"><span class="summary-stat-value">${correct}/${problemsAttempted}</span><span class="summary-stat-label">Correct</span></div>
      <div class="summary-stat"><span class="summary-stat-value">${Math.round(accuracy * 100)}%</span><span class="summary-stat-label">Accuracy</span></div>
      <div class="summary-stat"><span class="summary-stat-value">${(avgTimeMs / 1000).toFixed(1)}s</span><span class="summary-stat-label">Avg time</span></div>
    </div>
    ${changeRows ? `<ul class="level-changes">${changeRows}</ul>` : ''}
    <details class="technique-breakdown"><summary>By technique</summary><ul>${techniqueRows}</ul></details>
  `;
}

el.summaryAgainBtn.addEventListener('click', () => {
  showScreen('session');
  startSession();
});
el.summaryHomeBtn.addEventListener('click', () => {
  renderOperationGrid();
  showScreen('home');
});

// ---------- init ----------

selectMode('technique');
renderOperationGrid();
showScreen('home');
