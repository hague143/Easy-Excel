import type { FunctionDef, InputDef } from './types';
import { CalcError, fail, flatten, numeric } from './types';

// Finance uses decimal rates: 0.12 means 12%. Payment functions use a rate
// per payment period; security functions use an annual rate. Cash outflows
// are negative and inflows positive, matching Excel's financial functions.
type Args = Record<string, any>;
const n = (a: Args, key: string, fallback?: number) =>
  numeric(a[key] === undefined ? fallback : a[key], key);
const positive = (value: number, label: string) => {
  if (value <= 0) fail('#NUM!', `${label} must be positive.`);
  return value;
};
const nonnegative = (value: number, label: string) => {
  if (value < 0) fail('#NUM!', `${label} cannot be negative.`);
  return value;
};
function rate(a: Args) {
  const r = n(a, 'rate');
  if (r <= -1) fail('#NUM!', 'The per-period rate must exceed -100%.');
  return r;
}
function timing(a: Args) {
  const t = n(a, 'type', 0);
  if (t !== 0 && t !== 1) fail('#NUM!', 'Payment timing must be 0 (end) or 1 (beginning).');
  return t;
}
function checked(value: number): number {
  if (!Number.isFinite(value)) fail('#NUM!', 'No finite financial result exists for these inputs.');
  return Object.is(value, -0) ? 0 : value;
}
function series(value: any): number[] {
  // Values arrive as selected cell ranges: Excel ignores text, logical values,
  // and empty cells in these ranges, while retaining explicit numeric zero.
  const cells = flatten(value);
  for (const cell of cells)
    if (cell && typeof cell === 'object' && 'error' in cell)
      fail(cell.error, cell.message || 'Cash flow contains an error.');
  return cells.filter((cell): cell is number => typeof cell === 'number' && Number.isFinite(cell));
}
const payment = (r: number, periods: number, present: number, future = 0, type = 0) => {
  positive(periods, 'Payment periods');
  if (r === 0) return -(present + future) / periods;
  const g = Math.exp(periods * Math.log1p(r));
  return checked(
    (-(present * g + future) * r) / ((1 + r * type) * Math.expm1(periods * Math.log1p(r))),
  );
};
const futureValue = (r: number, periods: number, pmt: number, present = 0, type = 0) => {
  if (r === 0) return -(present + pmt * periods);
  const growthMinusOne = Math.expm1(periods * Math.log1p(r));
  return checked(-(present * (1 + growthMinusOne) + (pmt * (1 + r * type) * growthMinusOne) / r));
};
function interest(a: Args) {
  const r = rate(a),
    periods = positive(n(a, 'nper'), 'Payment periods'),
    period = n(a, 'per'),
    type = timing(a);
  if (period < 1 || period > periods)
    fail('#NUM!', 'The payment period must be between 1 and the total payment periods.');
  if (r === 0 || (period === 1 && type === 1)) return 0;
  const pv = n(a, 'pv'),
    pmt = payment(r, periods, pv, n(a, 'fv', 0), type);
  return (futureValue(r, period - 1, pmt, pv, type) * r) / (type === 1 ? 1 + r : 1);
}

// Solve in log(1 + rate) space to stay inside the real-valued rate domain.
// A damped Newton iteration selects the root near the supplied guess; a
// bracketed fallback handles flat derivatives and unusually spaced flows.
function solveRate(fn: (logRate: number) => number, guess: number): number {
  if (guess <= -1) fail('#NUM!', 'The rate guess must exceed -100%.');
  const initial = Math.log1p(guess);
  let x = initial;
  for (let i = 0; i < 100; i++) {
    const fx = fn(x);
    if (Number.isFinite(fx) && Math.abs(fx) < 1e-12) return Math.expm1(x);
    const h = 1e-5 * Math.max(1, Math.abs(x));
    const derivative = (fn(x + h) - fn(x - h)) / (2 * h);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-16) break;
    const step = Math.max(-1, Math.min(1, fx / derivative));
    const next = x - step;
    if (next < -27 || next > 25 || !Number.isFinite(next)) break;
    if (Math.abs(next - x) < 1e-13 && Math.abs(fx) < 1e-9) return Math.expm1(next);
    x = next;
  }
  const points = [initial];
  for (let d = 0.025; d < 55; d *= 1.18) {
    points.push(Math.max(-27, initial - d), Math.min(25, initial + d));
  }
  const sorted = [...new Set(points)].sort((a, b) => a - b);
  const brackets: [number, number][] = [];
  for (let i = 1; i < sorted.length; i++) {
    const left = sorted[i - 1],
      right = sorted[i],
      fl = fn(left),
      fr = fn(right);
    if (fl === 0) return Math.expm1(left);
    if (fr === 0) return Math.expm1(right);
    if (!Number.isNaN(fl) && !Number.isNaN(fr) && Math.sign(fl) !== Math.sign(fr))
      brackets.push([left, right]);
  }
  brackets.sort(
    (a, b) => Math.abs((a[0] + a[1]) / 2 - initial) - Math.abs((b[0] + b[1]) / 2 - initial),
  );
  for (const bracket of brackets) {
    let [lo, hi] = bracket,
      flo = fn(lo);
    for (let i = 0; i < 180; i++) {
      const mid = (lo + hi) / 2,
        fm = fn(mid);
      if (Math.abs(fm) < 1e-12 || hi - lo < 1e-13) return Math.expm1(mid);
      if (Math.sign(fm) === Math.sign(flo)) {
        lo = mid;
        flo = fm;
      } else hi = mid;
    }
  }
  return fail(
    '#NUM!',
    'A rate could not be found. Check cash-flow signs or try a different guess.',
  );
}
function cashflowIRR(values: number[], times: number[], guess: number) {
  if (values.length < 2 || !values.some((v) => v > 0) || !values.some((v) => v < 0))
    fail('#NUM!', 'A return calculation needs at least one positive and one negative cash flow.');
  if (times.every((t) => t === times[0]))
    fail('#NUM!', 'A return calculation requires cash flows at distinct times.');
  const scale = Math.max(...values.map(Math.abs));
  return solveRate(
    (t) => values.reduce((sum, value, i) => sum + (value / scale) * Math.exp(-times[i] * t), 0),
    guess,
  );
}

const DAY = 86400000;
function date(value: any, label: string): Date {
  let result: Date;
  if (typeof value === 'number') {
    // Excel's 1900 calendar includes the fictitious 1900-02-29.
    const serial = Math.floor(value);
    result = new Date(Date.UTC(1899, 11, 31) + (serial - (serial >= 60 ? 1 : 0)) * DAY);
  } else if (value instanceof Date) result = new Date(value);
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    result = new Date(Date.UTC(y, m - 1, d));
    if (
      result.getUTCFullYear() !== y ||
      result.getUTCMonth() !== m - 1 ||
      result.getUTCDate() !== d
    )
      fail('#VALUE!', `${label} is not a valid date.`);
  } else
    return fail('#VALUE!', `${label} must be an ISO date (YYYY-MM-DD) or an Excel date serial.`);
  if (!Number.isFinite(result.getTime())) fail('#VALUE!', `${label} is not a valid date.`);
  return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate()));
}
const actualDays = (start: Date, end: Date) => (end.getTime() - start.getTime()) / DAY;
const lastDay = (d: Date) =>
  d.getUTCDate() === new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
function days360(start: Date, end: Date, european = false) {
  let d1 = start.getUTCDate(),
    d2 = end.getUTCDate(),
    m2 = end.getUTCMonth();
  if (european) {
    d1 = Math.min(d1, 30);
    d2 = Math.min(d2, 30);
  } else {
    if (d1 === 31 || (start.getUTCMonth() === 1 && lastDay(start))) d1 = 30;
    if (d2 === 31) {
      if (d1 < 30) {
        d2 = 1;
        m2++;
      } else d2 = 30;
    }
    if (end.getUTCMonth() === 1 && lastDay(end) && start.getUTCMonth() === 1 && lastDay(start))
      d2 = 30;
  }
  return (
    360 * (end.getUTCFullYear() - start.getUTCFullYear()) +
    30 * (m2 - start.getUTCMonth()) +
    d2 -
    d1
  );
}
function basisValue(a: Args) {
  const basis = Math.trunc(n(a, 'basis', 0));
  if (basis < 0 || basis > 4) fail('#NUM!', 'Day-count basis must be between 0 and 4.');
  return basis;
}
function dayCount(start: Date, end: Date, basis: number) {
  return basis === 0 || basis === 4 ? days360(start, end, basis === 4) : actualDays(start, end);
}
const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
// Simple-interest securities annualize with the settlement calendar year,
// not with a YEARFRAC average spanning multiple calendar years.
function annualDays(settlement: Date, basis: number): number {
  return basis === 1 ? (leap(settlement.getUTCFullYear()) ? 366 : 365) : basis === 3 ? 365 : 360;
}
function security(a: Args) {
  const settlement = date(a.settlement, 'Settlement'),
    maturity = date(a.maturity, 'Maturity'),
    basis = basisValue(a);
  if (settlement >= maturity) fail('#NUM!', 'Settlement must precede maturity.');
  return { settlement, maturity, basis };
}
function frequency(a: Args) {
  const f = n(a, 'frequency', 2);
  if (![1, 2, 4].includes(f)) fail('#NUM!', 'Coupon frequency must be 1, 2, or 4 per year.');
  return f;
}
function shiftMonths(anchor: Date, months: number) {
  const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(lastDay(anchor) ? last : Math.min(anchor.getUTCDate(), last));
  return target;
}
function couponData(a: Args) {
  const { settlement, maturity, basis } = security(a),
    f = frequency(a);
  let count = 1,
    next = maturity,
    previous = shiftMonths(maturity, -12 / f);
  while (previous > settlement) {
    next = previous;
    previous = shiftMonths(maturity, (-12 / f) * ++count);
    if (count > 40000) fail('#NUM!', 'The coupon schedule exceeds 10,000 years.');
  }
  const E = basis === 1 ? actualDays(previous, next) : (basis === 3 ? 365 : 360) / f;
  return {
    f,
    count,
    E,
    A: dayCount(previous, settlement, basis),
    DSC: dayCount(settlement, next, basis),
  };
}
function bondPrice(a: Args, yieldValue: number) {
  const { f, count, E, A, DSC } = couponData(a);
  const coupon = (100 * nonnegative(n(a, 'rate'), 'Coupon rate')) / f;
  const redemption = positive(n(a, 'redemption', 100), 'Redemption');
  if (yieldValue <= -f) fail('#NUM!', 'The yield is below the supported discounting domain.');
  if (count === 1)
    return (redemption + coupon) / (1 + ((yieldValue / f) * DSC) / E) - (coupon * A) / E;
  const base = 1 + yieldValue / f,
    offset = DSC / E;
  let value = redemption / base ** (count - 1 + offset);
  for (let k = 0; k < count; k++) value += coupon / base ** (k + offset);
  return value - (coupon * A) / E;
}
function duration(a: Args) {
  const { f, count, E, DSC } = couponData(a),
    y = nonnegative(n(a, 'yld'), 'Annual yield');
  const coupon = (100 * nonnegative(n(a, 'rate'), 'Coupon rate')) / f;
  let present = 0,
    weighted = 0;
  for (let k = 0; k < count; k++) {
    const time = k + DSC / E,
      cf = coupon + (k === count - 1 ? 100 : 0),
      pv = cf / (1 + y / f) ** time;
    present += pv;
    weighted += (time / f) * pv;
  }
  return checked(weighted / present);
}
function cumulative(a: Args, principal: boolean) {
  positive(n(a, 'rate'), 'Interest rate');
  positive(n(a, 'pv'), 'Principal');
  const periods = positive(n(a, 'nper'), 'Payment periods'),
    start = Math.trunc(n(a, 'start')),
    end = Math.trunc(n(a, 'end'));
  if (start < 1 || end < start || end > periods)
    fail('#NUM!', 'Choose a valid first and last payment period.');
  if (end - start > 1000000) fail('#NUM!', 'Choose at most 1,000,000 periods.');
  const pmt = payment(rate(a), periods, n(a, 'pv'), 0, timing(a));
  let sum = 0;
  for (let per = start; per <= end; per++) {
    const ipmt = interest({ ...a, fv: 0, per });
    sum += principal ? pmt - ipmt : ipmt;
  }
  return sum;
}
function depreciationInputs(a: Args) {
  return {
    cost: nonnegative(n(a, 'cost'), 'Cost'),
    salvage: nonnegative(n(a, 'salvage', 0), 'Salvage'),
    life: positive(n(a, 'life'), 'Useful life'),
  };
}
function variableDepreciation(a: Args) {
  const { cost, salvage, life } = depreciationInputs(a),
    start = n(a, 'start'),
    end = n(a, 'end'),
    factor = positive(n(a, 'factor', 2), 'Declining factor');
  if (start < 0 || end < start || end > life)
    fail('#NUM!', 'Depreciation range must be within the asset life.');
  if (salvage >= cost || start === end) return 0;
  if (life > 1000000) fail('#NUM!', 'Asset life exceeds the supported schedule size.');
  let book = cost,
    result = 0,
    straight = false;
  for (let i = 0; i < end; i++) {
    const remaining = Math.max(0, book - salvage),
      sl = remaining / (life - i),
      db = (book * factor) / life;
    if (!a.noSwitch && sl > db) straight = true;
    const annual = Math.min(remaining / Math.min(1, life - i), straight ? sl : db);
    const overlap = Math.max(0, Math.min(end, i + 1) - Math.max(start, i));
    result += annual * overlap;
    book -= annual * Math.min(1, life - i);
  }
  return result;
}

const input = (
  key: string,
  label: string,
  type: InputDef['type'] = 'number',
  extra: Partial<InputDef> = {},
): InputDef => ({ key, label, type, required: true, ...extra });
const rateInput = input('rate', 'Rate per payment period (decimal)', 'number', {
  description:
    'For monthly payments, divide the annual nominal rate by 12. A 12% annual rate becomes 0.01 per month.',
});
const typeInput = input('type', 'Payment timing', 'select', {
  default: 0,
  options: [
    { label: 'End of period', value: 0 },
    { label: 'Beginning of period', value: 1 },
  ],
});
const basisInput = input('basis', 'Day-count convention', 'select', {
  default: 0,
  options: [
    { label: 'US 30/360', value: 0 },
    { label: 'Actual/actual', value: 1 },
    { label: 'Actual/360', value: 2 },
    { label: 'Actual/365', value: 3 },
    { label: 'European 30/360', value: 4 },
  ],
});
const frequencyInput = input('frequency', 'Coupon payments per year', 'select', {
  default: 2,
  options: [
    { label: 'Annual', value: 1 },
    { label: 'Semiannual', value: 2 },
    { label: 'Quarterly', value: 4 },
  ],
});
const maturityInputs = [
  input('settlement', 'Settlement date', 'date'),
  input('maturity', 'Maturity date', 'date'),
];
const bondInputs = [
  ...maturityInputs,
  input('rate', 'Annual coupon rate (decimal)'),
  input('yld', 'Annual yield (decimal)'),
  input('redemption', 'Redemption per 100 face value', 'number', { default: 100 }),
  frequencyInput,
  basisInput,
];
const assetInputs = [
  input('cost', 'Asset purchase cost'),
  input('salvage', 'Value at end of life', 'number', { default: 0 }),
  input('life', 'Useful life (periods)'),
];
const annuityInputs = [
  rateInput,
  input('nper', 'Number of payment periods'),
  input('pv', 'Present value / principal'),
  input('fv', 'Future value', 'number', { default: 0 }),
  typeInput,
];
const investmentInputs = [input('values', 'Cash flows in chronological order', 'data')];
const defaultsFrom = (inputs: InputDef[]) =>
  Object.fromEntries(inputs.filter((i) => i.default !== undefined).map((i) => [i.key, i.default]));
function def(
  name: string,
  friendlyName: string,
  description: string,
  inputs: InputDef[],
  exampleArgs: Args,
  expected: number,
  calculate: (a: Args) => number,
  aliases: string[] = [],
): FunctionDef {
  const defaults = defaultsFrom(inputs);
  return {
    name,
    friendlyName,
    description,
    categories: ['Finance and accounting'],
    aliases: [friendlyName.toLowerCase(), ...aliases],
    inputs,
    defaults,
    output: 'number',
    example: { args: exampleArgs, expected, tolerance: 1e-8 },
    compatibility: [
      'Excel financial cash-flow sign convention: money paid is negative; money received is positive.',
      'Rates are decimal fractions. Security dates use the Excel 1900 calendar; ISO dates avoid locale ambiguity.',
      'Cash-flow ranges ignore text, booleans, and blanks; explicit numeric zero is retained. Dated cash flows require an aligned date for every numeric payment.',
    ],
    testRefs: [`tests/finance.test.ts — ${name}`],
    calculate: (a) => {
      try {
        return checked(calculate({ ...defaults, ...a }));
      } catch (error) {
        if (error instanceof CalcError) throw error;
        return fail('#VALUE!', error instanceof Error ? error.message : 'Invalid financial input.');
      }
    },
  };
}

export const financeFunctions: FunctionDef[] = [
  def(
    'PMT',
    'Loan installment',
    'Calculate the constant payment per period. A positive principal produces a negative payment (cash paid out).',
    annuityInputs,
    { rate: 0.1, nper: 2, pv: 100 },
    -57.61904761904762,
    (a) => payment(rate(a), n(a, 'nper'), n(a, 'pv'), n(a, 'fv'), timing(a)),
    ['qist', 'loan payment', 'monthly installment'],
  ),
  def(
    'IPMT',
    'Interest portion of a payment',
    'Calculate the interest portion of a specified loan payment.',
    [...annuityInputs, input('per', 'Payment period to inspect')],
    { rate: 0.1, nper: 2, pv: 100, per: 1 },
    -10,
    interest,
  ),
  def(
    'PPMT',
    'Principal portion of a payment',
    'Calculate the principal portion of a specified loan payment.',
    [...annuityInputs, input('per', 'Payment period to inspect')],
    { rate: 0.1, nper: 2, pv: 100, per: 1 },
    -47.61904761904762,
    (a) => payment(rate(a), n(a, 'nper'), n(a, 'pv'), n(a, 'fv'), timing(a)) - interest(a),
  ),
  def(
    'PV',
    'Present value',
    'Calculate today’s value of regular future payments and a final balance.',
    [
      rateInput,
      input('nper', 'Number of payment periods'),
      input('pmt', 'Payment per period'),
      input('fv', 'Future value', 'number', { default: 0 }),
      typeInput,
    ],
    { rate: 0.1, nper: 2, pmt: 0, fv: 121 },
    -100,
    (a) => {
      const r = rate(a),
        per = n(a, 'nper'),
        pmt = n(a, 'pmt'),
        fv = n(a, 'fv'),
        type = timing(a);
      if (r === 0) return -fv - pmt * per;
      const discount = Math.exp(-per * Math.log1p(r));
      return -fv * discount - (pmt * (1 + r * type) * -Math.expm1(-per * Math.log1p(r))) / r;
    },
  ),
  def(
    'FV',
    'Future investment value',
    'Calculate the future balance from a starting amount and regular payments.',
    [
      rateInput,
      input('nper', 'Number of payment periods'),
      input('pmt', 'Payment per period'),
      input('pv', 'Present value', 'number', { default: 0 }),
      typeInput,
    ],
    { rate: 0.1, nper: 2, pmt: 0, pv: -100 },
    121,
    (a) => futureValue(rate(a), n(a, 'nper'), n(a, 'pmt'), n(a, 'pv'), timing(a)),
  ),
  def(
    'RATE',
    'Interest rate per period',
    'Solve the per-payment interest rate from the payment schedule.',
    [
      input('nper', 'Number of payment periods'),
      input('pmt', 'Payment per period'),
      input('pv', 'Present value'),
      input('fv', 'Future value', 'number', { default: 0 }),
      typeInput,
      input('guess', 'Initial rate estimate', 'number', { default: 0.1 }),
    ],
    { nper: 2, pmt: 0, pv: -100, fv: 121 },
    0.1,
    (a) => {
      const periods = positive(n(a, 'nper'), 'Payment periods'),
        pv = n(a, 'pv'),
        pmt = n(a, 'pmt'),
        fv = n(a, 'fv'),
        type = timing(a),
        scale = Math.max(Math.abs(pv), Math.abs(pmt), Math.abs(fv), 1);
      if (![pv, pmt, fv].some((v) => v > 0) || ![pv, pmt, fv].some((v) => v < 0))
        fail('#NUM!', 'The payment schedule needs both money received and money paid.');
      return solveRate(
        (t) => {
          const r = Math.expm1(t),
            growth = Math.exp(periods * t),
            annuity = Math.abs(t) < 1e-10 ? periods : Math.expm1(periods * t) / r;
          return (pv * growth + pmt * (1 + r * type) * annuity + fv) / scale;
        },
        n(a, 'guess'),
      );
    },
  ),
  def(
    'NPER',
    'Number of payment periods',
    'Calculate how many periods regular payments need to reach a target balance.',
    [
      rateInput,
      input('pmt', 'Payment per period'),
      input('pv', 'Present value'),
      input('fv', 'Future value', 'number', { default: 0 }),
      typeInput,
    ],
    { rate: 0.1, pmt: 0, pv: -100, fv: 121 },
    2,
    (a) => {
      const r = rate(a),
        pmt = n(a, 'pmt'),
        pv = n(a, 'pv'),
        fv = n(a, 'fv'),
        type = timing(a);
      if (r === 0) {
        if (pmt === 0) fail('#DIV/0!', 'A nonzero payment is required at zero interest.');
        return -(pv + fv) / pmt;
      }
      const top = pmt * (1 + r * type) - fv * r,
        bottom = pv * r + pmt * (1 + r * type);
      if (bottom === 0 || top / bottom <= 0)
        fail('#NUM!', 'The payments cannot reach the target balance.');
      return Math.log(top / bottom) / Math.log1p(r);
    },
  ),
  def(
    'NPV',
    'Net present value',
    'Discount end-of-period cash flows. Add a time-zero investment separately; use XNPV when the first cash flow occurs today.',
    [rateInput, ...investmentInputs],
    { rate: 0.1, values: [110, 121] },
    200,
    (a) =>
      series(a.values).reduce((sum, value, index) => sum + value / (1 + rate(a)) ** (index + 1), 0),
  ),
  def(
    'XNPV',
    'Net present value with dates',
    'Discount irregular cash flows using actual days and a 365-day year; the first date is time zero.',
    [rateInput, ...investmentInputs, input('dates', 'Dates aligned with cash flows', 'data')],
    { rate: 0.1, values: [-100, 121], dates: ['2020-01-01', '2021-12-31'] },
    0,
    (a) => {
      const values = series(a.values),
        dates = flatten(a.dates).map((d) => date(d, 'Cash-flow date'));
      if (!values.length || dates.length !== values.length)
        fail('#NUM!', 'Supply one date for every cash flow.');
      if (dates.some((d) => d < dates[0]))
        fail('#NUM!', 'No cash-flow date may precede the first date.');
      const r = rate(a);
      return values.reduce(
        (sum, value, i) => sum + value / (1 + r) ** (actualDays(dates[0], dates[i]) / 365),
        0,
      );
    },
  ),
  def(
    'IRR',
    'Investment internal rate of return',
    'Solve the per-period return of equally spaced cash flows, including the initial investment at period zero.',
    [...investmentInputs, input('guess', 'Initial return estimate', 'number', { default: 0.1 })],
    { values: [-100, 0, 121] },
    0.1,
    (a) => {
      const values = series(a.values);
      return cashflowIRR(
        values,
        values.map((_, i) => i),
        n(a, 'guess'),
      );
    },
  ),
  def(
    'XIRR',
    'Annual return with irregular dates',
    'Solve the annual return of dated cash flows using actual days divided by 365.',
    [
      ...investmentInputs,
      input('dates', 'Dates aligned with cash flows', 'data'),
      input('guess', 'Initial annual return estimate', 'number', { default: 0.1 }),
    ],
    { values: [-100, 121], dates: ['2020-01-01', '2021-12-31'] },
    0.1,
    (a) => {
      const values = series(a.values),
        dates = flatten(a.dates).map((d) => date(d, 'Cash-flow date'));
      if (values.length !== dates.length || !dates.length)
        fail('#NUM!', 'Supply one date for every cash flow.');
      if (dates.some((d) => d < dates[0]))
        fail('#NUM!', 'No cash-flow date may precede the first date.');
      return cashflowIRR(
        values,
        dates.map((d) => actualDays(dates[0], d) / 365),
        n(a, 'guess'),
      );
    },
  ),
  def(
    'SLN',
    'Straight-line depreciation',
    'Spread asset depreciation evenly across its useful life.',
    assetInputs,
    { cost: 1000, salvage: 100, life: 5 },
    180,
    (a) => {
      const { cost, salvage, life } = depreciationInputs(a);
      return (cost - salvage) / life;
    },
  ),
  def(
    'DB',
    'Fixed declining balance depreciation',
    'Calculate fixed declining balance depreciation with Excel’s three-decimal rounded depreciation rate and optional partial first year.',
    [
      ...assetInputs,
      input('period', 'Depreciation period (starting at 1)'),
      input('month', 'Months in first year', 'number', { default: 12 }),
    ],
    { cost: 1000, salvage: 100, life: 5, period: 1 },
    369,
    (a) => {
      const { cost, salvage, life } = depreciationInputs(a),
        period = Math.trunc(n(a, 'period')),
        month = Math.trunc(n(a, 'month'));
      if (month < 1 || month > 12 || period < 1 || period > Math.ceil(life) + (month < 12 ? 1 : 0))
        fail('#NUM!', 'Period or first-year month count is out of range.');
      if (salvage >= cost) return 0;
      if (period > 1000000)
        fail('#NUM!', 'Depreciation period exceeds the supported schedule size.');
      const r = Math.round((1 - (salvage / cost) ** (1 / life)) * 1000) / 1000;
      let book = cost,
        dep = 0;
      for (let i = 1; i <= period; i++) {
        dep = book * r * (i === 1 ? month / 12 : i > life ? (12 - month) / 12 : 1);
        book -= dep;
      }
      return dep;
    },
  ),
  def(
    'DDB',
    'Double declining balance depreciation',
    'Calculate declining balance depreciation without switching to straight line.',
    [
      ...assetInputs,
      input('period', 'Depreciation period (starting at 1)'),
      input('factor', 'Declining factor', 'number', { default: 2 }),
    ],
    { cost: 1000, salvage: 100, life: 5, period: 2 },
    240,
    (a) => {
      const { cost, salvage, life } = depreciationInputs(a),
        period = n(a, 'period'),
        factor = positive(n(a, 'factor'), 'Factor');
      if (period < 1 || period > life)
        fail('#NUM!', 'Depreciation period must be between 1 and useful life.');
      if (salvage >= cost) return 0;
      const r = Math.min(factor / life, 1),
        book = cost * (1 - r) ** (period - 1);
      return Math.max(0, Math.min(book * r, book - salvage));
    },
  ),
  def(
    'CUMIPMT',
    'Total loan interest over a period range',
    'Sum the interest portions of loan payments from a first through a last period, inclusive.',
    [
      ...annuityInputs.filter((i) => i.key !== 'fv'),
      input('start', 'First payment period'),
      input('end', 'Last payment period'),
    ],
    { rate: 0.1, nper: 2, pv: 100, start: 1, end: 2 },
    -15.23809523809524,
    (a) => cumulative(a, false),
  ),
  def(
    'CUMPRINC',
    'Total principal repaid over a period range',
    'Sum principal portions of loan payments over an inclusive period range.',
    [
      ...annuityInputs.filter((i) => i.key !== 'fv'),
      input('start', 'First payment period'),
      input('end', 'Last payment period'),
    ],
    { rate: 0.1, nper: 2, pv: 100, start: 1, end: 2 },
    -100,
    (a) => cumulative(a, true),
  ),
  def(
    'MIRR',
    'Modified internal rate of return',
    'Calculate return using separate financing and reinvestment rates for periodic cash flows.',
    [
      ...investmentInputs,
      input('financeRate', 'Financing rate per period (decimal)'),
      input('reinvestRate', 'Reinvestment rate per period (decimal)'),
    ],
    { values: [-100, 0, 121], financeRate: 0.1, reinvestRate: 0.1 },
    0.1,
    (a) => {
      const values = series(a.values),
        finance = n(a, 'financeRate'),
        reinvest = n(a, 'reinvestRate');
      if (finance <= -1 || reinvest <= -1)
        fail('#NUM!', 'Financing and reinvestment rates must exceed -100%.');
      if (values.length < 2 || !values.some((v) => v > 0) || !values.some((v) => v < 0))
        fail('#DIV/0!', 'Modified return needs positive and negative cash flows.');
      const negativePV = values.reduce((s, v, i) => s + (v < 0 ? v / (1 + finance) ** i : 0), 0);
      const positiveFV = values.reduce(
        (s, v, i) => s + (v > 0 ? v * (1 + reinvest) ** (values.length - 1 - i) : 0),
        0,
      );
      return (-positiveFV / negativePV) ** (1 / (values.length - 1)) - 1;
    },
  ),
  def(
    'RRI',
    'Equivalent investment growth rate',
    'Calculate the compound rate needed to grow a present value into a future value.',
    [input('nper', 'Number of periods'), input('pv', 'Present value'), input('fv', 'Future value')],
    { nper: 2, pv: 100, fv: 121 },
    0.1,
    (a) => {
      const periods = positive(n(a, 'nper'), 'Periods'),
        pv = n(a, 'pv'),
        fv = n(a, 'fv');
      if (pv === 0) fail('#DIV/0!', 'Present value cannot be zero.');
      if (fv / pv < 0) fail('#NUM!', 'Present and future values must have the same sign.');
      return (fv / pv) ** (1 / periods) - 1;
    },
  ),
  def(
    'EFFECT',
    'Effective annual interest rate',
    'Convert an annual nominal rate into the effective annual rate after compounding.',
    [
      input('nominalRate', 'Nominal annual rate (decimal)'),
      input('npery', 'Compounding periods per year'),
    ],
    { nominalRate: 0.12, npery: 12 },
    0.12682503013196977,
    (a) => {
      const r = positive(n(a, 'nominalRate'), 'Nominal rate'),
        periods = positive(Math.trunc(n(a, 'npery')), 'Compounding periods');
      return Math.expm1(periods * Math.log1p(r / periods));
    },
  ),
  def(
    'NOMINAL',
    'Nominal annual interest rate',
    'Convert an effective annual rate into a nominal rate for the selected compounding frequency.',
    [
      input('effectiveRate', 'Effective annual rate (decimal)'),
      input('npery', 'Compounding periods per year'),
    ],
    { effectiveRate: 0.12682503013196977, npery: 12 },
    0.12,
    (a) => {
      const r = positive(n(a, 'effectiveRate'), 'Effective rate'),
        periods = positive(Math.trunc(n(a, 'npery')), 'Compounding periods');
      return periods * Math.expm1(Math.log1p(r) / periods);
    },
  ),
  def(
    'PDURATION',
    'Time required for investment growth',
    'Calculate the periods needed to reach a future value at a fixed growth rate.',
    [rateInput, input('pv', 'Present value'), input('fv', 'Future value')],
    { rate: 0.1, pv: 100, fv: 121 },
    2,
    (a) =>
      Math.log(positive(n(a, 'fv'), 'Future value') / positive(n(a, 'pv'), 'Present value')) /
      Math.log1p(positive(n(a, 'rate'), 'Growth rate')),
  ),
  def(
    'SYD',
    'Sum-of-years depreciation',
    'Calculate accelerated depreciation using the sum-of-years’ digits method.',
    [...assetInputs, input('per', 'Depreciation period')],
    { cost: 1000, salvage: 100, life: 5, per: 1 },
    300,
    (a) => {
      const { cost, salvage, life } = depreciationInputs(a),
        per = n(a, 'per');
      if (per < 1 || per > life) fail('#NUM!', 'Period must be within useful life.');
      return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
    },
  ),
  def(
    'VDB',
    'Variable declining balance depreciation',
    'Calculate depreciation over a fractional or whole period range, optionally switching to straight line when beneficial.',
    [
      ...assetInputs,
      input('start', 'Start of depreciation range (zero-based)'),
      input('end', 'End of depreciation range'),
      input('factor', 'Declining factor', 'number', { default: 2 }),
      input('noSwitch', 'Keep declining balance without switching', 'boolean', { default: false }),
    ],
    { cost: 1000, salvage: 100, life: 5, start: 0, end: 2 },
    640,
    variableDepreciation,
  ),
  def(
    'PRICE',
    'Coupon bond price',
    'Calculate the clean price per 100 face value of a regular-coupon security.',
    bondInputs,
    { settlement: '2024-01-01', maturity: '2026-01-01', rate: 0.1, yld: 0.1, frequency: 2 },
    100,
    (a) => bondPrice(a, nonnegative(n(a, 'yld'), 'Annual yield')),
  ),
  def(
    'YIELD',
    'Coupon bond yield',
    'Solve the annual yield of a regular-coupon security from its clean price.',
    [
      ...bondInputs.filter((i) => i.key !== 'yld'),
      input('price', 'Clean price per 100 face value'),
    ],
    { settlement: '2024-01-01', maturity: '2026-01-01', rate: 0.1, price: 100, frequency: 2 },
    0.1,
    (a) => {
      const target = positive(n(a, 'price'), 'Price'),
        { f, count, E, A, DSC } = couponData(a);
      if (count === 1) {
        const coupon = (100 * nonnegative(n(a, 'rate'), 'Coupon rate')) / f;
        return (
          (((positive(n(a, 'redemption'), 'Redemption') + coupon) / (target + (coupon * A) / E) -
            1) *
            f *
            E) /
          DSC
        );
      }
      return solveRate((t) => (bondPrice(a, Math.expm1(t) * f) - target) / target, 0.1 / f) * f;
    },
  ),
  def(
    'DURATION',
    'Macaulay bond duration',
    'Calculate the present-value weighted average time to coupon and redemption cash flows, in years.',
    bondInputs.filter((i) => i.key !== 'redemption'),
    { settlement: '2024-01-01', maturity: '2026-01-01', rate: 0, yld: 0.1, frequency: 2 },
    2,
    duration,
  ),
  def(
    'MDURATION',
    'Modified bond duration',
    'Calculate bond duration adjusted for yield to measure sensitivity to interest-rate changes.',
    bondInputs.filter((i) => i.key !== 'redemption'),
    { settlement: '2024-01-01', maturity: '2026-01-01', rate: 0, yld: 0.1, frequency: 2 },
    1.9047619047619047,
    (a) => duration(a) / (1 + n(a, 'yld') / frequency(a)),
  ),
  def(
    'ACCRINT',
    'Accrued coupon interest',
    'Calculate interest accrued from issue (or first interest) to settlement using the chosen coupon schedule and day-count basis.',
    [
      input('issue', 'Issue date', 'date'),
      input('firstInterest', 'First coupon date', 'date'),
      input('settlement', 'Settlement date', 'date'),
      input('rate', 'Annual coupon rate (decimal)'),
      input('par', 'Face value', 'number', { default: 1000 }),
      frequencyInput,
      basisInput,
      input('calcMethod', 'Accrue from issue even after first coupon', 'boolean', {
        default: true,
      }),
    ],
    {
      issue: '2008-03-01',
      firstInterest: '2008-08-31',
      settlement: '2008-05-01',
      rate: 0.1,
      par: 1000,
      frequency: 2,
    },
    16.666666666666668,
    (a) => {
      const issue = date(a.issue, 'Issue'),
        first = date(a.firstInterest, 'First interest'),
        settlement = date(a.settlement, 'Settlement'),
        f = frequency(a),
        basis = basisValue(a);
      if (issue >= settlement || first <= issue)
        fail('#NUM!', 'Issue must precede settlement and the first coupon date.');
      const par = positive(n(a, 'par'), 'Face value'),
        r = positive(n(a, 'rate'), 'Coupon rate');
      const start = a.calcMethod === false && settlement > first ? first : issue;
      let k = 0,
        prev = first;
      while (prev > start) {
        prev = shiftMonths(first, (--k * 12) / f);
        if (k < -40000) fail('#NUM!', 'Accrual schedule is too long.');
      }
      let next = shiftMonths(first, ((k + 1) * 12) / f),
        total = 0;
      for (let steps = 0; prev < settlement; steps++) {
        if (steps > 40000) fail('#NUM!', 'Accrual schedule is too long.');
        const from = prev > start ? prev : start,
          to = next < settlement ? next : settlement;
        const E = basis === 1 ? actualDays(prev, next) : (basis === 3 ? 365 : 360) / f;
        total += dayCount(from, to, basis) / E;
        prev = next;
        next = shiftMonths(first, ((++k + 1) * 12) / f);
      }
      return ((par * r) / f) * total;
    },
  ),
  def(
    'DISC',
    'Security discount rate',
    'Calculate the annual discount rate of a security from its price and redemption value.',
    [
      ...maturityInputs,
      input('price', 'Price'),
      input('redemption', 'Redemption value', 'number', { default: 100 }),
      basisInput,
    ],
    { settlement: '2024-01-01', maturity: '2025-01-01', price: 95, redemption: 100, basis: 0 },
    0.05,
    (a) => {
      const { settlement, maturity, basis } = security(a);
      return (
        (((positive(n(a, 'redemption'), 'Redemption') - positive(n(a, 'price'), 'Price')) /
          n(a, 'redemption')) *
          annualDays(settlement, basis)) /
        dayCount(settlement, maturity, basis)
      );
    },
  ),
  def(
    'INTRATE',
    'Fully invested security interest rate',
    'Calculate an annual simple interest rate from investment and redemption amounts.',
    [
      ...maturityInputs,
      input('investment', 'Investment amount'),
      input('redemption', 'Redemption amount'),
      basisInput,
    ],
    {
      settlement: '2024-01-01',
      maturity: '2025-01-01',
      investment: 100,
      redemption: 110,
      basis: 0,
    },
    0.1,
    (a) => {
      const { settlement, maturity, basis } = security(a);
      const investment = positive(n(a, 'investment'), 'Investment'),
        redemption = positive(n(a, 'redemption'), 'Redemption');
      return (
        (((redemption - investment) / investment) * annualDays(settlement, basis)) /
        dayCount(settlement, maturity, basis)
      );
    },
  ),
  def(
    'TBILLPRICE',
    'Treasury bill price',
    'Calculate the price per 100 face value of a Treasury bill using an actual/360 bank discount rate.',
    [...maturityInputs, input('discount', 'Annual discount rate (decimal)')],
    { settlement: '2024-01-01', maturity: '2024-06-29', discount: 0.05 },
    97.5,
    (a) => {
      const { settlement, maturity } = security(a),
        days = actualDays(settlement, maturity);
      if (days > 365) fail('#NUM!', 'Treasury bill maturity must be within 365 days.');
      return 100 * (1 - (positive(n(a, 'discount'), 'Discount rate') * days) / 360);
    },
  ),
  def(
    'TBILLYIELD',
    'Treasury bill yield',
    'Calculate the actual/360 simple yield of a Treasury bill from its price per 100 face value.',
    [...maturityInputs, input('price', 'Price per 100 face value')],
    { settlement: '2024-01-01', maturity: '2024-06-29', price: 97.5 },
    0.05128205128205128,
    (a) => {
      const { settlement, maturity } = security(a),
        days = actualDays(settlement, maturity);
      if (days > 365) fail('#NUM!', 'Treasury bill maturity must be within 365 days.');
      const price = positive(n(a, 'price'), 'Price');
      return (((100 - price) / price) * 360) / days;
    },
  ),
];
