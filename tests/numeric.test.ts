import { describe, expect, it } from 'vitest';
import { numericFunctions } from '../src/engine/numeric';
import { CalcError } from '../src/engine/types';
const fn = (name: string) => numericFunctions.find((f) => f.name === name)!;
const calc = (name: string, args: Record<string, any>) => fn(name).calculate(args, {});
function close(actual: any, expected: any, tolerance = 1e-9) {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
      tolerance * Math.max(1, Math.abs(expected)),
    );
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBe(expected.length);
    expected.forEach((e, i) => close(actual[i], e, tolerance));
  } else expect(actual).toEqual(expected);
}
const own = numericFunctions.filter((f) => !f.categories.includes('Finance'));
describe('numeric catalogue examples', () => {
  for (const f of numericFunctions)
    it(`${f.name}: independently stated expected result`, () =>
      close(
        f.calculate(f.example.args, f.example.context || {}),
        f.example.expected,
        f.example.tolerance,
      ));
  it('has unique names', () =>
    expect(new Set(numericFunctions.map((f) => f.name)).size).toBe(numericFunctions.length));
  it('has complete help and usable controls', () => {
    for (const f of own) {
      expect(f.description.length).toBeGreaterThan(15);
      expect(f.friendlyName.length).toBeGreaterThan(2);
      expect(f.testRefs.length).toBeGreaterThan(0);
      expect(f.compatibility.length).toBeGreaterThan(0);
    }
  });
});
describe('statistical domain and reference checks', () => {
  it('propagates explicit spreadsheet errors in paired ranges and products', () => {
    expect(() => calc('CORREL', { x: [1, { error: '#N/A' }, 3], y: [1, 2, 3] })).toThrow(CalcError);
    expect(() => calc('SUMPRODUCT', { array1: [1, { error: '#VALUE!' }], array2: [2, 3] })).toThrow(
      CalcError,
    );
  });
  it('preserves paired alignment when entries are blank', () =>
    expect(calc('SLOPE', { x: [1, null, 3, 4], y: [2, 900, 6, 8] })).toBe(2));
  it('returns all tied modes and the smallest single mode', () => {
    expect(calc('MODE.MULT', { data: [4, 2, 4, 2, 1] })).toEqual([2, 4]);
    expect(calc('MODE.SNGL', { data: [4, 2, 4, 2, 1] })).toBe(2);
  });
  // Probability reference values independently checked using SciPy 1.17 scipy.stats.
  it('uses Welch degrees of freedom rather than a pooled approximation', () =>
    close(
      calc('T.TEST', { array1: [1, 2, 3, 4, 5], array2: [2, 4, 8, 10], tails: 2, type: 3 }),
      0.20198340352417923,
      1e-8,
    ));
  it('supports all t-test forms and one-tailed probability', () => {
    close(
      calc('T.TEST', { array1: [1, 2, 4, 6], array2: [2, 4, 5, 8], tails: 2, type: 1 }),
      0.013846832988859045,
      1e-7,
    );
    const args = { array1: [1, 2, 3, 4], array2: [2, 4, 6, 8], type: 2 };
    close(calc('T.TEST', { ...args, tails: 1 }), calc('T.TEST', { ...args, tails: 2 }) / 2);
  });
  it('returns chi-square p-values for row and column vectors', () => {
    close(calc('CHISQ.TEST', { actual: [[10, 20, 30]], expected: [[20, 20, 20]] }), Math.exp(-5));
    close(calc('CHISQ.TEST', { actual: [10, 20, 30], expected: [20, 20, 20] }), Math.exp(-5));
  });
  it('uses a two-tailed F probability symmetric in sample order', () => {
    close(calc('F.TEST', { array1: [1, 2, 3], array2: [2, 4, 6] }), 0.4);
    close(calc('F.TEST', { array1: [2, 4, 6], array2: [1, 2, 3] }), 0.4);
  });
  it('supports multiple predictors and Excel coefficient ordering', () => {
    const x = [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      y = x.map(([a, b]) => 2 * a + 3 * b + 5);
    close(calc('LINEST', { y, x }), [[3, 2, 5]]);
    close(
      calc('TREND', {
        y,
        x,
        newX: [
          [3, 2],
          [2, 4],
        ],
      }),
      [17, 21],
    );
  });
  it('uses sequential predictor indices when X is omitted', () => {
    close(calc('LINEST', { y: [3, 5, 7, 9] }), [[2, 1]]);
    close(calc('TREND', { y: [3, 5, 7, 9] }), [3, 5, 7, 9]);
  });
  it('ignores numeric text and booleans in statistical observation ranges', () => {
    expect(calc('MEDIAN', { data: [1, '100', true, null, 3] })).toBe(2);
    expect(calc('VAR.P', { data: [1, '100', true, null, 3] })).toBe(1);
    expect(calc('SUMPRODUCT', { array1: [1, '2', true, null], array2: [2, 10, 20, 30] })).toBe(2);
  });
  it('supports zero intercept fits', () =>
    close(calc('LINEST', { y: [2, 4, 6], x: [1, 2, 3], constant: false }), [[2, 0]]));
  it('returns regression statistics with residual degrees of freedom', () => {
    const r = calc('LINEST', { y: [1, 3, 2, 5], x: [1, 2, 3, 4], stats: true });
    close(r[0], [[1.1, 0.0]][0]);
    close(r[2][0], 0.6914285714285714);
    expect(r[3][1]).toBe(2);
  });
  it('does not mutate input observations', () => {
    const x = [
        [10, 20],
        [20, 10],
      ],
      copy = structuredClone(x);
    calc('CHISQ.TEST', {
      actual: x,
      expected: [
        [15, 15],
        [15, 15],
      ],
    });
    expect(x).toEqual(copy);
  });
  it.each([
    ['MEDIAN', { data: [] }],
    ['STDEV.S', { data: [1] }],
    ['CORREL', { x: [1, 1], y: [1, 2] }],
    ['SLOPE', { x: [1], y: [2, 3] }],
    ['LARGE', { data: [1, 2], k: 3 }],
    ['PERCENTILE.INC', { data: [1, 2], k: 2 }],
    ['RANK.EQ', { data: [1, 2], number: 3 }],
    ['GEOMEAN', { data: [0, 2] }],
    ['HARMEAN', { data: [-1, 2] }],
    ['SKEW', { data: [1, 1, 1] }],
    ['KURT', { data: [1, 2, 3] }],
    ['TRIMMEAN', { data: [1, 2], percent: 1 }],
    ['PERCENTRANK.INC', { data: [1, 2], x: 3 }],
    ['FREQUENCY', { data: [1, 2], bins: [3, 1] }],
    ['SUMPRODUCT', { array1: [1, 2], array2: [1] }],
    [
      'LINEST',
      {
        y: [1, 2, 3],
        x: [
          [1, 1],
          [2, 2],
          [3, 3],
        ],
      },
    ],
    ['GROWTH', { y: [1, 0, 2], x: [1, 2, 3] }],
    ['CHISQ.TEST', { actual: [1, 2], expected: [0, 2] }],
    ['T.TEST', { array1: [1, 1], array2: [1, 1], type: 2 }],
    ['F.TEST', { array1: [1, 1], array2: [1, 2] }],
    ['NORM.DIST', { sd: 0 }],
    ['NORM.INV', { probability: 1 }],
    ['BINOM.DIST', { trials: 2, successes: 3 }],
    ['POISSON.DIST', { mean: 0 }],
    ['CONFIDENCE.T', { alpha: 1 }],
    ['Z.TEST', { data: [1, 2], sigma: 0 }],
  ] as [string, Record<string, any>][])('%s validates invalid inputs', (name, args) =>
    expect(() => calc(name, args)).toThrow(CalcError),
  );
});
describe('distribution tail and large-count accuracy', () => {
  const relative = (actual: number, expected: number) =>
    expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-7);
  // Independent SciPy scipy.stats reference values, including cases that fail upstream jStat.
  it('retains small normal tails and accurate extreme quantiles', () => {
    relative(calc('NORM.DIST', { x: -10, mean: 0, sd: 1, cumulative: true }), 7.61985302416047e-24);
    close(calc('NORM.INV', { probability: 1e-30, mean: 0, sd: 1 }), -11.464024688443613, 1e-12);
  });
  it('retains chi-square and F-test upper tails', () => {
    relative(
      calc('CHISQ.TEST', { actual: [0, 100, 50], expected: [50, 50, 50] }),
      1.9287498479639183e-22,
    );
    relative(calc('F.TEST', { array1: [1, 2, 3], array2: [1e10, 2e10, 3e10] }), 2e-20);
  });
  it('calculates binomial probabilities without overflowing combinations', () => {
    close(
      calc('BINOM.DIST', { trials: 1000, successes: 500, probability: 0.5, cumulative: false }),
      0.025225018178360804,
    );
    relative(
      calc('BINOM.DIST', { trials: 1000, successes: 400, probability: 0.5, cumulative: true }),
      1.3642320780329735e-10,
    );
  });
  it('calculates large Poisson counts in log space', () => {
    close(calc('POISSON.DIST', { x: 1000, mean: 1000, cumulative: false }), 0.01261461134870819);
    close(calc('POISSON.DIST', { x: 1000, mean: 1000, cumulative: true }), 0.508409367168506);
  });
  it('handles deterministic binomial endpoints', () => {
    expect(calc('BINOM.DIST', { trials: 0, successes: 0, probability: 0, cumulative: false })).toBe(
      1,
    );
    expect(calc('BINOM.DIST', { trials: 10, successes: 3, probability: 1, cumulative: true })).toBe(
      0,
    );
  });
});
describe('engineering edge cases', () => {
  it('avoids decimal representation artifacts in truncation and multiples', () => {
    close(calc('CEILING.MATH', { number: 0.07, significance: 0.01 }), 0.07);
    close(calc('FLOOR.MATH', { number: 0.3, significance: 0.1 }), 0.3);
    expect(calc('TRUNC', { number: 1.15, digits: 2 })).toBe(1.15);
    expect(calc('TRUNC', { number: -1.15, digits: 2 })).toBe(-1.15);
    expect(calc('TRUNC', { number: 1234.56, digits: -2 })).toBe(1200);
  });
  it('uses Excel negative rounding conventions', () => {
    expect(calc('CEILING.MATH', { number: -4.3, significance: 2, mode: 1 })).toBe(-6);
    expect(calc('FLOOR.MATH', { number: -4.3, significance: 2, mode: 1 })).toBe(-4);
    expect(calc('MROUND', { number: -10, multiple: -3 })).toBe(-9);
  });
  it('handles zero matrices and rejects nonnumeric matrix cells', () => {
    expect(
      calc('MDETERM', {
        matrix: [
          [0, 0],
          [0, 0],
        ],
      }),
    ).toBe(0);
    expect(
      calc('MMULT', {
        matrix1: [
          [0, 0],
          [0, 0],
        ],
        matrix2: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(() =>
      calc('MINVERSE', {
        matrix: [
          [0, 0],
          [0, 0],
        ],
      }),
    ).toThrow(CalcError);
    expect(() => calc('MMULT', { matrix1: [[null]], matrix2: [[2]] })).toThrow(CalcError);
    expect(() => calc('MDETERM', { matrix: [['1']] })).toThrow(CalcError);
  });
  it('calculates inverse and multiplication consistently', () => {
    const a = [
        [4, 7],
        [2, 6],
      ],
      inv = calc('MINVERSE', { matrix: a });
    close(calc('MMULT', { matrix1: a, matrix2: inv }), [
      [1, 0],
      [0, 1],
    ]);
    expect(
      calc('MDETERM', {
        matrix: [
          [1, 2],
          [2, 4],
        ],
      }),
    ).toBe(0);
  });
  it('supports complex signs, implicit coefficients, exponent notation, and j', () => {
    expect(calc('IMSUM', { data: ['i', '-i'] })).toBe('0');
    expect(calc('IMPRODUCT', { data: ['2j', '3j'] })).toBe('-6');
    expect(calc('IMSUM', { data: ['1e-3+2e-2i', '2'] })).toBe('2.001+0.02i');
  });
  it('implements Excel signed base conversion', () => {
    expect(calc('DEC2BIN', { number: -1 })).toBe('1111111111');
    expect(calc('BIN2DEC', { number: '1000000000' })).toBe(-512);
    expect(calc('DEC2HEX', { number: -1 })).toBe('FFFFFFFFFF');
    expect(calc('HEX2DEC', { number: '8000000000' })).toBe(-549755813888);
    expect(calc('DEC2HEX', { number: 15, places: 3 })).toBe('00F');
  });
  it('generates random values within bounds and correct dimensions', () => {
    for (let i = 0; i < 20; i++) {
      const v = calc('RAND', {});
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const a = calc('RANDARRAY', { rows: 3, columns: 4, min: -2, max: 2, integer: true });
    expect(a).toHaveLength(3);
    for (const row of a) {
      expect(row).toHaveLength(4);
      for (const v of row) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });
  it('supports temperature conversion', () =>
    close(calc('CONVERT', { number: 100, from: 'C', to: 'F' }), 212));
  it.each([
    [
      'MINVERSE',
      {
        matrix: [
          [1, 2],
          [2, 4],
        ],
      },
    ],
    ['MMULT', { matrix1: [[1, 2]], matrix2: [[1, 2]] }],
    ['MDETERM', { matrix: [[1, 2]] }],
    ['SQRT', { number: -1 }],
    ['LN', { number: 0 }],
    ['LOG', { number: 1, base: 1 }],
    ['POWER', { number: 0, power: -1 }],
    ['GCD', { data: [-1, 2] }],
    ['FACT', { number: 171 }],
    ['COMBIN', { number: 2, chosen: 3 }],
    ['PERMUT', { number: 2, chosen: 3 }],
    ['MROUND', { number: -1, multiple: 2 }],
    ['CONVERT', { number: 1, from: 'm', to: 'kg' }],
    ['RANDBETWEEN', { bottom: 2, top: 1 }],
    ['RANDARRAY', { rows: 0 }],
    ['IMSUM', { data: ['2i', '3j'] }],
    ['COMPLEX', { real: 1, imaginary: 2, suffix: 'k' }],
    ['DEC2BIN', { number: 512 }],
    ['DEC2HEX', { number: 15, places: 0 }],
    ['BIN2DEC', { number: '1012' }],
    ['HEX2DEC', { number: '0xFF' }],
  ] as [string, Record<string, any>][])('%s validates invalid inputs', (name, args) =>
    expect(() => calc(name, args)).toThrow(CalcError),
  );
});
