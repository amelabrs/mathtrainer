import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLevel, rollingStats, ROLLING_WINDOW } from '../js/adaptive.js';

function makeAttempts(n, { correct, timeMs }) {
  return Array.from({ length: n }, () => ({ correct, timeMs }));
}

test('rollingStats on empty array', () => {
  const s = rollingStats([]);
  assert.equal(s.n, 0);
  assert.equal(s.accuracy, 0);
});

test('holds with fewer than ROLLING_WINDOW attempts', () => {
  const attempts = makeAttempts(5, { correct: true, timeMs: 500 });
  const v = evaluateLevel('multiplication', 1, attempts);
  assert.equal(v.action, 'hold');
});

test('advances on strong accuracy + fast time', () => {
  const attempts = [
    ...makeAttempts(8, { correct: true, timeMs: 1000 }),
    ...makeAttempts(2, { correct: false, timeMs: 1000 }),
  ];
  const v = evaluateLevel('multiplication', 1, attempts);
  assert.equal(v.action, 'advance');
  assert.equal(v.level, 2);
});

test('does not advance if fast but accuracy below threshold', () => {
  const attempts = [
    ...makeAttempts(7, { correct: true, timeMs: 1000 }),
    ...makeAttempts(3, { correct: false, timeMs: 1000 }),
  ];
  const v = evaluateLevel('multiplication', 1, attempts);
  assert.equal(v.action, 'hold');
});

test('does not advance if accurate but too slow', () => {
  const attempts = makeAttempts(10, { correct: true, timeMs: 999999 });
  const v = evaluateLevel('multiplication', 1, attempts);
  assert.equal(v.action, 'hold');
});

test('never advances past level 4', () => {
  const attempts = makeAttempts(10, { correct: true, timeMs: 100 });
  const v = evaluateLevel('multiplication', 4, attempts);
  assert.equal(v.action, 'hold');
  assert.equal(v.level, 4);
});

test('drops on a slump below 60% accuracy', () => {
  const attempts = [
    ...makeAttempts(3, { correct: true, timeMs: 3000 }),
    ...makeAttempts(7, { correct: false, timeMs: 3000 }),
  ];
  const v = evaluateLevel('addition', 3, attempts);
  assert.equal(v.action, 'drop');
  assert.equal(v.level, 2);
});

test('never drops below level 1', () => {
  const attempts = makeAttempts(10, { correct: false, timeMs: 3000 });
  const v = evaluateLevel('addition', 1, attempts);
  assert.equal(v.action, 'hold');
  assert.equal(v.level, 1);
});

test('ROLLING_WINDOW is 10 as specced', () => {
  assert.equal(ROLLING_WINDOW, 10);
});
