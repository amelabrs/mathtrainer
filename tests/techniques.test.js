import test from 'node:test';
import assert from 'node:assert/strict';
import { getTechniqueHint } from '../js/techniques.js';

// Regression coverage for the compensation sign bug: rounding an operand up
// vs down must flip the +/- in the worked example, or the shown arithmetic
// doesn't add up to correctAnswer. These are fixed, hand-checked cases.

function worked(problem) {
  return getTechniqueHint(problem).worked;
}

test('addition compensation: rounding the addend up subtracts back', () => {
  const p = { operation: 'addition', a: 12, b: 19, correctAnswer: 31, technique: 'compensation' };
  assert.equal(worked(p), '12 + 19 = 12 + 20 − 1 = 32 − 1 = 31');
});

test('addition compensation: rounding the addend down adds back', () => {
  const p = { operation: 'addition', a: 31, b: 19, correctAnswer: 50, technique: 'compensation' };
  assert.equal(worked(p), '31 + 19 = 30 + 19 + 1 = 49 + 1 = 50');
});

test('subtraction compensation: rounding the subtrahend up adds back', () => {
  const p = { operation: 'subtraction', a: 87, b: 59, correctAnswer: 28, technique: 'compensation' };
  assert.equal(worked(p), '87 − 59 = 87 − 60 + 1 = 27 + 1 = 28');
});

test('subtraction compensation: rounding the subtrahend down subtracts back', () => {
  const p = { operation: 'subtraction', a: 90, b: 84, correctAnswer: 6, technique: 'compensation' };
  assert.equal(worked(p), '90 − 84 = 90 − 80 − 4 = 10 − 4 = 6');
});

test('multiplication compensation: rounding up subtracts the excess product', () => {
  const p = { operation: 'multiplication', a: 99, b: 3, correctAnswer: 297, technique: 'compensation' };
  assert.equal(worked(p), '99×3 = (100 − 1)×3 = 300 − 3 = 297');
});

test('multiplication compensation: rounding down adds the shortfall product', () => {
  const p = { operation: 'multiplication', a: 41, b: 2, correctAnswer: 82, technique: 'compensation' };
  assert.equal(worked(p), '41×2 = (40 + 1)×2 = 80 + 2 = 82');
});

test('squares-5: n5 × n5 uses n×(n+1) append 25', () => {
  const p = { operation: 'multiplication', a: 35, b: 35, correctAnswer: 1225, technique: 'squares-5' };
  assert.equal(worked(p), '35² → 3×4 = 12, append 25 → 1225');
});

test('doubling-halving: ×5 becomes ×10÷2', () => {
  const p = { operation: 'multiplication', a: 34, b: 5, correctAnswer: 170, technique: 'doubling-halving' };
  assert.equal(worked(p), '34×5 = 34×10 ÷ 2 = 340 ÷ 2 = 170');
});

test('splitting: two-digit x one-digit breaks into tens + units', () => {
  const p = { operation: 'multiplication', a: 34, b: 6, correctAnswer: 204, technique: 'splitting' };
  assert.equal(worked(p), '34×6 = 30×6 + 4×6 = 180 + 24 = 204');
});

test('standard-split: two-digit x two-digit', () => {
  const p = { operation: 'multiplication', a: 23, b: 47, correctAnswer: 1081, technique: 'standard-split' };
  assert.equal(worked(p), '23×47 = 20×47 + 3×47 = 940 + 141 = 1081');
});

test('division-inverse: frames division as "what times b gives a"', () => {
  const p = { operation: 'division', a: 84, b: 7, correctAnswer: 12, technique: 'division-inverse' };
  assert.equal(worked(p), '84 ÷ 7: think "7 × ? = 84" → 7 × 12 = 84, so the answer is 12');
});

test('unknown technique falls back to recall without throwing', () => {
  const p = { operation: 'addition', a: 2, b: 2, correctAnswer: 4, technique: 'nonsense-tag' };
  assert.doesNotThrow(() => worked(p));
});
