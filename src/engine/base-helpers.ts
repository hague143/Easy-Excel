import { fail, flatten, numeric } from './types';
import type { CalcContext } from './types';

export function checkError(v: any): void {
  if (v && typeof v === 'object' && 'error' in v) fail(v.error, v.message || v.error);
  if (v instanceof Error) fail(v.message.startsWith('#') ? v.message : '#VALUE!', v.message);
}
export const asNumber = (v: any): number => {
  checkError(v);
  return numeric(v);
};
export const asText = (v: any): string => {
  checkError(v);
  return v === null || v === undefined
    ? ''
    : typeof v === 'boolean'
      ? v
        ? 'TRUE'
        : 'FALSE'
      : String(v);
};
export const range = (v: any): any[] => flatten(v === undefined ? [] : v);
export function nums(v: any, ignoreErrors = false): number[] {
  const a = range(v);
  if (!ignoreErrors) a.forEach(checkError);
  return a.filter((n) => typeof n === 'number' && Number.isFinite(n));
}
export function integer(v: any, label = 'Value'): number {
  const n = asNumber(v);
  if (!Number.isFinite(n)) fail('#VALUE!', `${label} must be finite.`);
  return Math.trunc(n);
}
export function logical(v: any): boolean {
  checkError(v);
  if (v === null || v === '') return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string' && /^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  return fail('#VALUE!', 'Choose a Boolean value.');
}
export function roundHalfAway(value: number, digits = 0, direction = 0): number {
  if (Math.abs(digits) > 308) return digits > 0 ? value : 0;
  // Decimal exponent shifts avoid binary midpoint drift (e.g. 1.005 at two decimals).
  const shift = (v: number, places: number): number => {
    const [coefficient, exponent = '0'] = String(v).split('e');
    return Number(`${coefficient}e${Number(exponent) + places}`);
  };
  const magnitude = shift(Math.abs(value), digits);
  if (!Number.isFinite(magnitude)) return value;
  const rounded =
    direction > 0
      ? Math.ceil(magnitude)
      : direction < 0
        ? Math.floor(magnitude)
        : Math.round(magnitude);
  return Math.sign(value) * shift(rounded, -digits);
}
export function criterion(criteria: any): (v: any) => boolean {
  checkError(criteria);
  if (criteria === null || criteria === undefined) criteria = 0;
  if (typeof criteria !== 'string')
    return (v) =>
      typeof criteria === 'number' ? (v === null ? 0 : v) === criteria : v === criteria;
  const match = /^(<=|>=|<>|=|<|>)(.*)$/s.exec(criteria);
  const op = match?.[1] || '=',
    raw = match?.[2] ?? criteria;
  const n = raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
  let pattern = '',
    wildcard = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '~' && i + 1 < raw.length && /[?*~]/.test(raw[i + 1])) {
      pattern += raw[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      wildcard = true;
    } else if (c === '*') {
      pattern += '.*';
      wildcard = true;
    } else if (c === '?') {
      pattern += '.';
      wildcard = true;
    } else pattern += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const re = new RegExp(`^${pattern}$`, 'is');
  return (v) => {
    if (v && typeof v === 'object') {
      if ('error' in v && /^#/.test(raw) && (op === '=' || op === '<>')) {
        const match = String(v.error).toLowerCase() === raw.toLowerCase();
        return op === '=' ? match : !match;
      }
      return false;
    }
    if (raw === '' && (op === '=' || op === '<>'))
      return op === '=' ? v === null || v === '' : v !== null && v !== '';
    if (wildcard && (op === '=' || op === '<>')) {
      const hit = typeof v === 'string' && re.test(v);
      return op === '=' ? hit : !hit;
    }
    let x: any = v === null ? 0 : v,
      y: any = n ?? raw;
    if (n !== null && typeof x === 'string') {
      if (x.trim() === '' || !Number.isFinite(Number(x))) return op === '<>';
      x = Number(x);
    }
    if (n === null) {
      if (typeof x !== 'string') return op === '<>';
      x = x.toLowerCase();
      y = raw.toLowerCase();
    }
    switch (op) {
      case '=':
        return x === y;
      case '<>':
        return x !== y;
      case '<':
        return x < y;
      case '>':
        return x > y;
      case '<=':
        return x <= y;
      case '>=':
        return x >= y;
      default:
        return false;
    }
  };
}
export function conditionalRows(
  args: Record<string, any>,
  plural = false,
): { data: any[]; matches: boolean[] } {
  const source = args.data ?? args.sumRange ?? args.averageRange ?? args.range;
  const data = range(source);
  const dimensions = (v: any): string => {
    if (!Array.isArray(v)) return '1:1';
    if (!Array.isArray(v[0])) return `${v.length}:1`;
    const width = v[0].length;
    if (v.some((r: any) => !Array.isArray(r) || r.length !== width))
      fail('#VALUE!', 'Condition ranges must be rectangular.');
    return `${v.length}:${width}`;
  };
  const shape = dimensions(source);
  const conditions = plural ? args.conditions : [{ range: args.range, criteria: args.criteria }];
  if (!Array.isArray(conditions) || !conditions.length)
    fail('#VALUE!', 'Add at least one condition.');
  const tests = conditions.map((c: any) => {
    const values = range(c.range);
    if (values.length !== data.length || dimensions(c.range) !== shape)
      fail('#VALUE!', 'All condition ranges must have the same dimensions.');
    return { values, test: criterion(c.criteria) };
  });
  return {
    data,
    matches: data.map((_, i) =>
      tests.every((t: { values: any[]; test: (v: any) => boolean }) => t.test(t.values[i])),
    ),
  };
}
export const MS_DAY = 86400000;
const BASE = Date.UTC(1899, 11, 31);
export function serialFromCivil(year: number, month: number, day: number): number {
  if (year === 1900 && month === 2 && day === 29) return 60;
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(0, 0, 0, 0);
  const raw = Math.round((d.getTime() - BASE) / MS_DAY);
  return raw + (d.getTime() >= Date.UTC(1900, 2, 1) ? 1 : 0);
}
export function dateSerial(v: any): number {
  checkError(v);
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0 || v >= 2958466)
      fail('#NUM!', 'Date must fall within Excel’s 1900 date system (0–2958465).');
    return v;
  }
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) fail('#VALUE!', 'Invalid date.');
    return (
      serialFromCivil(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) +
      (v.getUTCHours() * 3600 +
        v.getUTCMinutes() * 60 +
        v.getUTCSeconds() +
        v.getUTCMilliseconds() / 1000) /
        86400
    );
  }
  const text = asText(v).trim();
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(AM|PM)?$/i.exec(text);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2]),
      second = Number(clock[3] || 0) + Number(clock[4] || 0),
      period = clock[5]?.toUpperCase();
    if (hour > 23 || minute > 59 || second >= 60 || (period && (hour < 1 || hour > 12)))
      fail('#VALUE!', 'Invalid clock time.');
    if (period) hour = (hour % 12) + (period === 'PM' ? 12 : 0);
    return (hour * 3600 + minute * 60 + second) / 86400;
  }
  const m =
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z)?)?$/.exec(
      text,
    );
  if (!m) fail('#VALUE!', 'Use an unambiguous ISO date: YYYY-MM-DD, or an Excel date serial.');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > monthDays(y, mo) || y < 1900 || y > 9999)
    fail('#VALUE!', 'Invalid calendar date.');
  const h = Number(m[4] || 0),
    mi = Number(m[5] || 0),
    s = Number(m[6] || 0),
    ms = Number((m[7] || '').padEnd(3, '0'));
  if (h > 23 || mi > 59 || s > 59) fail('#VALUE!', 'Invalid time.');
  return serialFromCivil(y, mo, d) + (h * 3600 + mi * 60 + s + ms / 1000) / 86400;
}
export function civilFromSerial(value: any): { year: number; month: number; day: number } {
  const s = Math.floor(dateSerial(value));
  if (s === 0) return { year: 1900, month: 1, day: 0 };
  if (s === 60) return { year: 1900, month: 2, day: 29 };
  const d = new Date(BASE + (s >= 60 ? s - 1 : s) * MS_DAY);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: s === 0 ? 0 : d.getUTCDate(),
  };
}
export function monthDays(y: number, m: number): number {
  if (y === 1900 && m === 2) return 29;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function actualMonthDays(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function utcToday(context: CalcContext): number {
  const now = context.now ? new Date(context.now) : new Date();
  if (!Number.isFinite(now.getTime())) fail('#VALUE!', 'Invalid calculation clock.');
  return dateSerial(now);
}
export function weekendMask(v: any = 1): string {
  checkError(v);
  if (typeof v === 'string' && /^[01]{7}$/.test(v)) {
    if (v === '1111111') fail('#VALUE!', 'At least one working day is required.');
    return v;
  }
  const n = Number(v);
  if (n >= 1 && n <= 7 && Number.isInteger(n)) {
    const first = (n + 4) % 7;
    return Array.from({ length: 7 }, (_, i) =>
      i === first || i === (first + 1) % 7 ? '1' : '0',
    ).join('');
  }
  if (n >= 11 && n <= 17 && Number.isInteger(n)) {
    const index = (n + 2) % 7;
    return Array.from({ length: 7 }, (_, i) => (i === index ? '1' : '0')).join('');
  }
  return fail('#NUM!', 'Weekend must be 1–7, 11–17, or a seven-character Monday-to-Sunday mask.');
}
export const weekdayMonday = (s: number): number => (((Math.floor(s) + 5) % 7) + 7) % 7;
export function holidaySet(v: any): Set<number> {
  return new Set(
    range(v)
      .filter((x) => x !== null && x !== '')
      .map((x) => Math.floor(dateSerial(x))),
  );
}
export function workingDays(start: any, end: any, weekend: any, holidays: any): number {
  const a = Math.floor(dateSerial(start)),
    b = Math.floor(dateSerial(end)),
    sign = a <= b ? 1 : -1;
  const mask = weekendMask(weekend),
    off = holidaySet(holidays);
  let count = 0;
  for (let s = Math.min(a, b); s <= Math.max(a, b); s++)
    if (mask[weekdayMonday(s)] === '0' && !off.has(s)) count++;
  return sign * count;
}
