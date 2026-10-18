import { fail, flatten, matrix, numeric, numbers } from './types';
// jStat is BSD licensed and has no bundled TypeScript declarations.
import jstatModule from 'jstat';
export const jStat: any = jstatModule.jStat;
export { fail, flatten, matrix, numeric, numbers };
export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export const sumsq = (v: number[]) => v.reduce((a, b) => a + b * b, 0);
export function dataset(value: any, min = 1): number[] {
  const a = numbers(value);
  if (a.length < min) fail('#DIV/0!', `At least ${min} numeric observations are required.`);
  return a;
}
export function strictVector(value: any): number[] {
  return flatten(value).map((v) => {
    if (typeof v !== 'number' || !Number.isFinite(v))
      fail('#VALUE!', 'All entries must be finite numbers.');
    return v;
  });
}
export function variance(v: number[], sample = true) {
  if (v.length < (sample ? 2 : 1)) fail('#DIV/0!', 'Not enough numeric observations.');
  const m = mean(v);
  return sumsq(v.map((x) => x - m)) / (v.length - (sample ? 1 : 0));
}
export function paired(a: any, b: any, min = 2): [number[], number[]] {
  const aa = flatten(a),
    bb = flatten(b);
  if (aa.length !== bb.length) fail('#N/A', 'Paired data ranges must have equal sizes.');
  const x: number[] = [],
    y: number[] = [];
  aa.forEach((v, i) => {
    for (const cell of [v, bb[i]])
      if (cell && typeof cell === 'object' && 'error' in cell)
        fail(cell.error, cell.message || cell.error);
    if (
      typeof v === 'number' &&
      Number.isFinite(v) &&
      typeof bb[i] === 'number' &&
      Number.isFinite(bb[i])
    ) {
      x.push(v);
      y.push(bb[i]);
    }
  });
  if (x.length < min) fail('#DIV/0!', `At least ${min} numeric pairs are required.`);
  return [x, y];
}
export function covariance(a: number[], b: number[], sample = true) {
  const am = mean(a),
    bm = mean(b);
  return a.reduce((s, x, i) => s + (x - am) * (b[i] - bm), 0) / (a.length - (sample ? 1 : 0));
}
export function percentile(a: number[], p: number) {
  if (p < 0 || p > 1) fail('#NUM!', 'Percentile must be between 0 and 1.');
  const s = [...a].sort((a, b) => a - b),
    pos = (s.length - 1) * p,
    i = Math.floor(pos);
  return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (pos - i);
}
export function finite(value: any): any {
  if (value instanceof Error)
    fail(/^#/.test(value.message) ? value.message : '#NUM!', value.message);
  if (typeof value === 'number' && !Number.isFinite(value))
    fail('#NUM!', 'The calculation has no finite numeric result.');
  if (Array.isArray(value)) return value.map(finite);
  return value;
}
export function integer(value: any, label = 'Value', min = 0, max = 1_000_000) {
  const n = Math.trunc(numeric(value, label));
  if (n < min || n > max) fail('#NUM!', `${label} must be between ${min} and ${max}.`);
  return n;
}
export function numericMatrix(value: any): number[][] {
  return matrix(value).map((row) =>
    row.map((v) => {
      if (typeof v !== 'number' || !Number.isFinite(v))
        fail('#VALUE!', 'Matrix cells must all be numeric.');
      return v;
    }),
  );
}
export function inverse(value: any): number[][] {
  const m = numericMatrix(value),
    n = m.length;
  if (m[0].length !== n) fail('#VALUE!', 'The matrix must be square.');
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (a[p][k] === 0) fail('#NUM!', 'The matrix is singular and has no inverse.');
    [a[p], a[k]] = [a[k], a[p]];
    const pivot = a[k][k];
    a[k] = a[k].map((v) => v / pivot);
    for (let i = 0; i < n; i++)
      if (i !== k) {
        const f = a[i][k];
        for (let j = 0; j < 2 * n; j++) a[i][j] -= f * a[k][j];
      }
  }
  return a.map((r) => r.slice(n));
}
export function determinant(value: any): number {
  const a = numericMatrix(value).map((r) => [...r]),
    n = a.length;
  if (a[0].length !== n) fail('#VALUE!', 'The matrix must be square.');
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (a[p][k] === 0) return 0;
    if (p !== k) {
      [a[p], a[k]] = [a[k], a[p]];
      d = -d;
    }
    const v = a[k][k];
    d *= v;
    for (let i = k + 1; i < n; i++) {
      const f = a[i][k] / v;
      for (let j = k + 1; j < n; j++) a[i][j] -= f * a[k][j];
    }
  }
  return d;
}
export interface Regression {
  coefficients: number[];
  intercept: number;
  predicted: number[];
  ssres: number;
  ssreg: number;
  r2: number;
  df: number;
  se: number[];
  interceptSE: number;
  sey: number;
  f: number;
}
export function regressionInputs(yvalue: any, xvalue: any): [number[], number[][]] {
  const y = strictVector(yvalue);
  if (y.length < 2) fail('#DIV/0!', 'Regression needs at least two observations.');
  if (xvalue === undefined || xvalue === null || xvalue === '')
    return [y, y.map((_, i) => [i + 1])];
  let x = numericMatrix(xvalue);
  // When y is a row vector, Excel treats each x row as a predictor.
  if (Array.isArray(yvalue?.[0]) && yvalue.length === 1 && x[0].length === y.length)
    x = x[0].map((_, i) => x.map((r) => r[i]));
  else if (x.length === 1 && x[0].length === y.length) x = x[0].map((v) => [v]);
  if (x.length !== y.length) fail('#N/A', 'Each response must have one row of predictor values.');
  return [y, x];
}
export function regress(y: number[], x: number[][], constant = true): Regression {
  const n = y.length,
    k = x[0].length,
    p = k + (constant ? 1 : 0);
  if (n < p) fail('#NUM!', 'There must be at least as many observations as fitted coefficients.');
  const ym = constant ? mean(y) : 0,
    xm = Array.from({ length: k }, (_, j) => (constant ? mean(x.map((r) => r[j])) : 0));
  const yc = y.map((v) => v - ym),
    cols = Array.from({ length: k }, (_, j) => x.map((r) => r[j] - xm[j]));
  const q: number[][] = [],
    r = Array.from({ length: k }, () => Array(k).fill(0));
  for (let j = 0; j < k; j++) {
    const v = [...cols[j]];
    // Reorthogonalization avoids loss of precision in moderately correlated predictors.
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < j; i++) {
        const dot = q[i].reduce((s, a, h) => s + a * v[h], 0);
        r[i][j] += dot;
        for (let h = 0; h < n; h++) v[h] -= dot * q[i][h];
      }
    r[j][j] = Math.hypot(...v);
    if (r[j][j] <= Number.EPSILON * Math.max(1, Math.hypot(...cols[j])) * n)
      fail('#NUM!', 'Predictors are linearly dependent; remove redundant columns.');
    q.push(v.map((a) => a / r[j][j]));
  }
  const z = q.map((col) => col.reduce((s, v, i) => s + v * yc[i], 0)),
    b = Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    b[i] = (z[i] - r[i].reduce((s, v, j) => s + (j > i ? v * b[j] : 0), 0)) / r[i][i];
  }
  const intercept = ym - b.reduce((s, v, j) => s + v * xm[j], 0),
    predicted = x.map((row) => intercept + row.reduce((s, v, j) => s + v * b[j], 0));
  let ssres = sumsq(y.map((v, i) => v - predicted[i]));
  if (ssres < 1e-25 * Math.max(1, sumsq(y))) ssres = 0;
  const sst = sumsq(y.map((v) => v - ym)),
    ssreg = Math.max(0, sst - ssres),
    df = n - p,
    mse = df > 0 ? ssres / df : NaN;
  const ri = Array.from({ length: k }, () => Array(k).fill(0));
  for (let col = 0; col < k; col++)
    for (let i = k - 1; i >= 0; i--)
      ri[i][col] =
        ((i === col ? 1 : 0) - r[i].reduce((s, v, j) => s + (j > i ? v * ri[j][col] : 0), 0)) /
        r[i][i];
  const cov = ri.map((a) => ri.map((bb) => a.reduce((s, v, j) => s + v * bb[j], 0)));
  return {
    coefficients: b,
    intercept,
    predicted,
    ssres,
    ssreg,
    r2: sst === 0 ? 1 : 1 - ssres / sst,
    df,
    se: cov.map((a, i) => Math.sqrt(mse * a[i])),
    interceptSE: constant
      ? Math.sqrt(
          mse *
            (1 / n +
              xm.reduce((s, a, i) => s + a * xm.reduce((ss, bb, j) => ss + cov[i][j] * bb, 0), 0)),
        )
      : 0,
    sey: Math.sqrt(mse),
    f: ssres === 0 ? Infinity : ssreg / k / mse,
  };
}
// Cephes rational error-function approximations (Stephen Moshier, public domain).
// Working with erfc directly retains the small normal-distribution tail.
const polevl = (x: number, coeff: number[]) => coeff.reduce((value, c) => value * x + c, 0);
const p1evl = (x: number, coeff: number[]) => coeff.reduce((value, c) => value * x + c, 1);
function erfcPositive(x: number): number {
  if (x < 1) {
    const z = x * x;
    return (
      1 -
      (x *
        polevl(
          z,
          [
            9.60497373987051638749, 90.0260197203842689217, 2232.00534594684319226,
            7003.32514112805075473, 55592.3013010394962768,
          ],
        )) /
        p1evl(
          z,
          [
            33.5617141647503099647, 521.357949780152679795, 4594.32382970980127987,
            22629.0000613890934246, 49267.3942608635921086,
          ],
        )
    );
  }
  if (x > 27.3) return 0;
  const p =
    x < 8
      ? [
          2.46196981473530512524e-10, 0.564189564831068821977, 7.46321056442269912687,
          48.6371970985681366614, 196.520832956077098242, 526.445194995477358631,
          934.52852717195760754, 1027.55188689515710272, 557.535335369399327526,
        ]
      : [
          0.564189583547755073984, 1.27536670759978104416, 5.01905042251180477414,
          6.16021097993053585195, 7.4097426995044893916, 2.9788666537210024067,
        ];
  const q =
    x < 8
      ? [
          13.2281951154744992508, 86.7072140885989742329, 354.937778887819891062,
          975.708501743205489753, 1823.90916687909736289, 2246.33760818710981792,
          1656.66309194161350182, 557.535340817727675546,
        ]
      : [
          2.2605286322011727659, 9.39603524938001434673, 12.0489539808096656605,
          17.0814450747565897222, 9.60896809063285878198, 3.3690764510008151605,
        ];
  return (Math.exp(-x * x) * polevl(x, p)) / p1evl(x, q);
}
export function normalCDF(z: number): number {
  const tail = 0.5 * erfcPositive(Math.abs(z) / Math.SQRT2);
  return z < 0 ? tail : 1 - tail;
}
export function normalInverse(p: number): number {
  if (p <= 0 || p >= 1) fail('#NUM!', 'Probability must lie strictly between zero and one.');
  if (p === 0.5) return 0;
  const q = p > 0.5 ? 1 - p : p;
  let lo = -40,
    hi = 0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (normalCDF(mid) < q) lo = mid;
    else hi = mid;
  }
  return ((p > 0.5 ? -1 : 1) * (lo + hi)) / 2;
}
export function gammaUpper(a: number, x: number): number {
  if (x === 0) return 1;
  if (x < a + 1) return Math.max(0, 1 - jStat.lowRegGamma(a, x));
  const tiny = 1e-300;
  let b = x + 1 - a,
    c = 1 / tiny,
    d = 1 / b,
    h = d;
  for (let i = 1; i < 100000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-15) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-x + a * Math.log(x) - jStat.gammaln(a)) * h));
}
export const studentTail = (t: number, df: number): number =>
  0.5 * jStat.ibeta(df / (df + t * t), df / 2, 0.5);
