import type { FunctionDef, InputDef } from './types';
import * as formula from '@formulajs/formulajs';
import { financeFunctions } from './finance';
import {
  covariance,
  dataset,
  determinant,
  fail,
  finite,
  flatten,
  integer,
  inverse,
  jStat,
  matrix,
  mean,
  numeric,
  numericMatrix,
  normalCDF,
  normalInverse,
  gammaUpper,
  studentTail,
  paired,
  percentile,
  regressionInputs,
  regress,
  strictVector,
  sumsq,
  variance,
} from './numeric-helpers';
const stats = 'Statistics',
  eng = 'Engineering';
const data = (
  key = 'data',
  label = 'Numeric data',
  value: any = [10, 20, 30, 40, 50],
): InputDef => ({ key, label, type: 'data', required: true, default: value });
const num = (key: string, label: string, value = 1): InputDef => ({
  key,
  label,
  type: 'number',
  required: true,
  default: value,
});
const bool = (key: string, label: string, value = true): InputDef => ({
  key,
  label,
  type: 'boolean',
  default: value,
});
const select = (
  key: string,
  label: string,
  options: (string | { label: string; value: number | string })[],
  value: any,
): InputDef => ({ key, label, type: 'select', options, default: value });
const text = (key: string, label: string, value = ''): InputDef => ({
  key,
  label,
  type: 'text',
  default: value,
  required: true,
});
function def(
  name: string,
  friendlyName: string,
  category: string,
  inputs: InputDef[],
  run: (a: any) => any,
  args: Record<string, any>,
  expected: any,
  description: string,
  tolerance = 1e-9,
): FunctionDef {
  const defaults = Object.fromEntries(
    inputs.filter((i) => i.default !== undefined).map((i) => [i.key, i.default]),
  );
  return {
    name,
    friendlyName,
    categories: [category],
    aliases: [friendlyName.toLowerCase(), ...(name === 'PMT' ? ['qist'] : [])],
    description,
    inputs,
    output: 'Number, text, or result array',
    defaults,
    example: { args, expected, tolerance },
    compatibility: [
      'Excel-compatible numeric conventions; blanks and text in observation ranges are ignored unless the operation requires a strict numeric matrix.',
    ],
    testRefs: ['tests/numeric.test.ts'],
    calculate: (args) => finite(run({ ...defaults, ...args })),
  };
}
const functions: FunctionDef[] = [];
const add = (
  name: string,
  title: string,
  inputs: InputDef[],
  calc: (a: any) => any,
  args: Record<string, any>,
  expected: any,
  description: string,
  tolerance = 1e-9,
) => functions.push(def(name, title, stats, inputs, calc, args, expected, description, tolerance));
const unaryStats: [string, string, (x: number[]) => any, any][] = [
  ['MEDIAN', 'Middle value', (a) => percentile(a, 0.5), 3],
  [
    'MODE.SNGL',
    'Most common value',
    (a) => {
      const counts = new Map<number, number>();
      a.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
      const max = Math.max(...counts.values());
      if (max === 1) fail('#N/A', 'No value occurs more than once.');
      return [...counts]
        .filter(([, v]) => v === max)
        .map(([v]) => v)
        .sort((a, b) => a - b)[0];
    },
    3,
  ],
  [
    'MODE.MULT',
    'All most common values',
    (a) => {
      const counts = new Map<number, number>();
      a.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
      const max = Math.max(...counts.values());
      if (max === 1) fail('#N/A', 'No value occurs more than once.');
      return [...counts]
        .filter(([, v]) => v === max)
        .map(([v]) => v)
        .sort((a, b) => a - b);
    },
    [3],
  ],
  ['STDEV.S', 'Sample standard deviation', (a) => Math.sqrt(variance(a)), Math.sqrt(2)],
  [
    'STDEV.P',
    'Population standard deviation',
    (a) => Math.sqrt(variance(a, false)),
    Math.sqrt(1.6),
  ],
  ['VAR.S', 'Sample variance', (a) => variance(a), 2],
  ['VAR.P', 'Population variance', (a) => variance(a, false), 1.6],
  [
    'GEOMEAN',
    'Geometric mean',
    (a) => {
      if (a.some((v) => v <= 0)) fail('#NUM!', 'Geometric mean requires positive values.');
      return Math.exp(mean(a.map(Math.log)));
    },
    Math.pow(135, 1 / 5),
  ],
  [
    'HARMEAN',
    'Harmonic mean',
    (a) => {
      if (a.some((v) => v <= 0)) fail('#NUM!', 'Harmonic mean requires positive values.');
      return a.length / a.reduce((s, v) => s + 1 / v, 0);
    },
    5 / (1 + 1 / 3 + 1 / 3 + 1 / 3 + 1 / 5),
  ],
  [
    'SKEW',
    'Sample skewness',
    (a) => {
      if (a.length < 3) fail('#DIV/0!', 'Skewness requires three observations.');
      const s = Math.sqrt(variance(a));
      if (!s) fail('#DIV/0!', 'Skewness needs nonzero variance.');
      const m = mean(a),
        n = a.length;
      return (n / ((n - 1) * (n - 2))) * a.reduce((s0, v) => s0 + ((v - m) / s) ** 3, 0);
    },
    0,
  ],
  [
    'KURT',
    'Sample excess kurtosis',
    (a) => {
      const n = a.length;
      if (n < 4) fail('#DIV/0!', 'Kurtosis requires four observations.');
      const s = Math.sqrt(variance(a));
      if (!s) fail('#DIV/0!', 'Kurtosis needs nonzero variance.');
      const m = mean(a);
      return (
        ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
          a.reduce((s0, v) => s0 + ((v - m) / s) ** 4, 0) -
        (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
      );
    },
    2,
  ],
];
for (const [name, title, calc, expected] of unaryStats)
  add(
    name,
    title,
    [data()],
    (a) => calc(dataset(a.data)),
    { data: [1, 3, 3, 3, 5] },
    expected,
    `${title} of numeric observations. Sample functions use the n−1 denominator; text and blanks are ignored.`,
  );
for (const [name, asc] of [
  ['LARGE', false],
  ['SMALL', true],
] as const)
  add(
    name,
    asc ? 'Nth smallest value' : 'Nth largest value',
    [data(), num('k', 'Position (1 = first)', 1)],
    (a) => {
      const x = dataset(a.data).sort((a, b) => (asc ? a - b : b - a)),
        k = integer(a.k, 'Position', 1, x.length);
      return x[k - 1];
    },
    { data: [9, 2, 7], k: 2 },
    7,
    'Returns the value at a one-based sorted position.',
  );
for (const name of ['RANK.EQ', 'RANK.AVG'])
  add(
    name,
    name === 'RANK.EQ' ? 'Rank with shared ties' : 'Rank with averaged ties',
    [
      num('number', 'Value to rank', 20),
      data(),
      select(
        'order',
        'Rank direction',
        [
          { label: 'Largest first', value: 0 },
          { label: 'Smallest first', value: 1 },
        ],
        0,
      ),
    ],
    (a) => {
      const x = dataset(a.data),
        n = numeric(a.number);
      if (!x.includes(n)) fail('#N/A', 'The value is not in the data.');
      const before = x.filter((v) => (Number(a.order) === 0 ? v > n : v < n)).length;
      return before + 1 + (name === 'RANK.AVG' ? (x.filter((v) => v === n).length - 1) / 2 : 0);
    },
    { data: [10, 20, 20, 30], number: 20, order: 0 },
    name === 'RANK.EQ' ? 2 : 2.5,
    'Ranks a value with tied ranks shared or averaged.',
  );
add(
  'PERCENTILE.INC',
  'Percentile including endpoints',
  [data(), num('k', 'Percentile fraction (0 to 1)', 0.5)],
  (a) => percentile(dataset(a.data), numeric(a.k)),
  { data: [1, 2, 3, 4], k: 0.25 },
  1.75,
  'Interpolated percentile with both endpoints included.',
);
add(
  'QUARTILE.INC',
  'Quartile including endpoints',
  [data(), num('quart', 'Quartile (0 to 4)', 1)],
  (a) => percentile(dataset(a.data), integer(a.quart, 'Quartile', 0, 4) / 4),
  { data: [1, 2, 3, 4], quart: 1 },
  1.75,
  'Returns minimum, quartiles, or maximum using inclusive interpolation.',
);
for (const name of ['CORREL', 'COVARIANCE.S', 'COVARIANCE.P', 'SLOPE', 'INTERCEPT', 'RSQ', 'STEYX'])
  add(
    name,
    (
      {
        CORREL: 'Correlation coefficient',
        'COVARIANCE.S': 'Sample covariance',
        'COVARIANCE.P': 'Population covariance',
        SLOPE: 'Regression slope',
        INTERCEPT: 'Regression intercept',
        RSQ: 'Regression R squared',
        STEYX: 'Regression standard error',
      } as any
    )[name],
    [data('y', 'Y observations', [2, 4, 6]), data('x', 'X observations', [1, 2, 3])],
    (a) => {
      const [y, x] = paired(a.y, a.x, name === 'COVARIANCE.P' ? 1 : 2);
      const vx = variance(x, false),
        vy = variance(y, false),
        cov = covariance(x, y, false);
      if (name === 'COVARIANCE.S') return covariance(x, y);
      if (name === 'COVARIANCE.P') return cov;
      if (!vx) fail('#DIV/0!', 'X values have zero variance.');
      if (name === 'SLOPE') return cov / vx;
      if (name === 'INTERCEPT') return mean(y) - (cov / vx) * mean(x);
      if (name === 'STEYX') {
        if (y.length < 3) fail('#DIV/0!', 'Standard error needs three observations.');
        const slope = cov / vx,
          b = mean(y) - slope * mean(x);
        return Math.sqrt(sumsq(y.map((v, i) => v - b - slope * x[i])) / (y.length - 2));
      }
      if (!vy) fail('#DIV/0!', 'Y values have zero variance.');
      const r = cov / Math.sqrt(vx * vy);
      return name === 'RSQ' ? r * r : r;
    },
    { y: [2, 4, 6], x: [1, 2, 3] },
    (
      {
        CORREL: 1,
        'COVARIANCE.S': 2,
        'COVARIANCE.P': 4 / 3,
        SLOPE: 2,
        INTERCEPT: 0,
        RSQ: 1,
        STEYX: 0,
      } as any
    )[name],
    'Uses corresponding numeric pairs, ignoring a pair when either entry is text or blank.',
  );
add(
  'FREQUENCY',
  'Frequency by upper bounds',
  [data(), data('bins', 'Ascending upper bounds', [10, 30, 50])],
  (a) => {
    const values = dataset(a.data),
      bins = dataset(a.bins);
    if (bins.some((v, i) => i > 0 && v < bins[i - 1]))
      fail('#VALUE!', 'Bin boundaries must be in ascending order.');
    const out = Array(bins.length + 1).fill(0);
    for (const v of values) {
      const i = bins.findIndex((b) => v <= b);
      out[i < 0 ? bins.length : i]++;
    }
    return out;
  },
  { data: [1, 2, 4, 9], bins: [2, 5] },
  [2, 1, 1],
  'Counts observations in bins and includes an extra count above the final upper bound.',
);
add(
  'SUMPRODUCT',
  'Sum of paired products',
  [
    data('array1', 'First numeric range', [1, 2, 3]),
    data('array2', 'Second numeric range', [4, 5, 6]),
  ],
  (a) => {
    const x = matrix(a.array1),
      y = matrix(a.array2);
    for (const cell of [...x.flat(), ...y.flat()])
      if (cell && typeof cell === 'object' && 'error' in cell)
        fail(cell.error, cell.message || cell.error);
    if (x.length !== y.length || x[0].length !== y[0].length)
      fail('#VALUE!', 'Ranges must have equal dimensions.');
    return x.reduce(
      (s, row, i) =>
        s +
        row.reduce(
          (ss, v, j) =>
            ss + (typeof v === 'number' ? v : 0) * (typeof y[i][j] === 'number' ? y[i][j] : 0),
          0,
        ),
      0,
    );
  },
  { array1: [1, 2, 3], array2: [4, 5, 6] },
  32,
  'Multiplies corresponding cells then adds them. Non-numeric cells count as zero.',
);
add(
  'TRIMMEAN',
  'Average after trimming extremes',
  [data(), num('percent', 'Fraction of observations to remove', 0.2)],
  (a) => {
    const x = dataset(a.data).sort((a, b) => a - b),
      p = numeric(a.percent);
    if (p < 0 || p >= 1) fail('#NUM!', 'Trim fraction must be at least 0 and less than 1.');
    const each = Math.floor((x.length * p) / 2);
    return mean(x.slice(each, x.length - each));
  },
  { data: [1, 2, 3, 4, 100], percent: 0.4 },
  3,
  'Removes equal numbers from both ends; the total trimmed count is rounded down to an even number.',
);
add(
  'PERCENTRANK.INC',
  'Relative percentile rank',
  [data(), num('x', 'Value', 2), num('significance', 'Decimal precision', 3)],
  (a) => {
    const s = dataset(a.data).sort((a, b) => a - b),
      x = numeric(a.x),
      digits = integer(a.significance, 'Significance', 1, 15);
    if (x < s[0] || x > s[s.length - 1]) fail('#N/A', 'Value is outside the data range.');
    if (s.length === 1) return 0;
    let rank = s.indexOf(x);
    if (rank < 0) {
      const hi = s.findIndex((v) => v > x),
        lo = hi - 1;
      rank = lo + (x - s[lo]) / (s[hi] - s[lo]);
    }
    const scale = 10 ** digits;
    return Math.trunc((rank / (s.length - 1)) * scale + 1e-12) / scale;
  },
  { data: [1, 2, 3, 4], x: 2, significance: 3 },
  0.333,
  'Returns the inclusive relative rank, interpolated and truncated to the selected precision.',
);
const regInputs = [
  data('y', 'Known Y observations', [2, 4, 6]),
  { ...data('x', 'Known X predictors', [1, 2, 3]), required: false, default: undefined },
  bool('constant', 'Fit an intercept', true),
];
function reg(a: any, log = false) {
  const [y, x] = regressionInputs(a.y, a.x);
  if (log && y.some((v) => v <= 0))
    fail('#NUM!', 'Exponential regression requires strictly positive Y values.');
  return { x, y, fit: regress(log ? y.map(Math.log) : y, x, Boolean(a.constant)) };
}
add(
  'FORECAST.LINEAR',
  'Predict from a linear trend',
  [
    num('newX', 'X value to predict', 4),
    data('y', 'Known Y', [2, 4, 6]),
    data('x', 'Known X', [1, 2, 3]),
  ],
  (a) => {
    const [y, x] = paired(a.y, a.x);
    const fit = regress(
      y,
      x.map((v) => [v]),
    );
    return fit.intercept + fit.coefficients[0] * numeric(a.newX);
  },
  { newX: 4, y: [2, 4, 6], x: [1, 2, 3] },
  8,
  'Fits one predictor with an intercept and forecasts a new value.',
);
for (const [name, log] of [
  ['TREND', false],
  ['GROWTH', true],
] as const)
  add(
    name,
    log ? 'Predict exponential growth' : 'Predict a linear trend',
    [
      ...regInputs,
      { key: 'newX', label: 'New predictor rows (optional)', type: 'matrix', required: false },
    ],
    (a) => {
      const { fit, x } = reg(a, log);
      let next = numericMatrix(a.newX ?? x);
      if (next.length === 1 && x[0].length === 1) next = next[0].map((v) => [v]);
      if (next[0].length !== x[0].length)
        fail('#VALUE!', 'New predictor rows need the same number of columns as the training data.');
      return next.map((r) => {
        const v = fit.intercept + r.reduce((s, v, j) => s + v * fit.coefficients[j], 0);
        return log ? Math.exp(v) : v;
      });
    },
    log
      ? { y: [2, 4, 8], x: [1, 2, 3], newX: [[4], [5]] }
      : { y: [2, 4, 6], x: [1, 2, 3], newX: [[4], [5]] },
    log ? [16, 32] : [8, 10],
    'Supports one or multiple predictor columns. Each row is one observation; the intercept can be fixed at zero.',
  );
for (const [name, log] of [
  ['LINEST', false],
  ['LOGEST', true],
] as const)
  add(
    name,
    log ? 'Exponential regression coefficients' : 'Linear regression coefficients',
    [...regInputs, bool('stats', 'Include regression statistics', false)],
    (a) => {
      const { fit, x } = reg(a, log),
        coeff = [...fit.coefficients].reverse(),
        first = [...coeff, fit.intercept].map((v) => (log ? Math.exp(v) : v));
      if (!a.stats) return [first];
      if (fit.df <= 0)
        fail('#NUM!', 'Regression statistics require positive residual degrees of freedom.');
      const err = { error: '#N/A' },
        pad = (r: any[]) => [...r, ...Array(Math.max(0, x[0].length + 1 - r.length)).fill(err)];
      return [
        first,
        [...fit.se].reverse().concat(fit.interceptSE),
        pad([fit.r2, fit.sey]),
        pad([Number.isFinite(fit.f) ? fit.f : { error: '#DIV/0!' }, fit.df]),
        pad([fit.ssreg, fit.ssres]),
      ];
    },
    log
      ? { y: [2, 4, 8], x: [1, 2, 3], stats: false }
      : { y: [2, 4, 6], x: [1, 2, 3], stats: false },
    log ? [[2, 1]] : [[2, 0]],
    'Multivariate least squares with optional five-row Excel statistics. Coefficients are returned in reverse predictor order followed by the intercept. Redundant predictors produce a clear error.',
  );
add(
  'T.TEST',
  'Compare two means (t test)',
  [
    data('array1', 'First sample', [1, 2, 3, 4]),
    data('array2', 'Second sample', [2, 3, 4, 5]),
    select(
      'tails',
      'Number of tails',
      [
        { label: 'One tailed', value: 1 },
        { label: 'Two tailed', value: 2 },
      ],
      2,
    ),
    select(
      'type',
      'Sample relationship',
      [
        { label: 'Paired observations', value: 1 },
        { label: 'Independent, equal variance', value: 2 },
        { label: 'Independent, unequal variance (Welch)', value: 3 },
      ],
      3,
    ),
  ],
  (a) => {
    const type = integer(a.type, 'Test type', 1, 3),
      tails = integer(a.tails, 'Tails', 1, 2);
    let x = dataset(a.array1, 2),
      y = dataset(a.array2, 2),
      t: number,
      df: number;
    if (type === 1) {
      [x, y] = paired(a.array1, a.array2);
      const d = x.map((v, i) => v - y[i]),
        v = variance(d);
      if (!v) fail('#DIV/0!', 'Paired differences have zero variance.');
      t = Math.abs(mean(d)) / Math.sqrt(v / d.length);
      df = d.length - 1;
    } else {
      const vx = variance(x),
        vy = variance(y);
      if (type === 2) {
        df = x.length + y.length - 2;
        const pooled = ((x.length - 1) * vx + (y.length - 1) * vy) / df;
        t = Math.abs(mean(x) - mean(y)) / Math.sqrt(pooled * (1 / x.length + 1 / y.length));
      } else {
        const sx = vx / x.length,
          sy = vy / y.length;
        t = Math.abs(mean(x) - mean(y)) / Math.sqrt(sx + sy);
        df = (sx + sy) ** 2 / ((sx * sx) / (x.length - 1) + (sy * sy) / (y.length - 1));
      }
    }
    if (!Number.isFinite(t) || !Number.isFinite(df))
      fail('#DIV/0!', 'The test requires nonzero sampling variance.');
    return Math.max(0, Math.min(1, tails * studentTail(t, df)));
  },
  { array1: [1, 2, 3], array2: [1, 2, 3], tails: 2, type: 2 },
  1,
  'Returns a p-value for paired, pooled equal-variance, or Welch unequal-variance t tests. One-tailed results use the absolute t statistic, matching Excel; significance does not establish causation.',
);
add(
  'CHISQ.TEST',
  'Compare observed and expected counts',
  [
    {
      ...data('actual', 'Observed counts', [
        [10, 20],
        [20, 10],
      ]),
      type: 'matrix',
    },
    {
      ...data('expected', 'Expected counts', [
        [15, 15],
        [15, 15],
      ]),
      type: 'matrix',
    },
  ],
  (a) => {
    const actual = numericMatrix(a.actual),
      expected = numericMatrix(a.expected);
    if (actual.length !== expected.length || actual[0].length !== expected[0].length)
      fail('#N/A', 'Observed and expected tables must have identical dimensions.');
    let chi = 0;
    actual.forEach((row, i) =>
      row.forEach((v, j) => {
        if (v < 0 || expected[i][j] <= 0)
          fail('#NUM!', 'Observed counts must be nonnegative; expected counts must be positive.');
        chi += (v - expected[i][j]) ** 2 / expected[i][j];
      }),
    );
    const rows = actual.length,
      cols = actual[0].length,
      df = rows === 1 ? cols - 1 : cols === 1 ? rows - 1 : (rows - 1) * (cols - 1);
    if (df < 1) fail('#NUM!', 'The table has no degrees of freedom.');
    return gammaUpper(df / 2, chi / 2);
  },
  {
    actual: [
      [10, 20],
      [20, 10],
    ],
    expected: [
      [15, 15],
      [15, 15],
    ],
  },
  0.009823274507519247,
  'Returns the upper-tail chi-square p-value using supplied expected counts. It does not infer expected counts or establish causation.',
);
add(
  'F.TEST',
  'Compare two variances',
  [data('array1', 'First sample', [1, 2, 3]), data('array2', 'Second sample', [2, 4, 6])],
  (a) => {
    const x = dataset(a.array1, 2),
      y = dataset(a.array2, 2),
      v1 = variance(x),
      v2 = variance(y);
    if (!v1 || !v2) fail('#DIV/0!', 'Both samples need nonzero variance.');
    const f = v1 / v2,
      d1 = x.length - 1,
      d2 = y.length - 1;
    const lower = jStat.ibeta((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2),
      upper = jStat.ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
    return Math.min(1, 2 * Math.min(lower, upper));
  },
  { array1: [1, 2, 3], array2: [2, 4, 6] },
  0.4,
  'Returns the two-tailed F-test p-value, with sample variances and n−1 degrees of freedom; assumes normal populations.',
);
add(
  'Z.TEST',
  'Test a population mean',
  [
    data(),
    num('x', 'Hypothesized population mean', 25),
    {
      ...num('sigma', 'Known population standard deviation (optional)', 10),
      required: false,
      default: undefined,
    },
  ],
  (a) => {
    const x = dataset(a.data, 2),
      s =
        a.sigma === undefined || a.sigma === '' || a.sigma === null
          ? Math.sqrt(variance(x))
          : numeric(a.sigma);
    if (s <= 0) fail('#NUM!', 'Standard deviation must be positive.');
    return normalCDF(-(mean(x) - numeric(a.x)) / (s / Math.sqrt(x.length)));
  },
  { data: [1, 2, 3, 4], x: 2.5, sigma: 1 },
  0.5,
  'Returns the one-tailed upper probability for a population mean; leave sigma empty to use the sample standard deviation.',
);
add(
  'STANDARDIZE',
  'Convert to a z score',
  [num('x', 'Value', 70), num('mean', 'Population mean', 50), num('sd', 'Standard deviation', 10)],
  (a) => {
    const sd = numeric(a.sd);
    if (sd <= 0) fail('#NUM!', 'Standard deviation must be positive.');
    return (numeric(a.x) - numeric(a.mean)) / sd;
  },
  { x: 70, mean: 50, sd: 10 },
  2,
  'Distance from the mean in standard deviations.',
);
add(
  'NORM.DIST',
  'Normal probability or density',
  [
    num('x', 'Value', 0),
    num('mean', 'Mean', 0),
    num('sd', 'Standard deviation', 1),
    bool('cumulative', 'Cumulative probability', true),
  ],
  (a) => {
    const sd = numeric(a.sd);
    if (sd <= 0) fail('#NUM!', 'Standard deviation must be positive.');
    const z = (numeric(a.x) - numeric(a.mean)) / sd;
    return a.cumulative ? normalCDF(z) : Math.exp((-z * z) / 2) / (sd * Math.sqrt(2 * Math.PI));
  },
  { x: 0, mean: 0, sd: 1, cumulative: true },
  0.5,
  'Returns cumulative normal probability or probability density.',
);
add(
  'NORM.INV',
  'Normal distribution quantile',
  [
    num('probability', 'Probability', 0.975),
    num('mean', 'Mean', 0),
    num('sd', 'Standard deviation', 1),
  ],
  (a) => {
    const p = numeric(a.probability),
      sd = numeric(a.sd);
    if (p <= 0 || p >= 1 || sd <= 0)
      fail(
        '#NUM!',
        'Probability must lie strictly between 0 and 1 and standard deviation must be positive.',
      );
    return numeric(a.mean) + sd * normalInverse(p);
  },
  { probability: 0.975, mean: 0, sd: 1 },
  1.959963984540054,
  'Returns a normal-distribution quantile.',
  1e-7,
);
add(
  'BINOM.DIST',
  'Binomial probability',
  [
    num('successes', 'Number of successes', 2),
    num('trials', 'Number of trials', 4),
    num('probability', 'Success probability', 0.5),
    bool('cumulative', 'Cumulative probability', false),
  ],
  (a) => {
    const n = integer(a.trials, 'Trials', 0, 100000),
      k = integer(a.successes, 'Successes', 0, n),
      p = numeric(a.probability);
    if (p < 0 || p > 1) fail('#NUM!', 'Probability must be between 0 and 1.');
    if (p === 0) return a.cumulative || k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    if (a.cumulative) return k === n ? 1 : jStat.ibeta(1 - p, n - k, k + 1);
    return Math.exp(
      jStat.gammaln(n + 1) -
        jStat.gammaln(k + 1) -
        jStat.gammaln(n - k + 1) +
        k * Math.log(p) +
        (n - k) * Math.log1p(-p),
    );
  },
  { successes: 2, trials: 4, probability: 0.5, cumulative: false },
  0.375,
  'Probability of an exact or cumulative number of successes in independent trials.',
);
add(
  'POISSON.DIST',
  'Poisson count probability',
  [
    num('x', 'Event count', 2),
    num('mean', 'Expected count', 3),
    bool('cumulative', 'Cumulative probability', false),
  ],
  (a) => {
    const x = integer(a.x, 'Event count', 0, 100000),
      m = numeric(a.mean);
    if (m <= 0) fail('#NUM!', 'Expected count must be positive.');
    return a.cumulative
      ? gammaUpper(x + 1, m)
      : Math.exp(x * Math.log(m) - m - jStat.gammaln(x + 1));
  },
  { x: 2, mean: 3, cumulative: false },
  4.5 * Math.exp(-3),
  'Returns exact or cumulative Poisson probability.',
);
add(
  'CONFIDENCE.T',
  'Confidence interval margin (t)',
  [
    num('alpha', 'Significance level', 0.05),
    num('sd', 'Sample standard deviation', 2),
    num('size', 'Sample size', 10),
  ],
  (a) => {
    const alpha = numeric(a.alpha),
      sd = numeric(a.sd),
      n = integer(a.size, 'Sample size', 2);
    if (alpha <= 0 || alpha >= 1 || sd <= 0)
      fail('#NUM!', 'Alpha must be between 0 and 1 and standard deviation positive.');
    return (-jStat.studentt.inv(alpha / 2, n - 1) * sd) / Math.sqrt(n);
  },
  { alpha: 0.05, sd: 2, size: 10 },
  1.430713811941,
  'Returns the half-width of a two-sided confidence interval for a mean under t-distribution assumptions.',
  1e-7,
);
const addEngineering = (
  name: string,
  title: string,
  inputs: InputDef[],
  calc: (a: any) => any,
  args: Record<string, any>,
  expected: any,
  description: string,
  tolerance = 1e-9,
) => functions.push(def(name, title, eng, inputs, calc, args, expected, description, tolerance));
for (const name of ['CEILING.MATH', 'FLOOR.MATH'])
  addEngineering(
    name,
    name === 'CEILING.MATH' ? 'Round up to a multiple' : 'Round down to a multiple',
    [
      num('number', 'Number', -4.3),
      num('significance', 'Multiple', 2),
      num('mode', 'Negative rounding mode (0 = default)', 0),
    ],
    (a) => {
      const v = numeric(a.number),
        s = Math.abs(numeric(a.significance)),
        mode = numeric(a.mode);
      if (!s) return 0;
      let quotient = v / s;
      const nearest = Math.round(quotient);
      if (Math.abs(quotient - nearest) <= 4 * Number.EPSILON * Math.max(1, Math.abs(quotient)))
        quotient = nearest;
      if (v >= 0) return (name === 'CEILING.MATH' ? Math.ceil(quotient) : Math.floor(quotient)) * s;
      const toward = name === 'CEILING.MATH' ? mode === 0 : mode !== 0;
      return (toward ? Math.ceil(quotient) : Math.floor(quotient)) * s;
    },
    { number: -4.3, significance: 2, mode: 0 },
    name === 'CEILING.MATH' ? -4 : -6,
    'Rounds to a multiple using Excel negative-number mode conventions; significance is treated as an absolute value.',
  );
addEngineering(
  'MROUND',
  'Round to the nearest multiple',
  [num('number', 'Number', 10), num('multiple', 'Multiple', 3)],
  (a) => {
    const v = numeric(a.number),
      m = numeric(a.multiple);
    if (v * m < 0) fail('#NUM!', 'Number and multiple must have the same sign.');
    if (!m) return 0;
    return Math.sign(v) * Math.floor(Math.abs(v / m) + 0.5) * Math.abs(m);
  },
  { number: 10, multiple: 3 },
  9,
  'Rounds to the nearest multiple with halfway values away from zero. Floating-point precision applies to decimal multiples.',
);
addEngineering(
  'CONVERT',
  'Convert measurement units',
  [num('number', 'Quantity', 1), text('from', 'From unit', 'm'), text('to', 'To unit', 'ft')],
  (a) => {
    const v = numeric(a.number),
      from = String(a.from),
      to = String(a.to);
    const temperature: Record<string, [(v: number) => number, (v: number) => number]> = {
      C: [(v) => v + 273.15, (v) => v - 273.15],
      cel: [(v) => v + 273.15, (v) => v - 273.15],
      F: [(v) => ((v - 32) * 5) / 9 + 273.15, (v) => ((v - 273.15) * 9) / 5 + 32],
      fah: [(v) => ((v - 32) * 5) / 9 + 273.15, (v) => ((v - 273.15) * 9) / 5 + 32],
      K: [(v) => v, (v) => v],
      kel: [(v) => v, (v) => v],
      Rank: [(v) => (v * 5) / 9, (v) => (v * 9) / 5],
      Reau: [(v) => v * 1.25 + 273.15, (v) => (v - 273.15) / 1.25],
    };
    if (temperature[from] || temperature[to]) {
      if (!temperature[from] || !temperature[to])
        fail('#N/A', 'Temperature units can only be converted to other temperature units.');
      return temperature[to][1](temperature[from][0](v));
    }
    return formula.CONVERT(v, from, to);
  },
  { number: 1, from: 'm', to: 'ft' },
  3.280839895013123,
  'Converts compatible engineering units using Formula.js, including metric prefixes and temperature conversions. Unit symbols are case sensitive.',
);
for (const [name, title, fn, expected] of [
  [
    'SQRT',
    'Square root',
    (v: number) => {
      if (v < 0) fail('#NUM!', 'Square root requires a nonnegative value.');
      return Math.sqrt(v);
    },
    2,
  ],
  ['EXP', 'Exponential', (v: number) => Math.exp(v), Math.exp(4)],
  [
    'LN',
    'Natural logarithm',
    (v: number) => {
      if (v <= 0) fail('#NUM!', 'Logarithm requires a positive value.');
      return Math.log(v);
    },
    Math.log(4),
  ],
  ['SIN', 'Sine in radians', Math.sin, Math.sin(4)],
  ['COS', 'Cosine in radians', Math.cos, Math.cos(4)],
  ['TAN', 'Tangent in radians', Math.tan, Math.tan(4)],
  ['SIGN', 'Sign of a number', Math.sign, 1],
] as [string, string, (v: number) => number, number][])
  addEngineering(
    name,
    title,
    [num('number', 'Number', 4)],
    (a) => fn(numeric(a.number)),
    { number: 4 },
    expected,
    `${title}. Trigonometric angles use radians.`,
  );
addEngineering(
  'POWER',
  'Raise a number to a power',
  [num('number', 'Base', 2), num('power', 'Exponent', 3)],
  (a) => {
    const b = numeric(a.number),
      p = numeric(a.power);
    if (!b && p === 0) fail('#NUM!', 'Zero to the zero power is undefined.');
    if (!b && p < 0) fail('#DIV/0!', 'Zero cannot be raised to a negative power.');
    return b ** p;
  },
  { number: 2, power: 3 },
  8,
  'Raises a real number to a power; non-real results produce a numeric error.',
);
addEngineering(
  'LOG',
  'Logarithm in a selected base',
  [num('number', 'Positive number', 100), num('base', 'Logarithm base', 10)],
  (a) => {
    const v = numeric(a.number),
      b = numeric(a.base);
    if (v <= 0 || b <= 0 || b === 1)
      fail('#NUM!', 'Number and base must be positive, and the base cannot be 1.');
    return Math.log(v) / Math.log(b);
  },
  { number: 100, base: 10 },
  2,
  'Logarithm with base 10 by default.',
);
addEngineering(
  'TRUNC',
  'Truncate decimal places',
  [num('number', 'Number', -12.345), num('digits', 'Decimal places', 2)],
  (a) => {
    const n = numeric(a.number),
      d = Math.trunc(numeric(a.digits));
    if (Math.abs(d) > 308) fail('#NUM!', 'Decimal places must be between -308 and 308.');
    const parts = String(n).split('e'),
      shifted = Number(`${parts[0]}e${Number(parts[1] || 0) + d}`);
    if (!Number.isFinite(shifted)) return n;
    const truncated = String(Math.trunc(shifted)).split('e');
    return Number(`${truncated[0]}e${Number(truncated[1] || 0) - d}`);
  },
  { number: -12.345, digits: 2 },
  -12.34,
  'Truncates toward zero; negative decimal places truncate to tens, hundreds, and beyond.',
);
function gcd(x: number, y: number): number {
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}
for (const name of ['GCD', 'LCM'])
  addEngineering(
    name,
    name === 'GCD' ? 'Greatest common divisor' : 'Least common multiple',
    [data('data', 'Nonnegative integer values', [12, 18])],
    (a) => {
      const x = dataset(a.data).map((v) => {
        if (v < 0) fail('#NUM!', 'Integer inputs cannot be negative.');
        return integer(v, 'Integer', 0, Number.MAX_SAFE_INTEGER);
      });
      return x.reduce(
        (s, v) => (name === 'GCD' ? gcd(s, v) : !s || !v ? 0 : Math.abs((s / gcd(s, v)) * v)),
        name === 'GCD' ? 0 : 1,
      );
    },
    { data: [12, 18] },
    name === 'GCD' ? 6 : 36,
    'Uses nonnegative values truncated to integers. Results beyond JavaScript safe integer precision are subject to rounding.',
  );
addEngineering(
  'FACT',
  'Factorial',
  [num('number', 'Nonnegative integer', 5)],
  (a) => {
    if (numeric(a.number) < 0) fail('#NUM!', 'Factorial requires a nonnegative value.');
    const n = integer(a.number, 'Number', 0, 170);
    let v = 1;
    for (let k = 2; k <= n; k++) v *= k;
    return v;
  },
  { number: 5 },
  120,
  'Product of the positive integers up to the truncated input; 0! = 1.',
);
for (const name of ['COMBIN', 'PERMUT'])
  addEngineering(
    name,
    name === 'COMBIN' ? 'Count combinations' : 'Count ordered permutations',
    [num('number', 'Total items', 5), num('chosen', 'Items chosen', 2)],
    (a) => {
      const n = integer(a.number, 'Total items', 0, Number.MAX_SAFE_INTEGER);
      let k = integer(a.chosen, 'Items chosen', 0, n);
      if (k > 100000) fail('#NUM!', 'The chosen count is too large.');
      if (name === 'COMBIN') k = Math.min(k, n - k);
      let v = 1;
      for (let j = 1; j <= k; j++) v *= name === 'COMBIN' ? (n - k + j) / j : n - j + 1;
      return v;
    },
    { number: 5, chosen: 2 },
    name === 'COMBIN' ? 10 : 20,
    'Counts selections without replacement; combinations ignore order and permutations preserve order.',
  );
addEngineering(
  'SUMSQ',
  'Sum of squares',
  [data()],
  (a) => sumsq(dataset(a.data)),
  { data: [1, 2, 3] },
  14,
  'Adds the squares of numeric cells, ignoring text and blanks.',
);
addEngineering(
  'RAND',
  'Random decimal',
  [],
  () => Math.random(),
  {},
  0.5,
  'Generates a new random decimal in [0, 1). Results change on each explicit calculation.',
  0.5,
);
addEngineering(
  'RANDBETWEEN',
  'Random whole number',
  [num('bottom', 'Lowest integer', 1), num('top', 'Highest integer', 10)],
  (a) => {
    const lo = Math.ceil(numeric(a.bottom)),
      hi = Math.floor(numeric(a.top));
    if (lo > hi) fail('#NUM!', 'The lower bound must not exceed the upper bound.');
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi))
      fail('#NUM!', 'Bounds must be safe integers.');
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  },
  { bottom: 5, top: 5 },
  5,
  'Generates a uniformly sampled integer between the inclusive bounds.',
);
addEngineering(
  'RANDARRAY',
  'Random number table',
  [
    num('rows', 'Rows', 3),
    num('columns', 'Columns', 2),
    num('min', 'Minimum', 0),
    num('max', 'Maximum', 1),
    bool('integer', 'Whole numbers only', false),
  ],
  (a) => {
    const r = integer(a.rows, 'Rows', 1, 100000),
      c = integer(a.columns, 'Columns', 1, 10000);
    if (r * c > 1000000) fail('#NUM!', 'Random tables are limited to one million cells.');
    const lo = numeric(a.min),
      hi = numeric(a.max);
    if (lo > hi || (a.integer && Math.ceil(lo) > Math.floor(hi)))
      fail('#VALUE!', 'The requested bounds contain no valid values.');
    return Array.from({ length: r }, () =>
      Array.from({ length: c }, () =>
        a.integer
          ? Math.ceil(lo) + Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1))
          : lo + Math.random() * (hi - lo),
      ),
    );
  },
  { rows: 2, columns: 2, min: 3, max: 3, integer: true },
  [
    [3, 3],
    [3, 3],
  ],
  'Creates a random rectangular array. Whole-number mode includes both endpoints; decimal mode excludes the maximum unless both bounds are equal.',
);
addEngineering(
  'MMULT',
  'Multiply matrices',
  [
    {
      ...data('matrix1', 'Left matrix', [
        [1, 2],
        [3, 4],
      ]),
      type: 'matrix',
    },
    {
      ...data('matrix2', 'Right matrix', [
        [5, 6],
        [7, 8],
      ]),
      type: 'matrix',
    },
  ],
  (a) => {
    const x = numericMatrix(a.matrix1),
      y = numericMatrix(a.matrix2);
    if (x[0].length !== y.length) fail('#VALUE!', 'Left columns must equal right rows.');
    return x.map((row) => y[0].map((_, j) => row.reduce((s, v, k) => s + v * y[k][j], 0)));
  },
  {
    matrix1: [
      [1, 2],
      [3, 4],
    ],
    matrix2: [
      [5, 6],
      [7, 8],
    ],
  },
  [
    [19, 22],
    [43, 50],
  ],
  'Multiplies strict numeric rectangular matrices after checking dimensions.',
);
for (const name of ['MINVERSE', 'MDETERM'])
  addEngineering(
    name,
    name === 'MINVERSE' ? 'Invert a square matrix' : 'Matrix determinant',
    [
      {
        ...data('matrix', 'Square numeric matrix', [
          [1, 2],
          [3, 4],
        ]),
        type: 'matrix',
      },
    ],
    (a) => (name === 'MINVERSE' ? inverse(a.matrix) : determinant(a.matrix)),
    {
      matrix: [
        [1, 2],
        [3, 4],
      ],
    },
    name === 'MINVERSE'
      ? [
          [-2, 1],
          [1.5, -0.5],
        ]
      : -2,
    'Uses Gaussian elimination with partial pivoting. Inversion rejects singular matrices; determinant of a singular matrix is zero.',
  );
function complexString(re: number, im: number, suffix = 'i') {
  if (!['i', 'j'].includes(suffix)) fail('#VALUE!', 'Imaginary suffix must be i or j.');
  if (!im) return String(re);
  const imaginary = Math.abs(im) === 1 ? '' : String(Math.abs(im));
  return `${re === 0 ? '' : re}${im < 0 ? '-' : re === 0 ? '' : '+'}${imaginary}${suffix}`;
}
function parseComplex(value: any): { re: number; im: number; suffix: string } {
  const s = String(value).trim();
  if (!/[ij]$/.test(s)) {
    const re = Number(s);
    if (s === '' || !Number.isFinite(re))
      fail('#NUM!', 'Enter a valid complex number such as 2+3i.');
    return { re, im: 0, suffix: 'i' };
  }
  const suffix = s.slice(-1),
    body = s.slice(0, -1);
  let split = -1;
  for (let i = 1; i < body.length; i++)
    if (/[+-]/.test(body[i]) && !/[eE]/.test(body[i - 1])) split = i;
  const rs = split >= 0 ? body.slice(0, split) : '0',
    ims = split >= 0 ? body.slice(split) : body;
  const re = Number(rs),
    im = ims === '' || ims === '+' ? 1 : ims === '-' ? -1 : Number(ims);
  if (!Number.isFinite(re) || !Number.isFinite(im))
    fail('#NUM!', 'Enter a valid complex number such as 2+3i.');
  return { re, im, suffix };
}
addEngineering(
  'COMPLEX',
  'Create a complex number',
  [
    num('real', 'Real part', 3),
    num('imaginary', 'Imaginary part', 4),
    select('suffix', 'Imaginary symbol', ['i', 'j'], 'i'),
  ],
  (a) => complexString(numeric(a.real), numeric(a.imaginary), String(a.suffix)),
  { real: 3, imaginary: 4, suffix: 'i' },
  '3+4i',
  'Formats a complex number with i or j as its imaginary unit.',
);
for (const name of ['IMSUM', 'IMPRODUCT'])
  addEngineering(
    name,
    name === 'IMSUM' ? 'Add complex numbers' : 'Multiply complex numbers',
    [data('data', 'Complex values', ['1+2i', '3-4i'])],
    (a) => {
      const values = flatten(a.data);
      if (!values.length) fail('#VALUE!', 'Select at least one complex value.');
      const parsed = values.map(parseComplex),
        suffix = parsed.find((v) => v.im !== 0)?.suffix || 'i';
      if (parsed.some((v) => v.im !== 0 && v.suffix !== suffix))
        fail('#VALUE!', 'Use the same imaginary suffix for every input.');
      let re = name === 'IMSUM' ? 0 : 1,
        im = 0;
      for (const v of parsed) {
        if (name === 'IMSUM') {
          re += v.re;
          im += v.im;
        } else {
          [re, im] = [re * v.re - im * v.im, re * v.im + im * v.re];
        }
      }
      return complexString(re, im, suffix);
    },
    { data: ['1+2i', '3-4i'] },
    name === 'IMSUM' ? '4-2i' : '11+2i',
    'Computes exact complex arithmetic over the supplied real and imaginary parts; all imaginary suffixes must agree.',
  );
for (const [name, base, bits, min, max] of [
  ['DEC2BIN', 2, 10, -512, 511],
  ['DEC2HEX', 16, 40, -549755813888, 549755813887],
] as const)
  addEngineering(
    name,
    name === 'DEC2BIN' ? 'Decimal to binary' : 'Decimal to hexadecimal',
    [
      num('number', 'Decimal integer', 10),
      {
        ...num('places', 'Minimum output width (optional)', 1),
        required: false,
        default: undefined,
      },
    ],
    (a) => {
      const n = integer(a.number, 'Decimal integer', min, max);
      if (n < 0) return (2 ** bits + n).toString(base).toUpperCase();
      let result = n.toString(base).toUpperCase();
      if (a.places !== undefined && a.places !== null && a.places !== '') {
        const places = integer(a.places, 'Places', 1, 10);
        if (result.length > places)
          fail('#NUM!', 'Output needs more characters than the requested width.');
        result = result.padStart(places, '0');
      }
      return result;
    },
    { number: 10 },
    name === 'DEC2BIN' ? '1010' : 'A',
    'Converts a signed decimal integer using Excel two’s-complement widths: 10 bits for binary and 40 bits for hexadecimal.',
  );
for (const [name, base, bits, pattern] of [
  ['BIN2DEC', 2, 10, /^[01]{1,10}$/],
  ['HEX2DEC', 16, 40, /^[0-9a-f]{1,10}$/i],
] as const)
  addEngineering(
    name,
    name === 'BIN2DEC' ? 'Binary to decimal' : 'Hexadecimal to decimal',
    [
      text(
        'number',
        name === 'BIN2DEC' ? 'Binary digits' : 'Hexadecimal digits',
        name === 'BIN2DEC' ? '1010' : 'A',
      ),
    ],
    (a) => {
      const s = String(a.number);
      if (!pattern.test(s)) fail('#NUM!', 'Enter 1 to 10 valid digits with no prefix.');
      const n = parseInt(s, base);
      return s.length === 10 && n >= 2 ** (bits - 1) ? n - 2 ** bits : n;
    },
    { number: name === 'BIN2DEC' ? '1010' : 'A' },
    10,
    'Converts up to ten digits; a ten-character value with its top bit set is interpreted using Excel signed two’s-complement conventions.',
  );
export const numericFunctions: FunctionDef[] = [...functions, ...financeFunctions];
