import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generateBatch, OPERATIONS, LEVELS } from '../js/problemGenerator.js';

// Deterministic-ish stress test: run many iterations per operation/level to
// catch edge cases (e.g. off-by-one ranges) that a single random draw would miss.
const ITERATIONS = 500;

for (const operation of OPERATIONS) {
  for (const level of LEVELS) {
    test(`${operation} L${level}: correctAnswer is always right and non-negative`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const p = generateProblem(operation, level);
        let expected;
        if (operation === 'addition') expected = p.a + p.b;
        else if (operation === 'subtraction') expected = p.a - p.b;
        else if (operation === 'multiplication') expected = p.a * p.b;
        else expected = Math.floor(p.a / p.b); // division: dividend may include a remainder

        assert.equal(p.correctAnswer, expected, `${p.a} ${operation} ${p.b} -> expected ${expected}, got ${p.correctAnswer}`);
        assert.ok(p.correctAnswer >= 0, `negative answer for ${p.a} ${operation} ${p.b}`);
        assert.ok(typeof p.technique === 'string' && p.technique.length > 0);
      }
    });
  }
}

test('addition L2 never regroups (units never carry)', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const p = generateProblem('addition', 2);
    assert.ok((p.a % 10) + p.b < 10, `${p.a} + ${p.b} regroups`);
  }
});

test('subtraction L2 never borrows', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const p = generateProblem('subtraction', 2);
    assert.ok(p.a % 10 >= p.b, `${p.a} - ${p.b} borrows`);
  }
});

test('addition L3 always regroups (forces the round-and-adjust technique)', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const p = generateProblem('addition', 3);
    assert.ok((p.a % 10) + (p.b % 10) >= 10, `${p.a} + ${p.b} does not regroup`);
  }
});

test('subtraction L3 always borrows', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const p = generateProblem('subtraction', 3);
    assert.ok(p.a % 10 < p.b % 10, `${p.a} - ${p.b} does not borrow`);
  }
});

test('division L1-L3 are always exact (no remainder)', () => {
  for (const level of [1, 2, 3]) {
    for (let i = 0; i < ITERATIONS; i++) {
      const p = generateProblem('division', level);
      assert.equal(p.a % p.b, 0, `L${level}: ${p.a} / ${p.b} is not exact`);
    }
  }
});

test('multiplication L1 stays within times-tables range (1-12)', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const p = generateProblem('multiplication', 1);
    assert.ok(p.a >= 1 && p.a <= 12 && p.b >= 1 && p.b <= 12);
  }
});

test('generateBatch returns the requested count', () => {
  const batch = generateBatch('addition', 1, 25);
  assert.equal(batch.length, 25);
});

test('unknown operation/level throw', () => {
  assert.throws(() => generateProblem('exponentiation', 1));
  assert.throws(() => generateProblem('addition', 9));
});
