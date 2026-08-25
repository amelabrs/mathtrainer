// Pure problem-generation functions. No DOM access here — keeps this file
// trivially unit-testable (see tests/generator.test.js).

/** Integer in [min, max], inclusive. rng is injectable for deterministic tests. */
export function randInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export const OPERATIONS = ['addition', 'subtraction', 'multiplication', 'division'];
export const LEVELS = [1, 2, 3, 4];

export const OPERATION_SYMBOL = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

export const LEVEL_LABELS = {
  addition: [
    'Single digits (within 20)',
    'Two-digit + one- or two-digit, no regrouping',
    'Two-digit + two-digit, with regrouping',
    'Three-digit chaining',
  ],
  subtraction: [
    'Single digits (within 20)',
    'Two-digit − one- or two-digit, no regrouping',
    'Two-digit − two-digit, with regrouping',
    'Three-digit chaining',
  ],
  multiplication: [
    'Times tables 1–12',
    'Two-digit × one-digit (splitting)',
    'Two-digit × two-digit (standard split)',
    'Mixed recall & splitting',
  ],
  division: [
    'Times tables 1–12 (inverse)',
    'Two-digit ÷ one-digit, exact',
    'Two-digit ÷ two-digit, exact',
    'Estimation-based long division',
  ],
};

function makeProblem(operation, level, a, b, technique, correctAnswer) {
  return {
    operation,
    level,
    a,
    b,
    technique,
    correctAnswer,
    display: `${a} ${OPERATION_SYMBOL[operation]} ${b}`,
  };
}

// ---------- Addition ----------

function genAddition(level, rng) {
  if (level === 1) {
    // Uniform 1-9 pairs are mostly trivial near-doubles (8+2, 4+1) — the
    // facts that actually take an adult a beat to recall are the ones that
    // cross ten (7+8, 9+6). Only generate those; no easy fallback.
    const a = randInt(2, 9, rng);
    const b = randInt(Math.max(2, 10 - a), 9, rng);
    return makeProblem('addition', 1, a, b, 'recall', a + b);
  }
  if (level === 2) {
    // Bridge toward L3: keep it regroup-free, but let the second operand be
    // two-digit about half the time so the *magnitude* jump to two two-digit
    // numbers happens here, before L3 also demands carrying.
    const bTens = rng() < 0.5 ? 0 : randInt(1, 8, rng);
    const bUnits = randInt(1, 9, rng);
    const b = bTens * 10 + bUnits;
    const aTens = randInt(bTens + 1, 9, rng);
    const aUnits = randInt(0, 9 - bUnits, rng); // guarantees no carry
    const a = aTens * 10 + aUnits;
    return makeProblem('addition', 2, a, b, 'no-regroup', a + b);
  }
  if (level === 3) {
    // force regrouping: units of a + units of b >= 10
    const aUnits = randInt(1, 9, rng);
    const bUnits = randInt(10 - aUnits, 9, rng);
    const aTens = randInt(1, 9, rng);
    const bTens = randInt(1, 9, rng);
    const a = aTens * 10 + aUnits;
    const b = bTens * 10 + bUnits;
    return makeProblem('addition', 3, a, b, 'compensation', a + b);
  }
  // level 4: three-digit chaining
  const a = randInt(100, 999, rng);
  const b = randInt(rng() < 0.5 ? 10 : 100, rng() < 0.5 ? 99 : 999, rng);
  return makeProblem('addition', 4, a, b, 'chaining', a + b);
}

// ---------- Subtraction ----------
// Built as b + diff = a so results are always well-defined and non-negative.

function genSubtraction(level, rng) {
  if (level === 1) {
    // Mirror addition L1: only the "crosses ten" facts (15-8, 13-6), which
    // are the ones that actually take thought — no easy fallback.
    const b = randInt(2, 9, rng);
    const diff = randInt(Math.max(2, 10 - b), 9, rng);
    const a = b + diff;
    return makeProblem('subtraction', 1, a, b, 'recall', diff);
  }
  if (level === 2) {
    // Bridge toward L3: still regroup-free, but the subtrahend is two-digit
    // about half the time so magnitude grows here before L3 adds borrowing.
    const bTens = rng() < 0.5 ? 0 : randInt(1, 8, rng);
    const bUnits = randInt(1, 9, rng);
    const aTens = randInt(bTens, 9, rng);
    const aUnits = randInt(bUnits, 9, rng); // units - b's units >= 0, no borrow
    const a = aTens * 10 + aUnits;
    const b = bTens * 10 + bUnits;
    return makeProblem('subtraction', 2, a, b, 'no-regroup', a - b);
  }
  if (level === 3) {
    // force borrowing: a's units digit < b's units digit
    const bUnits = randInt(1, 9, rng);
    const aUnits = randInt(0, bUnits - 1 >= 0 ? bUnits - 1 : 0, rng);
    const bTens = randInt(1, 8, rng);
    const aTens = randInt(bTens + 1, 9, rng);
    const a = aTens * 10 + aUnits;
    const b = bTens * 10 + bUnits;
    return makeProblem('subtraction', 3, a, b, 'compensation', a - b);
  }
  // level 4
  const b = randInt(rng() < 0.5 ? 10 : 100, rng() < 0.5 ? 99 : 899, rng);
  const diff = randInt(10, 999 - b, rng);
  const a = b + diff;
  return makeProblem('subtraction', 4, a, b, 'chaining', diff);
}

// ---------- Multiplication ----------

function nearRoundNumber(n) {
  // Ends in 9 or 1 — one step from a multiple of ten, where rounding pays off.
  // (A number already ending in 0 has nothing to compensate for.)
  const rem = n % 10;
  return rem === 9 || rem === 1;
}

function genMultiplication(level, rng) {
  if (level === 1) {
    const a = randInt(1, 12, rng);
    const b = randInt(1, 12, rng);
    return makeProblem('multiplication', 1, a, b, 'recall', a * b);
  }
  if (level === 2) {
    const a = randInt(11, 99, rng);
    const b = randInt(2, 9, rng);
    let technique = 'splitting';
    if (b === 5) technique = 'doubling-halving';
    else if (nearRoundNumber(a)) technique = 'compensation';
    return makeProblem('multiplication', 2, a, b, technique, a * b);
  }
  if (level === 3) {
    const a = randInt(11, 99, rng);
    const b = randInt(11, 99, rng);
    let technique = 'standard-split';
    if (a === b && a % 10 === 5) technique = 'squares-5';
    else if (nearRoundNumber(a) || nearRoundNumber(b)) technique = 'compensation';
    return makeProblem('multiplication', 3, a, b, technique, a * b);
  }
  // level 4: mixed recall/splitting review, weighted toward two-digit x one-digit
  const useTwoDigit = rng() < 0.6;
  if (useTwoDigit) {
    const a = randInt(11, 99, rng);
    const b = randInt(2, 9, rng);
    return makeProblem('multiplication', 4, a, b, 'splitting', a * b);
  }
  const a = randInt(2, 12, rng);
  const b = randInt(2, 12, rng);
  return makeProblem('multiplication', 4, a, b, 'recall', a * b);
}

// ---------- Division ----------

function genDivision(level, rng) {
  if (level === 1) {
    const b = randInt(1, 12, rng);
    const quotient = randInt(1, 12, rng);
    const a = b * quotient;
    return makeProblem('division', 1, a, b, 'division-inverse', quotient);
  }
  if (level === 2) {
    const b = randInt(2, 9, rng);
    const quotient = randInt(2, 12, rng);
    const a = b * quotient;
    return makeProblem('division', 2, a, b, 'division-inverse', quotient);
  }
  if (level === 3) {
    const b = randInt(11, 25, rng);
    const quotient = randInt(2, 9, rng);
    const a = b * quotient;
    return makeProblem('division', 3, a, b, 'division-inverse', quotient);
  }
  // level 4: estimation-based long division, not always exact
  const b = randInt(11, 40, rng);
  const quotient = randInt(4, 30, rng);
  const remainder = rng() < 0.6 ? randInt(1, b - 1, rng) : 0;
  const a = b * quotient + remainder;
  const technique = remainder === 0 ? 'division-inverse' : 'estimation-division';
  return makeProblem('division', 4, a, b, technique, quotient);
}

/**
 * Generate one problem for the given operation/level.
 * @param {string} operation one of OPERATIONS
 * @param {number} level 1-4
 * @param {function} rng injectable RNG (defaults to Math.random)
 */
export function generateProblem(operation, level, rng = Math.random) {
  if (!OPERATIONS.includes(operation)) throw new Error(`Unknown operation: ${operation}`);
  if (!LEVELS.includes(level)) throw new Error(`Unknown level: ${level}`);
  switch (operation) {
    case 'addition':
      return genAddition(level, rng);
    case 'subtraction':
      return genSubtraction(level, rng);
    case 'multiplication':
      return genMultiplication(level, rng);
    case 'division':
      return genDivision(level, rng);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/** Generate a batch of n problems, e.g. for a practice session. */
export function generateBatch(operation, level, n, rng = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(generateProblem(operation, level, rng));
  return out;
}
