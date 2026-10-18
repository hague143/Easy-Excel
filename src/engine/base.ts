import { fail } from './types';
import type { CalcContext, FunctionDef, InputDef } from './types';
import { colIndex, colLetter } from './bindings';
import {
  asNumber as n,
  asText as t,
  checkError,
  nums,
  range,
  integer,
  logical,
  roundHalfAway,
  conditionalRows,
  dateSerial,
  civilFromSerial,
  serialFromCivil,
  monthDays,
  utcToday,
  weekendMask,
  weekdayMonday,
  holidaySet,
  workingDays,
} from './base-helpers';

const basic = 'Basic mathematics',
  logic = 'Logic and conditional',
  text = 'Text and cleaning',
  dates = 'Dates and times',
  validation = 'Validation';
const inp = (
  key: string,
  label: string,
  type: InputDef['type'] = 'number',
  value?: any,
  description?: string,
): InputDef => ({
  key,
  label,
  type,
  required: value === undefined,
  ...(value !== undefined ? { default: value } : {}),
  ...(description ? { description } : {}),
});
const data = inp('data', 'Values', 'data');
const value = inp('value', 'Value', 'number');
const source = inp('text', 'Source text', 'text');
const dateInput = (key: string, label: string) => inp(key, label, 'date');
const collection: FunctionDef[] = [];
function def(
  name: string,
  friendlyName: string,
  category: string,
  inputs: InputDef[],
  args: Record<string, any>,
  expected: any,
  calculate: FunctionDef['calculate'],
  aliases: string[] = [],
  compatibility: string[] = [],
  output = 'number',
  context?: CalcContext,
) {
  const defaults = Object.fromEntries(
    inputs.filter((i) => i.default !== undefined).map((i) => [i.key, i.default]),
  );
  collection.push({
    name,
    friendlyName,
    categories: [category],
    aliases: [
      ...aliases,
      category === basic
        ? 'hisab'
        : category === dates
          ? 'tareekh'
          : category === text
            ? 'alfaaz'
            : category === validation
              ? 'jaanchen'
              : 'shart',
    ],
    description: `${friendlyName}. Select the relevant values and settings, then calculate.`,
    inputs,
    defaults,
    output,
    example: { args, expected, ...(context ? { context } : {}) },
    compatibility: [
      'Excel 1900 date system; calculation uses full JavaScript double precision.',
      ...compatibility,
    ],
    testRefs: ['tests/base.test.ts'],
    calculate: (a, c) => calculate({ ...defaults, ...a }, c),
  });
}
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const mean = (a: number[]) =>
  a.length ? sum(a) / a.length : fail('#DIV/0!', 'No numeric values were selected.');
const variance = (a: number[], sample: boolean) => {
  if (a.length < (sample ? 2 : 1)) return fail('#DIV/0!', 'Insufficient numeric observations.');
  const m = mean(a);
  return sum(a.map((v) => (v - m) ** 2)) / (a.length - (sample ? 1 : 0));
};
const median = (a: number[]) => {
  if (!a.length) return fail('#NUM!', 'No numeric values.');
  const b = [...a].sort((x, y) => x - y),
    i = Math.floor(b.length / 2);
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2;
};
const percentile = (a: number[], p: number, exclusive = false) => {
  const b = [...a].sort((x, y) => x - y);
  const k = exclusive ? p * (b.length + 1) - 1 : p * (b.length - 1);
  if (!b.length || p < 0 || p > 1 || k < 0 || k > b.length - 1)
    return fail('#NUM!', 'Percentile lies outside the permitted interval.');
  const i = Math.floor(k);
  return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (k - i);
};
const mode = (a: number[]) => {
  const counts = new Map<number, number>();
  a.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const highest = [...counts.values()].reduce((m, c) => Math.max(m, c), 0);
  if (highest < 2) return fail('#N/A', 'No repeated numeric value.');
  return [...counts].find(([, c]) => c === highest)![0];
};
function aggregate(a: any[], fn: number, k?: any): number {
  const x = nums(a, fn === 2 || fn === 3);
  switch (fn) {
    case 1:
      return mean(x);
    case 2:
      return x.length;
    case 3:
      return a.filter((v) => v !== null && v !== undefined).length;
    case 4:
      return x.length ? x.reduce((m, v) => Math.max(m, v), -Infinity) : 0;
    case 5:
      return x.length ? x.reduce((m, v) => Math.min(m, v), Infinity) : 0;
    case 6:
      return x.length ? x.reduce((p, v) => p * v, 1) : 0;
    case 7:
      return Math.sqrt(variance(x, true));
    case 8:
      return Math.sqrt(variance(x, false));
    case 9:
      return sum(x);
    case 10:
      return variance(x, true);
    case 11:
      return variance(x, false);
    case 12:
      return median(x);
    case 13:
      return mode(x);
    case 14:
    case 15: {
      const rank = integer(k);
      if (rank < 1 || rank > x.length) return fail('#NUM!', 'Rank is outside the data.');
      return [...x].sort((a, b) => (fn === 14 ? b - a : a - b))[rank - 1];
    }
    case 16:
      return percentile(x, n(k));
    case 17:
      return percentile(x, integer(k) / 4);
    case 18:
      return percentile(x, n(k), true);
    case 19:
      return percentile(x, integer(k) / 4, true);
    default:
      return fail('#VALUE!', 'Unknown aggregation function.');
  }
}
function visibleValues(
  a: Record<string, any>,
  c: CalcContext,
  ignoreHidden: boolean,
  ignoreErrors: boolean,
  ignoreNested: boolean,
): any[] {
  const sheet = c.workbook?.sheets.find((s) => s.id === c.sheetId) || c.workbook?.sheets[0];
  const start = integer(a.startRow ?? 2) - 2;
  if (start < -1) fail('#VALUE!', 'First row must be at least 1.');
  const width = Array.isArray(a.data?.[0]) ? a.data[0].length : 1;
  if (
    !width ||
    (Array.isArray(a.data?.[0]) && a.data.some((r: any) => !Array.isArray(r) || r.length !== width))
  )
    fail('#VALUE!', 'Select a rectangular summary range.');
  const firstColumn = t(a.column || 'A').toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(firstColumn) || colIndex(firstColumn) + width > 16384)
    fail('#REF!', 'Enter the first selected column letter, from A through XFD.');
  const columns = Array.from({ length: width }, (_, i) => colLetter(colIndex(firstColumn) + i));
  const nested = new Set(
    ignoreNested
      ? Object.entries(sheet?.formulae || {})
          .filter(([, formula]) => /^=?\s*(SUBTOTAL|AGGREGATE)\s*\(/i.test(formula))
          .map(([address]) => address.toUpperCase().replace(/\$/g, ''))
      : [],
  );
  return range(a.data).filter((v, i) => {
    const row = start + Math.floor(i / width);
    if (sheet?.filteredRows?.includes(row) || (ignoreHidden && sheet?.hiddenRows?.includes(row)))
      return false;
    if (ignoreErrors && v && typeof v === 'object' && 'error' in v) return false;
    if (nested.has(columns[i % width] + (row + 2))) return false;
    return true;
  });
}
const basicDefs: [string, string, (a: Record<string, any>) => any, any, string[]][] = [
  ['SUM', 'Add up a column', (a) => sum(nums(a.data)), 6, ['total', 'jama', 'salary', 'tankhwa']],
  ['AVERAGE', 'Find the average', (a) => mean(nums(a.data)), 2, ['ausat', 'mean']],
  [
    'MIN',
    'Find the lowest value',
    (a) => {
      const x = nums(a.data);
      return x.length ? x.reduce((m, v) => Math.min(m, v), Infinity) : 0;
    },
    1,
    ['lowest', 'sab se chota'],
  ],
  [
    'MAX',
    'Find the highest value',
    (a) => {
      const x = nums(a.data);
      return x.length ? x.reduce((m, v) => Math.max(m, v), -Infinity) : 0;
    },
    3,
    ['highest', 'sab se bara'],
  ],
  ['COUNT', 'Count numeric cells', (a) => nums(a.data, true).length, 3, ['numbers', 'ginna']],
  [
    'COUNTA',
    'Count nonblank cells',
    (a) => range(a.data).filter((v) => v !== null && v !== undefined).length,
    3,
    ['filled cells', 'bhare huay'],
  ],
  [
    'COUNTBLANK',
    'Count blank and empty cells',
    (a) => range(a.data).filter((v) => v === null || v === undefined || v === '').length,
    0,
    ['khali', 'empty cells'],
  ],
  [
    'PRODUCT',
    'Multiply values',
    (a) => {
      const x = nums(a.data);
      return x.length ? x.reduce((p, v) => p * v, 1) : 0;
    },
    6,
    ['multiply', 'zarb'],
  ],
];
for (const [name, label, calc, expected, aliases] of basicDefs)
  def(name, label, basic, [data], { data: [1, 2, 3] }, expected, (a) => calc(a), aliases, [
    'Range inputs ignore text and Boolean cells; null represents a blank and empty text remains distinct.',
  ]);
def('ABS', 'Absolute value', basic, [value], { value: -7 }, 7, (a) => Math.abs(n(a.value)), [
  'positive magnitude',
]);
for (const [name, label, mode] of [
  ['ROUND', 'Round to decimal places', 0],
  ['ROUNDUP', 'Round away from zero', 1],
  ['ROUNDDOWN', 'Round toward zero', -1],
] as const)
  def(
    name,
    label,
    basic,
    [value, inp('digits', 'Decimal places', 'number', 0)],
    { value: -1.25, digits: 1 },
    mode === -1 ? -1.2 : -1.3,
    (a) => roundHalfAway(n(a.value), integer(a.digits), mode),
    ['rounding', 'gol'],
  );
def(
  'INT',
  'Round down to an integer',
  basic,
  [value],
  { value: -2.3 },
  -3,
  (a) => Math.floor(n(a.value)),
  ['integer'],
);
def(
  'MOD',
  'Remainder after division',
  basic,
  [value, inp('divisor', 'Divisor')],
  { value: -3, divisor: 2 },
  1,
  (a) => {
    const d = n(a.divisor);
    if (!d) fail('#DIV/0!', 'Divisor cannot be zero.');
    return n(a.value) - d * Math.floor(n(a.value) / d);
  },
  ['remainder', 'baqi'],
);
def(
  'QUOTIENT',
  'Integer part of division',
  basic,
  [value, inp('divisor', 'Divisor')],
  { value: -7, divisor: 3 },
  -2,
  (a) => {
    const d = n(a.divisor);
    if (!d) fail('#DIV/0!', 'Divisor cannot be zero.');
    return Math.trunc(n(a.value) / d);
  },
  ['division'],
);
const subtotalOptions = [
  ['Average', 1],
  ['Count numbers', 2],
  ['Count values', 3],
  ['Maximum', 4],
  ['Minimum', 5],
  ['Product', 6],
  ['Sample standard deviation', 7],
  ['Population standard deviation', 8],
  ['Sum', 9],
  ['Sample variance', 10],
  ['Population variance', 11],
].map(([label, v]) => ({ label: String(label), value: Number(v) }));
def(
  'SUBTOTAL',
  'Summarize visible rows',
  basic,
  [
    data,
    {
      key: 'functionNum',
      label: 'Summary type (101–111 also exclude hidden rows)',
      type: 'select',
      default: 9,
      options: [
        ...subtotalOptions,
        ...subtotalOptions.map((o) => ({
          label: `${o.label}; ignore hidden rows`,
          value: Number(o.value) + 100,
        })),
      ],
    },
    inp('startRow', 'First worksheet row (row 1 contains headers)', 'number', 2),
    inp(
      'column',
      'Reference column for nested-summary metadata',
      'text',
      'A',
      'Enter the first selected column letter. For a block B2:D10, use B here and 2 as the first worksheet row.',
    ),
  ],
  { data: [1, 2, 3], functionNum: 9 },
  6,
  (a, c) => {
    let fn = integer(a.functionNum);
    const hidden = fn >= 100;
    if (hidden) fn -= 100;
    if (fn < 1 || fn > 11) fail('#VALUE!', 'Choose function 1–11 or 101–111.');
    return aggregate(visibleValues(a, c, hidden, false, true), fn);
  },
  ['filtered total', 'visible total'],
  [
    'Filtered rows and nested subtotal/aggregate rows are excluded. Hidden rows are excluded by function numbers 101–111. Worksheet hiddenRows/filteredRows use zero-based indexes; startRow is one-based, and column identifies the metadata column.',
  ],
);
def(
  'AGGREGATE',
  'Advanced visible-row summary',
  basic,
  [
    data,
    inp('functionNum', 'Function number (1–19)', 'number', 9),
    {
      key: 'options',
      label: 'Ignore options',
      type: 'select',
      default: 6,
      options: [
        { label: '0: nested summaries', value: 0 },
        { label: '1: hidden rows and nested summaries', value: 1 },
        { label: '2: errors and nested summaries', value: 2 },
        { label: '3: hidden rows, errors, nested summaries', value: 3 },
        { label: '4: nothing', value: 4 },
        { label: '5: hidden rows', value: 5 },
        { label: '6: errors', value: 6 },
        { label: '7: hidden rows and errors', value: 7 },
      ],
    },
    inp('k', 'Rank, percentile, or quartile (functions 14–19)', 'number', 1),
    inp('startRow', 'First worksheet row (row 1 contains headers)', 'number', 2),
    inp(
      'column',
      'Reference column for nested-summary metadata',
      'text',
      'A',
      'Enter the first selected column letter. For a block B2:D10, use B here and 2 as the first worksheet row.',
    ),
  ],
  { data: [1, 2, 3], functionNum: 9, options: 6 },
  6,
  (a, c) => {
    const fn = integer(a.functionNum),
      opt = integer(a.options);
    if (fn < 1 || fn > 19 || opt < 0 || opt > 7)
      fail('#VALUE!', 'Function must be 1–19 and options 0–7.');
    return aggregate(
      visibleValues(a, c, [1, 3, 5, 7].includes(opt), [2, 3, 6, 7].includes(opt), opt < 4),
      fn,
      a.k,
    );
  },
  ['advanced total'],
  [
    'Requires a reference-style range for worksheet visibility rules. Function 14–19 k is rank (LARGE/SMALL), probability (percentile), or integer quartile 0–4 (inclusive)/1–3 (exclusive).',
  ],
);

// Logical functions preserve branch errors until the selected branch is returned.
def(
  'IF',
  'Choose a result from a condition',
  logic,
  [
    inp('condition', 'Condition', 'boolean'),
    inp('ifTrue', 'Result when true', 'text', 'Yes'),
    inp('ifFalse', 'Result when false', 'text', 'No'),
  ],
  { condition: true, ifTrue: 'Pass', ifFalse: 'Fail' },
  'Pass',
  (a) => {
    const v = logical(a.condition) ? a.ifTrue : a.ifFalse;
    checkError(v);
    return v;
  },
  ['pass fail', 'agar'],
  [],
  'mixed',
);
def(
  'IFS',
  'Choose the first matching condition',
  logic,
  [inp('conditions', 'Conditions and results', 'conditions')],
  {
    conditions: [
      { condition: false, value: 'Fail' },
      { condition: true, value: 'Pass' },
    ],
  },
  'Pass',
  (a) => {
    if (!Array.isArray(a.conditions) || !a.conditions.length)
      fail('#VALUE!', 'Add conditions with condition and value.');
    for (const c of a.conditions)
      if (logical(c.condition)) {
        checkError(c.value);
        return c.value;
      }
    return fail('#N/A', 'No condition is true.');
  },
  ['grade bands', 'student grade', 'darja'],
  [],
  'mixed',
);
for (const name of ['AND', 'OR'])
  def(
    name,
    name === 'AND' ? 'Require all conditions' : 'Require any condition',
    logic,
    [data],
    { data: [true, false] },
    name === 'OR',
    (a) => {
      const vals = range(a.data).filter(
        (v) => typeof v !== 'string' && v !== null && v !== undefined,
      );
      vals.forEach(checkError);
      if (!vals.length) fail('#VALUE!', 'No logical values.');
      return name === 'AND' ? vals.every(logical) : vals.some(logical);
    },
    [name === 'AND' ? 'sab shartein' : 'koi shart'],
    [],
    'boolean',
  );
def(
  'NOT',
  'Reverse a condition',
  logic,
  [inp('value', 'Condition', 'boolean')],
  { value: true },
  false,
  (a) => !logical(a.value),
  ['opposite', 'ulta'],
  [],
  'boolean',
);
def(
  'SWITCH',
  'Match a value to named choices',
  logic,
  [
    inp('value', 'Value to match', 'text'),
    inp('cases', 'Choices (match and value)', 'conditions'),
    inp('default', 'Default result', 'text', null),
  ],
  {
    value: 'B',
    cases: [
      { match: 'A', value: 1 },
      { match: 'B', value: 2 },
    ],
  },
  2,
  (a) => {
    checkError(a.value);
    if (!Array.isArray(a.cases) || !a.cases.length) fail('#VALUE!', 'Add match/value choices.');
    const found = a.cases.find((c: any) =>
      typeof c.match === 'string' && typeof a.value === 'string'
        ? c.match.toLowerCase() === a.value.toLowerCase()
        : c.match === a.value,
    );
    if (found) {
      checkError(found.value);
      return found.value;
    }
    if (a.default !== null) {
      checkError(a.default);
      return a.default;
    }
    return fail('#N/A', 'No matching choice and no default result.');
  },
  ['choices', 'intikhab'],
  [],
  'mixed',
);
for (const name of ['IFERROR', 'IFNA'])
  def(
    name,
    name === 'IFERROR' ? 'Replace a calculation error' : 'Replace a missing-match error',
    logic,
    [inp('value', 'Value', 'data'), inp('fallback', 'Replacement', 'text', 'Unavailable')],
    { value: { error: '#N/A' }, fallback: 'Missing' },
    'Missing',
    (a) => {
      const v = a.value;
      if (
        v &&
        typeof v === 'object' &&
        'error' in v &&
        (name === 'IFERROR' || v.error === '#N/A')
      ) {
        checkError(a.fallback);
        return a.fallback;
      }
      checkError(v);
      return v;
    },
    ['error replacement', 'galti'],
    [],
    'mixed',
  );
for (const name of [
  'SUMIF',
  'SUMIFS',
  'COUNTIF',
  'COUNTIFS',
  'AVERAGEIF',
  'AVERAGEIFS',
  'MAXIFS',
  'MINIFS',
]) {
  const plural = name.endsWith('IFS'),
    count = name.startsWith('COUNT');
  const inputs: InputDef[] = plural
    ? [data, inp('conditions', 'AND conditions: range and criteria', 'conditions')]
    : [
        inp('range', 'Condition values', 'data'),
        inp('criteria', 'Condition (e.g. >=50 or Sales)', 'text'),
        ...(!count
          ? [
              inp(
                name === 'SUMIF' ? 'sumRange' : 'averageRange',
                'Values to summarize (leave empty to use condition values)',
                'data',
                null,
              ),
            ]
          : []),
      ];
  const args = plural
    ? { data: [10, 20, 30], conditions: [{ range: ['A', 'B', 'A'], criteria: 'A' }] }
    : { range: [10, 20, 30], criteria: '>10' };
  const expected = name.startsWith('SUM')
    ? plural
      ? 40
      : 50
    : count
      ? 2
      : name.startsWith('AVERAGE')
        ? plural
          ? 20
          : 25
        : name === 'MAXIFS'
          ? 30
          : 10;
  def(
    name,
    name.startsWith('SUM')
      ? 'Total values matching conditions'
      : count
        ? 'Count values matching conditions'
        : name.startsWith('AVERAGE')
          ? 'Average values matching conditions'
          : name === 'MAXIFS'
            ? 'Highest value matching conditions'
            : 'Lowest value matching conditions',
    logic,
    inputs,
    args,
    expected,
    (a) => {
      const { data: values, matches } = conditionalRows(a, plural);
      const selected = values.filter((_, i) => matches[i]);
      if (count) return selected.length;
      const x = nums(selected);
      if (name.startsWith('SUM')) return sum(x);
      if (name.startsWith('AVERAGE')) return mean(x);
      return x.length
        ? name === 'MAXIFS'
          ? x.reduce((m, v) => Math.max(m, v), -Infinity)
          : x.reduce((m, v) => Math.min(m, v), Infinity)
        : 0;
    },
    ['conditional', 'shart', 'department', 'sales'],
    [
      'Criteria support =, <>, <, >, <=, >= and case-insensitive * / ? wildcards with ~ escaping. Multiple conditions use AND. All selected ranges must have matching dimensions.',
    ],
  );
}

// Text operations use Unicode code points (modern Excel compatibility version 2).
const chars = (v: any) => Array.from(t(v));
for (const [name, label, calc, example, expected] of [
  [
    'LEFT',
    'First characters',
    (a: any) => chars(a.text).slice(0, nonnegative(a.count)).join(''),
    { text: 'SheetPilot', count: 5 },
    'Sheet',
  ],
  [
    'RIGHT',
    'Last characters',
    (a: any) => {
      const c = nonnegative(a.count);
      return c ? chars(a.text).slice(-c).join('') : '';
    },
    { text: 'SheetPilot', count: 5 },
    'Pilot',
  ],
] as const)
  def(
    name,
    label,
    text,
    [source, inp('count', 'Character count', 'number', 1)],
    example,
    expected,
    calc,
    ['characters', 'huroof'],
    [],
    'text',
  );
function nonnegative(v: any): number {
  const x = integer(v);
  if (x < 0) fail('#VALUE!', 'Count must not be negative.');
  return x;
}
def(
  'MID',
  'Extract characters from a position',
  text,
  [source, inp('start', 'Starting character (1-based)'), inp('count', 'Character count')],
  { text: 'SheetPilot', start: 6, count: 5 },
  'Pilot',
  (a) => {
    const start = integer(a.start);
    if (start < 1) fail('#VALUE!', 'Start must be at least 1.');
    return chars(a.text)
      .slice(start - 1, start - 1 + nonnegative(a.count))
      .join('');
  },
  ['middle characters'],
  [],
  'text',
);
def('LEN', 'Count characters', text, [source], { text: 'Sheet' }, 5, (a) => chars(a.text).length, [
  'length',
  'lambai',
]);
for (const [name, label, calc, args, expected] of [
  [
    'TRIM',
    'Remove extra spaces',
    (s: string) => s.replace(/^ +| +$/g, '').replace(/ +/g, ' '),
    { text: '  Ali   Khan  ' },
    'Ali Khan',
  ],
  [
    'CLEAN',
    'Remove control characters',
    (s: string) => s.replace(/[\x00-\x1F]/g, ''),
    { text: 'A\tB\n' },
    'AB',
  ],
  ['UPPER', 'Convert to uppercase', (s: string) => s.toUpperCase(), { text: 'Ali' }, 'ALI'],
  ['LOWER', 'Convert to lowercase', (s: string) => s.toLowerCase(), { text: 'Ali' }, 'ali'],
  [
    'PROPER',
    'Capitalize words',
    (s: string) =>
      s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()),
    { text: 'ali KHAN' },
    'Ali Khan',
  ],
] as const)
  def(
    name,
    label,
    text,
    [source],
    args,
    expected,
    (a) => calc(t(a.text)),
    [name === 'TRIM' ? 'extra spaces' : 'clean text', 'safai'],
    name === 'TRIM' ? ['TRIM removes ASCII spaces; nonbreaking spaces remain, as in Excel.'] : [],
    'text',
  );
for (const name of ['CONCAT', 'CONCATENATE'])
  def(
    name,
    'Join text values',
    text,
    [data],
    { data: ['Ali', ' ', 'Khan'] },
    'Ali Khan',
    (a) => {
      const out = range(a.data).map(t).join('');
      if (out.length > 32767) fail('#VALUE!', 'Result exceeds 32,767 characters.');
      return out;
    },
    ['join text', 'jorna'],
    [],
    'text',
  );
def(
  'TEXTJOIN',
  'Join values with a separator',
  text,
  [
    data,
    inp('delimiter', 'Separator', 'text', ', '),
    inp('ignoreEmpty', 'Skip blank and empty text', 'boolean', true),
  ],
  { data: ['A', '', null, 'B'], delimiter: ', ', ignoreEmpty: true },
  'A, B',
  (a) => {
    const out = range(a.data)
      .filter((v) => !logical(a.ignoreEmpty) || (v !== null && v !== ''))
      .map(t)
      .join(t(a.delimiter));
    if (out.length > 32767) fail('#VALUE!', 'Result exceeds 32,767 characters.');
    return out;
  },
  ['combine', 'jorna'],
  [],
  'text',
);
function numberValue(input: any, decimal = '.', group = ','): number {
  let s = t(input).replace(/\s/g, '');
  if (!s) return 0;
  if (decimal.length !== 1 || group.length !== 1 || decimal === group)
    fail('#VALUE!', 'Decimal and group separators must be distinct single characters.');
  let perc = 0;
  while (s.endsWith('%')) {
    perc++;
    s = s.slice(0, -1);
  }
  if (s.includes('%')) fail('#VALUE!', 'Percent signs are only permitted at the end.');
  const parts = s.split(decimal);
  if (parts.length > 2 || parts[1]?.includes(group)) fail('#VALUE!', 'Invalid number separators.');
  s = parts[0].split(group).join('') + (parts.length === 2 ? '.' + parts[1] : '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))
    fail('#VALUE!', 'Text is not a valid number.');
  const result = Number(s) / 100 ** perc;
  if (!Number.isFinite(result)) fail('#NUM!', 'Number is outside the supported range.');
  return result;
}
def(
  'NUMBERVALUE',
  'Convert regional number text',
  text,
  [
    source,
    inp('decimalSeparator', 'Decimal separator', 'text', '.'),
    inp('groupSeparator', 'Thousands separator', 'text', ','),
  ],
  { text: '1.234,50', decimalSeparator: ',', groupSeparator: '.' },
  1234.5,
  (a) => numberValue(a.text, t(a.decimalSeparator), t(a.groupSeparator)),
  ['parse number', 'adad'],
);
def(
  'VALUE',
  'Convert text to a number',
  text,
  [source],
  { text: '$1,234.50' },
  1234.5,
  (a) => {
    let s = t(a.text).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return dateSerial(s);
    if (/^\d{1,2}:\d{2}/.test(s)) return timeValue(s);
    const negative = /^\(.*\)$/.test(s);
    s = s.replace(/^[\$£€¥]/, '').replace(/^\((.*)\)$/, '$1');
    return numberValue(s) * (negative ? -1 : 1);
  },
  ['text number', 'adad'],
  [
    'Uses invariant decimal dot/thousands comma; recognizes common currency symbols, ISO dates and clock times. Ambiguous locale date strings must be normalized during import.',
  ],
);
def(
  'FIXED',
  'Format a fixed-decimal number',
  text,
  [
    value,
    inp('decimals', 'Decimal places', 'number', 2),
    inp('noCommas', 'Omit thousands separators', 'boolean', false),
  ],
  { value: 1234.567, decimals: 2, noCommas: false },
  '1,234.57',
  (a) => {
    const d = integer(a.decimals);
    if (d > 100 || d < -308) fail('#VALUE!', 'Supported decimals are -308 to 100.');
    const rounded = roundHalfAway(n(a.value), d);
    return rounded.toLocaleString('en-US', {
      useGrouping: !logical(a.noCommas),
      minimumFractionDigits: Math.max(0, d),
      maximumFractionDigits: Math.max(0, d),
    });
  },
  ['formatted number'],
  [],
  'text',
);
function formatSections(format: string): { sections: string[]; restore: (mask: string) => string } {
  const sections = [''],
    literals: string[] = [];
  const literal = (text: string) => {
    if (literals.length >= 6400) fail('#VALUE!', 'Too many literal segments in the format.');
    const token = String.fromCharCode(0xe000 + literals.length);
    literals.push(text);
    sections[sections.length - 1] += token;
  };
  for (let i = 0; i < format.length; i++) {
    const char = format[i];
    if (char === '"') {
      const end = format.indexOf('"', i + 1);
      if (end === -1) fail('#VALUE!', 'Close each quoted literal in the format.');
      literal(format.slice(i + 1, end));
      i = end;
    } else if (char === '\\') {
      if (++i >= format.length) fail('#VALUE!', 'A format escape needs a following character.');
      literal(format[i]);
    } else if (char === ';') sections.push('');
    else if (char.charCodeAt(0) >= 0xe000 && char.charCodeAt(0) <= 0xf8ff) literal(char);
    else sections[sections.length - 1] += char;
  }
  if (sections.length > 3) fail('#VALUE!', 'Use at most three numeric format sections.');
  return {
    sections,
    restore: (mask) =>
      mask.replace(/[\uE000-\uF8FF]/g, (token) => literals[token.charCodeAt(0) - 0xe000]),
  };
}
function formatText(a: Record<string, any>): string {
  const v = n(a.value),
    format = t(a.format);
  if (format === '') return '';
  if (format === 'General') return String(v);
  const { sections, restore } = formatSections(format),
    f = sections[v < 0 && sections.length > 1 ? 1 : v === 0 && sections.length > 2 ? 2 : 0];
  if (/[\[\]]/.test(f))
    fail('#VALUE!', 'Color, conditional, locale and elapsed-time format tags are not supported.');
  if (/[ydhs]/i.test(f.replace(/"[^"]*"/g, '')) || /^m{1,5}(?:[\/\- ]|$)/i.test(f)) {
    const c = civilFromSerial(Math.abs(v)),
      seconds = Math.round((Math.abs(v) % 1) * 86400) % 86400,
      hh = Math.floor(seconds / 3600),
      mm = Math.floor(seconds / 60) % 60,
      ss = seconds % 60;
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const ampm = /AM\/PM/i.test(f);
    let out = '';
    const tokens = /("[^"]*"|AM\/PM|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|.)/gi;
    let match: RegExpExecArray | null;
    while ((match = tokens.exec(f))) {
      const token = match[0],
        lower = token.toLowerCase(),
        before = f.slice(0, match.index),
        after = f.slice(match.index + token.length);
      const minute = /h{1,2}:?$/i.test(before) || /^:?s/i.test(after);
      if (token.startsWith('"')) out += token.slice(1, -1);
      else if (lower === 'am/pm') out += hh < 12 ? 'AM' : 'PM';
      else if (lower === 'yyyy') out += String(c.year).padStart(4, '0');
      else if (lower === 'yy') out += String(c.year % 100).padStart(2, '0');
      else if (lower === 'mmmmm') out += months[c.month - 1][0];
      else if (lower === 'mmmm') out += months[c.month - 1];
      else if (lower === 'mmm') out += months[c.month - 1].slice(0, 3);
      else if (lower === 'm' || lower === 'mm')
        out += String(minute ? mm : c.month).padStart(lower.length, '0');
      else if (lower === 'dddd' || lower === 'ddd') {
        const dayName = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ][weekdayMonday(Math.abs(v))];
        out += lower === 'dddd' ? dayName : dayName.slice(0, 3);
      } else if (lower === 'd' || lower === 'dd') out += String(c.day).padStart(lower.length, '0');
      else if (lower === 'h' || lower === 'hh')
        out += String(ampm ? hh % 12 || 12 : hh).padStart(lower.length, '0');
      else if (lower === 's' || lower === 'ss') out += String(ss).padStart(lower.length, '0');
      else out += token;
    }
    return restore(out);
  }
  if (!/[0#]/.test(f)) return restore(f);
  if (/[Ee][+-]0+/.test(f)) {
    const scientific = f.match(/[0#]+(?:\.[0#]+)?[Ee]([+-])(0+)/);
    if (!scientific) fail('#VALUE!', 'Unsupported scientific format.');
    const digits = (scientific[0].split('.')[1]?.split(/[Ee]/)[0] || '').length;
    const number = sections.length > 1 ? Math.abs(v) : v;
    const exponent = number === 0 ? 0 : Math.floor(Math.log10(Math.abs(number)));
    const formatted = roundHalfAway(number, digits - exponent)
      .toExponential(digits)
      .replace(
        /e([+-])(\d+)$/i,
        (_, sign, exponent) =>
          'E' +
          (sign === '+' && scientific[1] === '-' ? '' : sign) +
          exponent.padStart(scientific[2].length, '0'),
      );
    return restore(f.replace(scientific[0], formatted));
  }
  if (/[?_]/.test(f)) fail('#VALUE!', 'Spacing and fraction placeholder masks are not supported.');
  if (/\//.test(f)) fail('#VALUE!', 'Fraction format masks are not supported.');
  const percent = (f.match(/%/g) || []).length,
    abs = sections.length > 1 ? Math.abs(v) : v;
  const numericPart = f.match(/[0#,]+(?:\.[0#]+)?(?:,+)?/);
  if (!numericPart) fail('#VALUE!', 'Unsupported number format.');
  const rawPattern = numericPart[0],
    scaling = (rawPattern.match(/,+$/)?.[0] || '').length,
    pattern = rawPattern.replace(/,+$/, ''),
    decimals = pattern.split('.')[1] || '',
    min = decimals.replace(/#/g, '').length,
    max = decimals.length;
  if (max > 100) fail('#VALUE!', 'Too many decimal places.');
  const formatted = roundHalfAway((abs * 100 ** percent) / 1000 ** scaling, max).toLocaleString(
    'en-US',
    {
      useGrouping: pattern.includes(','),
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      minimumIntegerDigits: Math.min(
        21,
        Math.max(1, (pattern.split('.')[0].match(/0/g) || []).length),
      ),
    },
  );
  return restore(f.replace(rawPattern, formatted));
}
def(
  'TEXT',
  'Format a value as text',
  text,
  [value, inp('format', 'Format (e.g. #,##0.00, 0%, yyyy-mm-dd)', 'text', '#,##0.00')],
  { value: 1234.5, format: '#,##0.00' },
  '1,234.50',
  (a) => formatText(a),
  ['formatting', 'number display'],
  [
    'Supports common decimal, percentage, currency, scientific and calendar/time masks with up to three sections. Fraction, spacing-placeholder, color, conditional, locale and elapsed-time masks return an explicit error.',
  ],
  'text',
);
def(
  'SUBSTITUTE',
  'Replace matching text',
  text,
  [
    source,
    inp('oldText', 'Text to find', 'text'),
    inp('newText', 'Replacement', 'text'),
    inp('instance', 'Occurrence (0 replaces all)', 'number', 0),
  ],
  { text: 'red red red', oldText: 'red', newText: 'blue', instance: 2 },
  'red blue red',
  (a) => {
    const s = t(a.text),
      old = t(a.oldText),
      replacement = t(a.newText),
      instance = integer(a.instance);
    if (instance < 0) fail('#VALUE!', 'Occurrence must be 0 (all) or a positive integer.');
    if (!old) return s;
    if (!instance) return s.split(old).join(replacement);
    let count = 0;
    return s.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (m) =>
      ++count === instance ? replacement : m,
    );
  },
  ['replace all', 'badalna'],
  [],
  'text',
);
def(
  'REPLACE',
  'Replace characters by position',
  text,
  [
    source,
    inp('start', 'Starting position (1-based)'),
    inp('count', 'Characters to replace'),
    inp('newText', 'Replacement', 'text'),
  ],
  { text: 'abcdef', start: 2, count: 3, newText: 'X' },
  'aXef',
  (a) => {
    const s = chars(a.text),
      start = integer(a.start);
    if (start < 1) fail('#VALUE!', 'Start must be at least 1.');
    return (
      s.slice(0, start - 1).join('') +
      t(a.newText) +
      s.slice(start - 1 + nonnegative(a.count)).join('')
    );
  },
  ['replace position'],
  [],
  'text',
);
for (const name of ['FIND', 'SEARCH'])
  def(
    name,
    name === 'FIND' ? 'Find case-sensitive text position' : 'Find text position ignoring case',
    text,
    [
      source,
      inp('findText', 'Text to find', 'text'),
      inp('start', 'Starting position (1-based)', 'number', 1),
    ],
    { text: 'SheetPilot', findText: 'Pilot', start: 1 },
    6,
    (a) => {
      const s = chars(a.text),
        start = integer(a.start);
      if (start < 1 || start > s.length + 1)
        fail('#VALUE!', 'Starting position is outside the text.');
      const target = t(a.findText);
      if (name === 'FIND') {
        const index = s
          .slice(start - 1)
          .join('')
          .indexOf(target);
        if (index < 0) fail('#VALUE!', 'Search text not found.');
        return (
          start +
          Array.from(
            s
              .slice(start - 1)
              .join('')
              .slice(0, index),
          ).length
        );
      }
      let pattern = '';
      for (let i = 0; i < target.length; i++) {
        const c = target[i];
        if (c === '~' && i + 1 < target.length)
          pattern += target[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        else
          pattern += c === '*' ? '.*?' : c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      const match = new RegExp(pattern, 'isu').exec(s.slice(start - 1).join(''));
      if (!match) fail('#VALUE!', 'Search text not found.');
      return (
        start +
        Array.from(
          s
            .slice(start - 1)
            .join('')
            .slice(0, match.index),
        ).length
      );
    },
    ['search text', 'dhoondna'],
  );
def(
  'EXACT',
  'Compare text with case sensitivity',
  text,
  [inp('text1', 'First text', 'text'), inp('text2', 'Second text', 'text')],
  { text1: 'Ali', text2: 'ali' },
  false,
  (a) => t(a.text1) === t(a.text2),
  ['compare text'],
  [],
  'boolean',
);
function splitText(a: Record<string, any>): string[][] {
  const s = t(a.text),
    column = t(a.columnDelimiter),
    row = t(a.rowDelimiter ?? '');
  if (!column && !row) fail('#VALUE!', 'Choose at least one delimiter.');
  const sensitive = integer(a.matchMode ?? 0) === 0,
    empty = logical(a.ignoreEmpty ?? false);
  if (![0, 1].includes(integer(a.matchMode ?? 0))) fail('#VALUE!', 'Match mode must be 0 or 1.');
  const split = (value: string, separator: string) =>
    separator
      ? value.split(
          new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), sensitive ? 'g' : 'gi'),
        )
      : [value];
  const out = split(s, row)
    .filter((v) => !empty || v !== '')
    .map((v) => split(v, column).filter((x) => !empty || x !== ''));
  if (!out.length) return [['']];
  const width = Math.max(...out.map((r) => r.length));
  return out.map((r) =>
    Array.from({ length: width }, (_, i) =>
      i < r.length ? r[i] : (a.padWith ?? { error: '#N/A' }),
    ),
  ) as string[][];
}
def(
  'TEXTSPLIT',
  'Split text into rows and columns',
  text,
  [
    source,
    inp('columnDelimiter', 'Column separator', 'text', ','),
    inp('rowDelimiter', 'Row separator (optional)', 'text', ''),
    inp('ignoreEmpty', 'Skip empty pieces', 'boolean', false),
    inp('matchMode', 'Case mode: 0 sensitive, 1 insensitive', 'number', 0),
    inp('padWith', 'Fill short rows with', 'text', null),
  ],
  { text: 'A,B;C,D', columnDelimiter: ',', rowDelimiter: ';' },
  [
    ['A', 'B'],
    ['C', 'D'],
  ],
  (a) => splitText(a),
  ['split text', 'alag karna'],
  ['Delimiter fields accept literal strings, not regular expressions.'],
  'array',
);
for (const name of ['TEXTBEFORE', 'TEXTAFTER'])
  def(
    name,
    name === 'TEXTBEFORE' ? 'Text before a separator' : 'Text after a separator',
    text,
    [
      source,
      inp('delimiter', 'Separator', 'text'),
      inp('instance', 'Occurrence (negative counts from end)', 'number', 1),
      inp('matchMode', 'Case mode: 0 sensitive, 1 insensitive', 'number', 0),
      inp('matchEnd', 'Treat end of text as delimiter', 'boolean', false),
      inp('ifNotFound', 'Missing result (blank leaves #N/A)', 'text', null),
    ],
    { text: 'A-B-C', delimiter: '-', instance: 2 },
    name === 'TEXTBEFORE' ? 'A-B' : 'C',
    (a) => {
      const s = t(a.text),
        d = t(a.delimiter),
        instance = integer(a.instance),
        mode = integer(a.matchMode);
      if (!instance || ![0, 1].includes(mode))
        fail('#VALUE!', 'Occurrence cannot be zero; match mode must be 0 or 1.');
      if (!d)
        return instance > 0 ? (name === 'TEXTBEFORE' ? '' : s) : name === 'TEXTBEFORE' ? s : '';
      const lookup = mode ? s.toLowerCase() : s,
        needle = mode ? d.toLowerCase() : d,
        positions: number[] = [];
      for (
        let pos = lookup.indexOf(needle);
        pos >= 0;
        pos = lookup.indexOf(needle, pos + needle.length)
      )
        positions.push(pos);
      if (logical(a.matchEnd))
        instance > 0 ? positions.push(s.length) : positions.unshift(-d.length);
      const index = instance > 0 ? positions[instance - 1] : positions[positions.length + instance];
      if (index === undefined) {
        if (a.ifNotFound !== null) return a.ifNotFound;
        return fail('#N/A', 'Separator occurrence not found.');
      }
      return name === 'TEXTBEFORE'
        ? s.slice(0, Math.max(0, index))
        : s.slice(Math.min(s.length, index + d.length));
    },
    ['split extract', 'alag'],
    [],
    'text',
  );
def(
  'REPT',
  'Repeat text',
  text,
  [source, inp('times', 'Repeat count')],
  { text: 'ab', times: 3 },
  'ababab',
  (a) => {
    const count = nonnegative(a.times),
      s = t(a.text);
    if (s.length * count > 32767) fail('#VALUE!', 'Result exceeds 32,767 characters.');
    return s.repeat(count);
  },
  ['repeat', 'dobara'],
  [],
  'text',
);
const windows1252: Record<number, number> = {
  128: 8364,
  130: 8218,
  131: 402,
  132: 8222,
  133: 8230,
  134: 8224,
  135: 8225,
  136: 710,
  137: 8240,
  138: 352,
  139: 8249,
  140: 338,
  142: 381,
  145: 8216,
  146: 8217,
  147: 8220,
  148: 8221,
  149: 8226,
  150: 8211,
  151: 8212,
  152: 732,
  153: 8482,
  154: 353,
  155: 8250,
  156: 339,
  158: 382,
  159: 376,
};
for (const name of ['CHAR', 'UNICHAR'])
  def(
    name,
    name === 'CHAR' ? 'Character from Windows code' : 'Character from Unicode code point',
    text,
    [value],
    { value: 65 },
    'A',
    (a) => {
      const code = integer(a.value);
      if (
        code < 1 ||
        code > (name === 'CHAR' ? 255 : 0x10ffff) ||
        (name === 'UNICHAR' && code >= 0xd800 && code <= 0xdfff)
      )
        fail('#VALUE!', 'Invalid character code.');
      return String.fromCodePoint(name === 'CHAR' ? (windows1252[code] ?? code) : code);
    },
    ['character', 'harf'],
    name === 'CHAR'
      ? ['Uses Windows-1252 (Excel Windows); Mac legacy code-page behavior can differ.']
      : [],
    'text',
  );
for (const name of ['CODE', 'UNICODE'])
  def(
    name,
    name === 'CODE' ? 'Windows code of first character' : 'Unicode code point of first character',
    text,
    [source],
    { text: 'A' },
    65,
    (a) => {
      const s = t(a.text);
      if (!s) fail('#VALUE!', 'Text cannot be empty.');
      const code = s.codePointAt(0)!;
      if (name === 'UNICODE') return code;
      const entry = Object.entries(windows1252).find(([, v]) => v === code);
      if (entry) return Number(entry[0]);
      return code <= 255 ? code : 63;
    },
    ['character code'],
    name === 'CODE'
      ? [
          'Uses Windows-1252; unrepresentable characters map to the Windows replacement character ?.',
        ]
      : [],
  );
def(
  'T',
  'Return text values only',
  text,
  [inp('value', 'Value', 'data')],
  { value: 123 },
  '',
  (a) => {
    checkError(a.value);
    return typeof a.value === 'string' ? a.value : '';
  },
  ['text only'],
  [],
  'text',
);
def(
  'HYPERLINK',
  'Create a safe clickable link',
  text,
  [inp('url', 'URL or document location', 'text'), inp('label', 'Display text', 'text', '')],
  { url: 'https://example.com', label: 'Example' },
  { url: 'https://example.com', label: 'Example' },
  (a) => {
    const url = t(a.url).trim();
    if (!/^(https?:\/\/|mailto:|#)/i.test(url))
      fail('#VALUE!', 'Use an http, https, mailto, or local # link.');
    return { url, label: a.label === null || a.label === '' ? url : t(a.label) };
  },
  ['website', 'link'],
  ['Returns a link object for safe rendering and export. Executable/file URLs are rejected.'],
  'link',
);

const dateNotes = [
  'Dates are Excel 1900-system serial numbers. Date text must use ISO YYYY-MM-DD; no locale guessing. Serial 60 represents Excel’s fictitious 1900-02-29. Time and volatile-clock operations use UTC.',
];
def(
  'TODAY',
  'Current date',
  dates,
  [],
  {},
  45292,
  (_, c) => Math.floor(utcToday(c)),
  ['aaj'],
  dateNotes,
  'date',
  { now: '2024-01-01T12:30:00Z' },
);
def(
  'NOW',
  'Current date and time',
  dates,
  [],
  {},
  45292.5,
  (_, c) => utcToday(c),
  ['abhi'],
  dateNotes,
  'date',
  { now: '2024-01-01T12:00:00Z' },
);
def(
  'DATE',
  'Build a date from year, month and day',
  dates,
  [inp('year', 'Year'), inp('month', 'Month'), inp('day', 'Day')],
  { year: 2024, month: 1, day: 1 },
  45292,
  (a) => {
    let y = integer(a.year);
    const m = integer(a.month),
      d = integer(a.day);
    if (y < 0 || y > 9999) fail('#NUM!', 'Year must be 0–9999.');
    if (y < 1900) y += 1900;
    const adjusted = y + Math.floor((m - 1) / 12),
      mo = ((((m - 1) % 12) + 12) % 12) + 1;
    const serial = serialFromCivil(adjusted, mo, 1) + d - 1;
    if (serial < 0 || serial >= 2958466) fail('#NUM!', 'Date falls outside the 1900 date system.');
    return serial;
  },
  ['create date'],
  dateNotes,
  'date',
);
def(
  'TIME',
  'Build a time from hours, minutes and seconds',
  dates,
  [inp('hour', 'Hours'), inp('minute', 'Minutes'), inp('second', 'Seconds', 'number', 0)],
  { hour: 13, minute: 30, second: 0 },
  0.5625,
  (a) => {
    const h = integer(a.hour),
      m = integer(a.minute),
      s = integer(a.second),
      total = h * 3600 + m * 60 + s;
    if (h > 32767 || m > 32767 || s > 32767 || total < 0)
      fail('#NUM!', 'Time components exceed the supported range.');
    return (total % 86400) / 86400;
  },
  ['waqt'],
  dateNotes,
  'time',
);
for (const name of ['DAY', 'MONTH', 'YEAR'])
  def(
    name,
    `${name[0] + name.slice(1).toLowerCase()} of a date`,
    dates,
    [dateInput('date', 'Date')],
    { date: '2024-02-29' },
    name === 'DAY' ? 29 : name === 'MONTH' ? 2 : 2024,
    (a) => {
      const d = civilFromSerial(a.date);
      return name === 'DAY' ? d.day : name === 'MONTH' ? d.month : d.year;
    },
    ['date part'],
    dateNotes,
  );
for (const [name, divisor, mod] of [
  ['HOUR', 3600, 24],
  ['MINUTE', 60, 60],
  ['SECOND', 1, 60],
] as const)
  def(
    name,
    `${name[0] + name.slice(1).toLowerCase()} of a time`,
    dates,
    [dateInput('date', 'Date/time or fractional time')],
    { date: 0.5625 },
    name === 'HOUR' ? 13 : name === 'MINUTE' ? 30 : 0,
    (a) => Math.floor(Math.round((dateSerial(a.date) % 1) * 86400 * 1e6) / 1e6 / divisor) % mod,
    ['time part'],
    dateNotes,
  );
def(
  'DAYS',
  'Days between two dates',
  dates,
  [dateInput('start', 'Start date'), dateInput('end', 'End date')],
  { start: '2024-01-01', end: '2024-01-31' },
  30,
  (a) => Math.floor(dateSerial(a.end)) - Math.floor(dateSerial(a.start)),
  ['date difference', 'din'],
  dateNotes,
);
def(
  'DATEDIF',
  'Complete years, months or days of service',
  dates,
  [
    dateInput('start', 'Start date'),
    dateInput('end', 'End date'),
    {
      key: 'unit',
      label: 'Unit',
      type: 'select',
      default: 'Y',
      options: [
        { label: 'Complete years', value: 'Y' },
        { label: 'Complete months', value: 'M' },
        { label: 'Days', value: 'D' },
        { label: 'Remaining months after years', value: 'YM' },
        { label: 'Days ignoring years', value: 'YD' },
        { label: 'Days ignoring months and years', value: 'MD' },
      ],
    },
  ],
  { start: '2020-01-15', end: '2024-03-10', unit: 'Y' },
  4,
  (a) => {
    const start = Math.floor(dateSerial(a.start)),
      end = Math.floor(dateSerial(a.end));
    if (start > end) fail('#NUM!', 'End date must be on or after start date.');
    const s = civilFromSerial(start),
      e = civilFromSerial(end),
      unit = t(a.unit).toUpperCase(),
      months = (e.year - s.year) * 12 + e.month - s.month - (e.day < s.day ? 1 : 0);
    switch (unit) {
      case 'Y':
        return Math.floor(months / 12);
      case 'M':
        return months;
      case 'D':
        return end - start;
      case 'YM':
        return months % 12;
      case 'YD': {
        let y = e.year;
        if (e.month < s.month || (e.month === s.month && e.day < s.day)) y--;
        return end - (serialFromCivil(y, s.month, 1) + s.day - 1);
      }
      case 'MD': {
        if (e.day >= s.day) return e.day - s.day;
        const prev = e.month === 1 ? 12 : e.month - 1,
          yr = e.month === 1 ? e.year - 1 : e.year;
        return monthDays(yr, prev) - s.day + e.day;
      }
      default:
        return fail('#NUM!', 'Choose Y, M, D, YM, YD, or MD.');
    }
  },
  ['years months service', 'muddat', 'date difference'],
  [
    ...dateNotes,
    'MD follows Excel’s legacy previous-month subtraction and can produce negative results for month-end dates; D is recommended for total elapsed days.',
  ],
);
function days360(start: any, end: any, european = false): number {
  const s = civilFromSerial(Math.floor(dateSerial(start))),
    e = civilFromSerial(Math.floor(dateSerial(end)));
  let sd = s.day,
    ed = e.day,
    em = e.month,
    ey = e.year;
  if (european) {
    sd = Math.min(sd, 30);
    ed = Math.min(ed, 30);
  } else {
    const sFeb = s.month === 2 && sd === monthDays(s.year, 2),
      eFeb = e.month === 2 && ed === monthDays(e.year, 2);
    if (sFeb) sd = 30;
    if (eFeb && sFeb) ed = 30;
    if (sd === 31) sd = 30;
    if (ed === 31) {
      if (sd >= 30) ed = 30;
      else {
        ed = 1;
        em++;
        if (em === 13) {
          em = 1;
          ey++;
        }
      }
    }
  }
  return (ey - s.year) * 360 + (em - s.month) * 30 + ed - sd;
}
def(
  'DAYS360',
  'Day difference using a 360-day year',
  dates,
  [
    dateInput('start', 'Start date'),
    dateInput('end', 'End date'),
    inp('european', 'Use European 30/360 instead of US NASD', 'boolean', false),
  ],
  { start: '2024-01-01', end: '2024-02-01' },
  30,
  (a) => days360(a.start, a.end, logical(a.european)),
  ['accounting days'],
  dateNotes,
);
def(
  'YEARFRAC',
  'Fraction of a year between dates',
  dates,
  [
    dateInput('start', 'Start date'),
    dateInput('end', 'End date'),
    {
      key: 'basis',
      label: 'Day-count basis',
      type: 'select',
      default: 0,
      options: [
        { label: 'US NASD 30/360', value: 0 },
        { label: 'Actual/actual', value: 1 },
        { label: 'Actual/360', value: 2 },
        { label: 'Actual/365', value: 3 },
        { label: 'European 30/360', value: 4 },
      ],
    },
  ],
  { start: '2024-01-01', end: '2024-07-01', basis: 0 },
  0.5,
  (a) => {
    const basis = integer(a.basis);
    if (basis < 0 || basis > 4) fail('#NUM!', 'Basis must be 0–4.');
    let start = Math.floor(dateSerial(a.start)),
      end = Math.floor(dateSerial(a.end));
    if (start > end) [start, end] = [end, start];
    if (basis === 0 || basis === 4) return days360(start, end, basis === 4) / 360;
    if (basis === 2) return (end - start) / 360;
    if (basis === 3) return (end - start) / 365;
    const s = civilFromSerial(start),
      e = civilFromSerial(end);
    let denominator = 365;
    if (
      s.year === e.year ||
      (s.year + 1 === e.year && (s.month > e.month || (s.month === e.month && s.day >= e.day)))
    ) {
      const leap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
      if (s.year === e.year && leap(s.year)) denominator = 366;
      else
        for (let y = s.year; y <= e.year; y++)
          if (leap(y)) {
            const feb = serialFromCivil(y, 2, 29);
            if (start <= feb && end > feb) denominator = 366;
          }
    } else
      denominator =
        (serialFromCivil(e.year + 1, 1, 1) - serialFromCivil(s.year, 1, 1)) / (e.year - s.year + 1);
    return (end - start) / denominator;
  },
  ['year fraction', 'service years'],
  [
    ...dateNotes,
    'US 30/360 applies NASD end-of-February adjustments; Excel’s documented legacy YEARFRAC end-of-February bug is corrected.',
  ],
);
def(
  'WEEKDAY',
  'Day of the week',
  dates,
  [
    dateInput('date', 'Date'),
    {
      key: 'returnType',
      label: 'Weekday convention',
      type: 'select',
      default: 1,
      options: [
        { label: 'Sunday 1 to Saturday 7', value: 1 },
        { label: 'Monday 1 to Sunday 7', value: 2 },
        { label: 'Monday 0 to Sunday 6', value: 3 },
        ...[11, 12, 13, 14, 15, 16, 17].map((v) => ({ label: `Excel return type ${v}`, value: v })),
      ],
    },
  ],
  { date: '2024-01-01', returnType: 2 },
  1,
  (a) => {
    const day = weekdayMonday(dateSerial(a.date)),
      type = integer(a.returnType);
    if (type === 1) return ((day + 1) % 7) + 1;
    if (type === 2) return day + 1;
    if (type === 3) return day;
    if (type >= 11 && type <= 17) return ((day - (type - 11) + 7) % 7) + 1;
    return fail('#NUM!', 'Invalid weekday return type.');
  },
  ['week day', 'hafta'],
  dateNotes,
);
function isoWeek(serial: number): number {
  const s = Math.floor(serial),
    thursday = s + 3 - weekdayMonday(s),
    year = civilFromSerial(thursday).year,
    jan4 = serialFromCivil(year, 1, 4),
    monday = jan4 - weekdayMonday(jan4);
  return Math.floor((s - monday) / 7) + 1;
}
def(
  'ISOWEEKNUM',
  'ISO week number',
  dates,
  [dateInput('date', 'Date')],
  { date: '2021-01-01' },
  53,
  (a) => isoWeek(dateSerial(a.date)),
  ['ISO week'],
  dateNotes,
);
def(
  'WEEKNUM',
  'Calendar week number',
  dates,
  [
    dateInput('date', 'Date'),
    inp('returnType', 'First weekday: 1 Sunday, 2 Monday, 11–17, or 21 ISO', 'number', 1),
  ],
  { date: '2024-01-07', returnType: 1 },
  2,
  (a) => {
    const s = Math.floor(dateSerial(a.date)),
      type = integer(a.returnType);
    if (type === 21) return isoWeek(s);
    const first = type === 1 ? 6 : type === 2 ? 0 : type >= 11 && type <= 17 ? type - 11 : -1;
    if (first < 0) fail('#NUM!', 'Invalid week-number return type.');
    const jan1 = serialFromCivil(civilFromSerial(s).year, 1, 1);
    return Math.floor((s - jan1 + ((weekdayMonday(jan1) - first + 7) % 7)) / 7) + 1;
  },
  ['week number'],
  dateNotes,
);
function shiftMonths(date: any, months: any, end = false): number {
  const s = civilFromSerial(date),
    delta = integer(months),
    total = s.year * 12 + s.month - 1 + delta,
    year = Math.floor(total / 12),
    month = (((total % 12) + 12) % 12) + 1;
  if (year < 1900 || year > 9999) fail('#NUM!', 'Shifted date is outside the supported range.');
  return serialFromCivil(
    year,
    month,
    end ? monthDays(year, month) : Math.min(s.day, monthDays(year, month)),
  );
}
for (const name of ['EDATE', 'EOMONTH'])
  def(
    name,
    name === 'EDATE' ? 'Move a date by calendar months' : 'Last day of a shifted month',
    dates,
    [
      dateInput('date', 'Start date'),
      inp('months', 'Months to move (negative moves backward)', 'number', 0),
    ],
    { date: '2024-01-31', months: 1 },
    45351,
    (a) => shiftMonths(a.date, a.months, name === 'EOMONTH'),
    ['month end', 'mahina'],
    dateNotes,
    'date',
  );
const weekendInput: InputDef = {
  key: 'weekend',
  label: 'Weekend code or Monday-to-Sunday mask',
  type: 'text',
  default: '1',
  description: '1 = Saturday/Sunday; 11 = Sunday only; e.g. 0000011 excludes Saturday and Sunday.',
};
for (const name of ['NETWORKDAYS', 'NETWORKDAYS.INTL'])
  def(
    name,
    'Working days between dates',
    dates,
    [
      dateInput('start', 'Start date'),
      dateInput('end', 'End date'),
      inp('holidays', 'Holiday dates', 'data', []),
      ...(name.endsWith('INTL') ? [weekendInput] : []),
    ],
    { start: '2024-01-01', end: '2024-01-07', holidays: ['2024-01-01'] },
    4,
    (a) => workingDays(a.start, a.end, name.endsWith('INTL') ? a.weekend : 1, a.holidays),
    ['working days', 'chutti', 'hazri'],
    [
      ...dateNotes,
      'Includes both endpoints; a reversed range returns a negative count. Weekend codes follow Excel conventions.',
    ],
  );
for (const name of ['WORKDAY', 'WORKDAY.INTL'])
  def(
    name,
    'Date after a number of working days',
    dates,
    [
      dateInput('start', 'Start date'),
      inp('days', 'Working days to add (negative moves backward)'),
      inp('holidays', 'Holiday dates', 'data', []),
      ...(name.endsWith('INTL') ? [weekendInput] : []),
    ],
    { start: '2024-01-05', days: 1 },
    45299,
    (a) => {
      let serial = Math.floor(dateSerial(a.start)),
        remaining = Math.abs(integer(a.days));
      const direction = n(a.days) < 0 ? -1 : 1,
        mask = weekendMask(name.endsWith('INTL') ? a.weekend : 1),
        off = holidaySet(a.holidays);
      if (remaining > 2958465) fail('#NUM!', 'Requested working-day shift is too large.');
      while (remaining) {
        serial += direction;
        if (serial < 0 || serial >= 2958466) fail('#NUM!', 'Result falls outside supported dates.');
        if (mask[weekdayMonday(serial)] === '0' && !off.has(serial)) remaining--;
      }
      return serial;
    },
    ['working date', 'office days'],
    dateNotes,
    'date',
  );
def(
  'DATEVALUE',
  'Convert ISO date text to a date',
  dates,
  [inp('text', 'ISO date text', 'text')],
  { text: '2024-01-01' },
  45292,
  (a) => {
    checkError(a.text);
    if (typeof a.text !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}(?:$|[T ])/.test(a.text.trim()))
      fail('#VALUE!', 'DATEVALUE requires ISO calendar-date text.');
    return Math.floor(dateSerial(a.text));
  },
  ['parse date', 'tareekh'],
  dateNotes,
  'date',
);
function timeValue(input: any): number {
  const s = t(input).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}[T ]/.test(s)) return dateSerial(s) % 1;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(AM|PM)?$/i.exec(s);
  if (!match) fail('#VALUE!', 'Use HH:MM[:SS] with optional AM/PM.');
  let h = Number(match[1]);
  const m = Number(match[2]),
    sec = Number(match[3] || 0) + Number('0.' + (match[4] || 0));
  if (m > 59 || sec >= 60 || h > 23 || (match[5] && (h < 1 || h > 12)))
    fail('#VALUE!', 'Invalid clock time.');
  if (match[5]) h = (h % 12) + (match[5].toUpperCase() === 'PM' ? 12 : 0);
  return (h * 3600 + m * 60 + sec) / 86400;
}
def(
  'TIMEVALUE',
  'Convert clock text to a time',
  dates,
  [inp('text', 'Clock time text', 'text')],
  { text: '1:30 PM' },
  0.5625,
  (a) => timeValue(a.text),
  ['parse time', 'waqt'],
  dateNotes,
  'time',
);

// Information functions inspect cell types without coercion.
const infoValue = inp('value', 'Cell value', 'data');
for (const [name, label, test, args, expected] of [
  [
    'ISBLANK',
    'Is a cell truly blank',
    (v: any) => v === null || v === undefined,
    { value: null },
    true,
  ],
  [
    'ISNUMBER',
    'Is a cell numeric',
    (v: any) => typeof v === 'number' && Number.isFinite(v),
    { value: '123' },
    false,
  ],
  ['ISTEXT', 'Is a cell text', (v: any) => typeof v === 'string', { value: '' }, true],
  [
    'ISERROR',
    'Does a cell contain an error',
    (v: any) => !!(v && typeof v === 'object' && 'error' in v),
    { value: { error: '#DIV/0!' } },
    true,
  ],
  [
    'ISNA',
    'Is a cell a missing-match error',
    (v: any) => !!(v && typeof v === 'object' && v.error === '#N/A'),
    { value: { error: '#N/A' } },
    true,
  ],
  ['ISLOGICAL', 'Is a cell Boolean', (v: any) => typeof v === 'boolean', { value: true }, true],
] as const)
  def(
    name,
    label,
    validation,
    [infoValue],
    args,
    expected,
    (a) => test(a.value),
    ['cell type', 'qisam'],
    ['Input is inspected without coercion. A blank cell is null; empty text is not blank.'],
    'boolean',
  );
for (const name of ['ISEVEN', 'ISODD'])
  def(
    name,
    name === 'ISEVEN' ? 'Is a number even' : 'Is a number odd',
    validation,
    [value],
    { value: 3.9 },
    name === 'ISODD',
    (a) => Math.abs(integer(a.value) % 2) === (name === 'ISEVEN' ? 0 : 1),
    ['even odd', 'juft taaq'],
    ['Fractional parts are truncated before testing parity.'],
    'boolean',
  );
function formulaAt(address: any, context: CalcContext): string | undefined {
  const raw = t(address),
    match = /^(?:(?:'([^']+)'|([^!]+))!)?\$?([A-Za-z]+)\$?([1-9]\d*)$/.exec(raw);
  if (!match) fail('#REF!', 'Select one cell using its worksheet address.');
  const sheets = context.workbook?.sheets || [],
    name = match[1] || match[2],
    sheet = name
      ? sheets.find((s) => s.name === name || s.id === name)
      : sheets.find((s) => s.id === context.sheetId) || sheets[0];
  if (!sheet) fail('#REF!', 'Worksheet is unavailable.');
  const key = match[3].toUpperCase() + match[4];
  return Object.entries(sheet.formulae || {}).find(
    ([a]) => a.toUpperCase().replace(/\$/g, '') === key,
  )?.[1];
}
const formulaContext: CalcContext = {
  sheetId: 's',
  workbook: {
    id: 'w',
    name: 'Test',
    sheets: [
      {
        id: 's',
        name: 'Sheet1',
        columns: [{ id: 'a', name: 'A', type: 'number' }],
        rows: [[3]],
        formulae: { A1: 'SUM(1,2)' },
      },
    ],
  },
};
def(
  'ISFORMULA',
  'Does a cell retain an Excel formula',
  validation,
  [inp('address', 'Cell address', 'text')],
  { address: 'A1' },
  true,
  (a, c) => formulaAt(a.address, c) !== undefined,
  ['formula metadata'],
  ['Uses retained imported formula metadata. Plain imported values have no formula metadata.'],
  'boolean',
  formulaContext,
);
def(
  'FORMULATEXT',
  'Show a cell’s retained formula',
  validation,
  [inp('address', 'Cell address', 'text')],
  { address: 'A1' },
  '=SUM(1,2)',
  (a, c) => {
    const f = formulaAt(a.address, c);
    if (f === undefined) fail('#N/A', 'Selected cell has no retained formula metadata.');
    return f.startsWith('=') ? f : '=' + f;
  },
  ['formula text'],
  ['Shows the original formula metadata; does not claim to recalculate imported formulas.'],
  'text',
  formulaContext,
);
def(
  'ERROR.TYPE',
  'Identify a cell error code',
  validation,
  [infoValue],
  { value: { error: '#N/A' } },
  7,
  (a) => {
    const codes: Record<string, number> = {
      '#NULL!': 1,
      '#DIV/0!': 2,
      '#VALUE!': 3,
      '#REF!': 4,
      '#NAME?': 5,
      '#NUM!': 6,
      '#N/A': 7,
      '#GETTING_DATA': 8,
      '#SPILL!': 9,
      '#CONNECT!': 10,
      '#BLOCKED!': 11,
      '#UNKNOWN!': 12,
      '#FIELD!': 13,
      '#CALC!': 14,
    };
    const code = a.value && typeof a.value === 'object' ? codes[a.value.error] : undefined;
    if (code === undefined) fail('#N/A', 'Input is not a recognized Excel error.');
    return code;
  },
  ['error code', 'galti'],
);

export const baseFunctions: FunctionDef[] = collection;
