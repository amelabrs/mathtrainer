// Technique library: one-line labels + worked-example generators keyed by
// the technique tag a problem carries (see problemGenerator.js).

function roundTo10(n) {
  const down = Math.floor(n / 10) * 10;
  const up = down + 10;
  return n - down <= up - n ? { target: down, delta: n - down } : { target: up, delta: n - up };
}

const TECHNIQUES = {
  recall: {
    label: 'Instant recall',
    blurb: 'This is a core fact — the goal is to know it instantly, no calculation.',
    example(p) {
      return `${p.a} ${symbolFor(p)} ${p.b} = ${p.correctAnswer}. Drill this until it's automatic.`;
    },
  },

  'no-regroup': {
    label: 'Left-to-right, no regrouping',
    blurb: 'Add or subtract the tens and units separately — nothing carries over.',
    example(p) {
      const tens = Math.floor(p.a / 10) * 10;
      const units = p.a % 10;
      const op = p.operation === 'addition' ? '+' : '−';
      const unitResult = p.operation === 'addition' ? units + p.b : units - p.b;
      return `${p.a} ${op} ${p.b} = ${tens} and ${units}${op}${p.b} → ${tens}+${unitResult} = ${p.correctAnswer}`;
    },
  },

  'round-adjust': {
    label: 'Round and adjust',
    blurb: 'Round one number to a nearby ten, do the easy operation, then adjust back.',
    example(p) {
      return compensationExample(p);
    },
  },

  compensation: {
    label: 'Compensation',
    blurb: 'Round to a nearby easy number, calculate, then adjust for the rounding.',
    example(p) {
      return p.operation === 'multiplication' ? multCompensationExample(p) : compensationExample(p);
    },
  },

  chaining: {
    label: 'Left-to-right chaining',
    blurb: 'Work hundreds, then tens, then units — adjust as you go, left to right.',
    example(p) {
      const op = p.operation === 'addition' ? '+' : '−';
      const aParts = decompose(p.a);
      return `${p.a} ${op} ${p.b}: start from ${aParts.hundreds ? aParts.hundreds + ' hundreds, ' : ''}${op} ${p.b} in chunks (hundreds, then tens, then units) → ${p.correctAnswer}`;
    },
  },

  splitting: {
    label: 'Splitting / distribution',
    blurb: 'Break the two-digit number into tens and units, multiply each, add up.',
    example(p) {
      const [big, small] = p.a >= 10 ? [p.a, p.b] : [p.b, p.a];
      const tens = Math.floor(big / 10) * 10;
      const units = big % 10;
      return `${big}×${small} = ${tens}×${small} + ${units}×${small} = ${tens * small} + ${units * small} = ${p.correctAnswer}`;
    },
  },

  'standard-split': {
    label: 'Standard split (both operands)',
    blurb: 'Split one number into tens + units, multiply the other by each part, add.',
    example(p) {
      const aTens = Math.floor(p.a / 10) * 10;
      const aUnits = p.a % 10;
      return `${p.a}×${p.b} = ${aTens}×${p.b} + ${aUnits}×${p.b} = ${aTens * p.b} + ${aUnits * p.b} = ${p.correctAnswer}`;
    },
  },

  'doubling-halving': {
    label: 'Doubling / halving',
    blurb: '×5 is the same as ×10 then ÷2 — often faster than multiplying directly.',
    example(p) {
      const other = p.a === 5 ? p.b : p.a;
      return `${other}×5 = ${other}×10 ÷ 2 = ${other * 10} ÷ 2 = ${p.correctAnswer}`;
    },
  },

  'squares-5': {
    label: 'Squares ending in 5',
    blurb: 'For n5 × n5: multiply n by (n+1), then append 25.',
    example(p) {
      const n = Math.floor(p.a / 10);
      return `${p.a}² → ${n}×${n + 1} = ${n * (n + 1)}, append 25 → ${n * (n + 1)}25`;
    },
  },

  'division-inverse': {
    label: 'Division as inverse multiplication',
    blurb: `Ask "what number times the divisor gives the dividend?" instead of dividing directly.`,
    example(p) {
      return `${p.a} ÷ ${p.b}: think "${p.b} × ? = ${p.a}" → ${p.b} × ${p.correctAnswer} = ${p.a}, so the answer is ${p.correctAnswer}`;
    },
  },

  'estimation-division': {
    label: 'Estimation-based long division',
    blurb: 'Round the divisor and dividend to easy numbers, estimate, then refine.',
    example(p) {
      const roundedB = Math.round(p.b / 5) * 5 || p.b;
      const estimate = Math.round(p.a / roundedB);
      return `${p.a} ÷ ${p.b} ≈ ${p.a} ÷ ${roundedB} ≈ ${estimate}, then check: ${p.b}×${p.correctAnswer} = ${p.b * p.correctAnswer} (remainder ${p.a - p.b * p.correctAnswer})`;
    },
  },
};

function symbolFor(p) {
  return { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }[p.operation];
}

function decompose(n) {
  return {
    hundreds: Math.floor(n / 100),
    tens: Math.floor((n % 100) / 10),
    units: n % 10,
  };
}

function compensationExample(p) {
  const op = p.operation === 'addition' ? '+' : '−';
  // Prefer rounding whichever operand is closer to a multiple of 10.
  const aRound = roundTo10(p.a);
  const bRound = roundTo10(p.b);
  const roundA = Math.abs(aRound.delta) <= Math.abs(bRound.delta);
  if (p.operation === 'addition') {
    // rounding an addend to `target` means the addend equals target+delta,
    // so the sum becomes (other + target) adjusted by delta with its own sign.
    if (roundA) {
      const sign = aRound.delta >= 0 ? '+' : '−';
      return `${p.a} + ${p.b} = ${aRound.target} + ${p.b} ${sign} ${Math.abs(aRound.delta)} = ${aRound.target + p.b} ${sign} ${Math.abs(aRound.delta)} = ${p.correctAnswer}`;
    }
    const sign = bRound.delta >= 0 ? '+' : '−';
    return `${p.a} + ${p.b} = ${p.a} + ${bRound.target} ${sign} ${Math.abs(bRound.delta)} = ${p.a + bRound.target} ${sign} ${Math.abs(bRound.delta)} = ${p.correctAnswer}`;
  }
  // subtraction: round the subtrahend (b). Since b = target+delta, subtracting
  // b means subtracting target and then undoing delta with the opposite sign.
  const sign = bRound.delta >= 0 ? '−' : '+';
  return `${p.a} − ${p.b} = ${p.a} − ${bRound.target} ${sign} ${Math.abs(bRound.delta)} = ${p.a - bRound.target} ${sign} ${Math.abs(bRound.delta)} = ${p.correctAnswer}`;
}

function multCompensationExample(p) {
  // Round whichever operand sits near a multiple of ten, multiply by the
  // rounded value, then adjust for the rounding with the other operand.
  const aNear = nearRoundNumberLocal(p.a);
  const roundOperand = aNear ? p.a : p.b;
  const otherOperand = aNear ? p.b : p.a;
  const { target, delta } = roundTo10(roundOperand);
  const sign = delta >= 0 ? '+' : '−';
  const roundedProduct = target * otherOperand;
  const adjustAmount = Math.abs(delta) * otherOperand;
  const orderedExpr = aNear
    ? `(${target} ${sign} ${Math.abs(delta)})×${otherOperand}`
    : `${otherOperand}×(${target} ${sign} ${Math.abs(delta)})`;
  return `${p.a}×${p.b} = ${orderedExpr} = ${roundedProduct} ${sign} ${adjustAmount} = ${p.correctAnswer}`;
}

function nearRoundNumberLocal(n) {
  const rem = n % 10;
  return rem === 9 || rem === 1 || rem === 0;
}

/** Return { label, blurb, worked } for a problem, falling back gracefully. */
export function getTechniqueHint(problem) {
  const t = TECHNIQUES[problem.technique] || TECHNIQUES.recall;
  return {
    key: problem.technique,
    label: t.label,
    blurb: t.blurb,
    worked: t.example(problem),
  };
}

export { TECHNIQUES };
