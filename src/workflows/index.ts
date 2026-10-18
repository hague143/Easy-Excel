import * as Formula from '@formulajs/formulajs';
import jstatModule from 'jstat';
import { fail, flatten, type FunctionDef, type InputDef } from '../engine/types';

const stats = (jstatModule as any).jStat ?? jstatModule;
const F = Formula as any;
type Args = Record<string, any>;
const input = (
  key: string,
  label: string,
  type: InputDef['type'] = 'data',
  extra: Partial<InputDef> = {},
): InputDef => ({ key, label, type, required: true, ...extra });
const number = (v: any, label: string): number => {
  if (v && typeof v === 'object' && 'error' in v)
    fail(String(v.error), v.message ?? `${label} contains a calculation error.`);
  if (
    (typeof v !== 'number' && typeof v !== 'string') ||
    v === '' ||
    (typeof v === 'string' && !v.trim())
  )
    fail('#VALUE!', `${label} must contain a number; blanks are not zero.`);
  const n = Number(v);
  if (!Number.isFinite(n)) fail('#VALUE!', `${label} must be finite.`);
  return n;
};
const nonnegative = (v: any, label: string) => {
  const n = number(v, label);
  if (n < 0) fail('#NUM!', `${label} cannot be negative.`);
  return n;
};
const positive = (v: any, label: string) => {
  const n = number(v, label);
  if (n <= 0) fail('#NUM!', `${label} must be greater than zero.`);
  return n;
};
const vector = (v: any, label: string): any[] => {
  if (v === undefined) fail('#VALUE!', `Select ${label}.`);
  const a = flatten(v);
  if (!a.length) fail('#VALUE!', `${label} cannot be empty.`);
  return a;
};
const numeric = (v: any, label = 'Data') =>
  vector(v, label).map((n, i) => number(n, `${label}, row ${i + 1}`));
const equal = (...a: any[][]) => {
  if (a.some((v) => v.length !== a[0].length))
    fail('#VALUE!', 'Selected columns must have the same number of rows.');
};
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
const average = (a: number[]) => sum(a) / a.length;
const table = (heads: string[], rows: any[][]): any[][] => [heads, ...rows];
const safe = (fn: () => any): any => {
  try {
    return fn();
  } catch (e: any) {
    return { error: e.code ?? '#VALUE!', message: e.message };
  }
};
const rows = (v: any, label: string): any[][] => {
  if (!Array.isArray(v) || !v.length || !v.every(Array.isArray))
    fail('#VALUE!', `${label} must be a table.`);
  return v;
};
const date = (v: any, label: string): Date => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    fail('#VALUE!', `${label} must use YYYY-MM-DD.`);
  const d = new Date(`${v}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v)
    fail('#VALUE!', `${label} is not a valid date.`);
  return d;
};
const formula = (name: string, ...args: any[]) => {
  const result = F[name](...args);
  if (result instanceof Error || (typeof result === 'number' && !Number.isFinite(result)))
    fail((result as Error)?.message || '#NUM!', `${name} could not calculate these inputs.`);
  return result;
};
const groupTotals = (groups: any[], values: number[]) => {
  equal(groups, values);
  const m = new Map<string, number>();
  groups.forEach((g, i) => {
    if (g === null || g === '') fail('#VALUE!', `Group, row ${i + 1} is blank.`);
    m.set(String(g), (m.get(String(g)) ?? 0) + values[i]);
  });
  return [...m.entries()];
};
const percentage = (part: any, total: any, label: string) =>
  (nonnegative(part, label) / positive(total, 'Total')) * 100;
const convert = (value: number, from: string, to: string): number => {
  const temperatures: Record<string, 'C' | 'F' | 'K' | 'Rank' | 'Reau'> = {
    C: 'C',
    cel: 'C',
    F: 'F',
    fah: 'F',
    K: 'K',
    kel: 'K',
    Rank: 'Rank',
    Reau: 'Reau',
  };
  const source = temperatures[from],
    target = temperatures[to];
  if (!source && !target) return formula('CONVERT', value, from, to);
  if (!source || !target)
    fail('#N/A', 'Temperature can only be converted to another temperature unit.');
  const celsius =
    source === 'C'
      ? value
      : source === 'F'
        ? (value - 32) / 1.8
        : source === 'K'
          ? value - 273.15
          : source === 'Rank'
            ? value / 1.8 - 273.15
            : value * 1.25;
  return target === 'C'
    ? celsius
    : target === 'F'
      ? celsius * 1.8 + 32
      : target === 'K'
        ? celsius + 273.15
        : target === 'Rank'
          ? (celsius + 273.15) * 1.8
          : celsius * 0.8;
};
const workflowFunctions: FunctionDef[] = [];
const define = (
  name: string,
  friendlyName: string,
  category: string,
  description: string,
  inputs: InputDef[],
  args: Args,
  expected: any,
  calculate: (a: Args) => any,
  aliases: string[] = [],
  compatibility: string[] = [],
) => {
  workflowFunctions.push({
    name: `WF.${name}`,
    friendlyName,
    categories: ['Workflows', category],
    aliases,
    description,
    inputs,
    output: 'value or labeled summary table',
    example: { args, expected },
    defaults: Object.fromEntries(
      inputs.filter((i) => i.default !== undefined).map((i) => [i.key, i.default]),
    ),
    calculate: (supplied) => {
      const normalized = { ...supplied };
      for (const field of inputs) {
        if (
          ['data', 'matrix', 'conditions', 'operations'].includes(field.type) ||
          !Array.isArray(normalized[field.key])
        )
          continue;
        const cells = flatten(normalized[field.key]);
        if (cells.length !== 1)
          fail(
            '#VALUE!',
            `${field.label} needs one value. Select a single cell or enter the setting directly.`,
          );
        normalized[field.key] = cells[0];
      }
      return calculate(normalized);
    },
    compatibility: [
      'Workflows use the explicitly selected data and settings; no tax laws or institutional policies are inferred.',
      ...compatibility,
    ],
    testRefs: ['tests/workflows.test.ts'],
  });
};

// Office and HR

define(
  'ATTENDANCE',
  'Attendance summary',
  'Office & HR',
  'Count each explicitly mapped attendance status and calculate attendance from present and eligible status lists.',
  [
    input('data', 'Attendance statuses'),
    input('presentStatuses', 'Statuses counted as present'),
    input('eligibleStatuses', 'Statuses counted in the attendance denominator'),
  ],
  { data: ['P', 'A', 'P', 'Leave'], presentStatuses: ['P'], eligibleStatuses: ['P', 'A'] },
  [
    ['Status', 'Count'],
    ['P', 2],
    ['A', 1],
    ['Leave', 1],
    ['Attendance percentage', 200 / 3],
  ],
  (a) => {
    const data = vector(a.data, 'Attendance statuses'),
      present = vector(a.presentStatuses, 'Present statuses').map(String),
      eligible = vector(a.eligibleStatuses, 'Eligible statuses').map(String);
    if (present.some((s) => !eligible.includes(s)))
      fail('#VALUE!', 'Every present status must also be eligible.');
    if (data.some((s) => s === '' || s === null))
      fail('#VALUE!', 'Blank attendance statuses must be resolved.');
    const counts = groupTotals(
      data,
      data.map(() => 1),
    );
    const denominator = data.filter((s) => eligible.includes(String(s))).length;
    if (!denominator) fail('#DIV/0!', 'No statuses match the eligible denominator.');
    return table(
      ['Status', 'Count'],
      [
        ...counts,
        [
          'Attendance percentage',
          (data.filter((s) => present.includes(String(s))).length / denominator) * 100,
        ],
      ],
    );
  },
  ['attendance', 'hazri', 'present absent'],
);

define(
  'WORKING_DAYS',
  'Working days between dates',
  'Office & HR',
  'Count working days inclusively using your seven-day weekend mask and holiday list.',
  [
    input('start', 'Start date', 'date'),
    input('end', 'End date', 'date'),
    input('weekend', 'Weekend mask (Monday–Sunday; 1 means nonworking)', 'text'),
    input('holidays', 'Holiday dates YYYY-MM-DD', 'data', { required: false, default: [] }),
  ],
  { start: '2024-01-01', end: '2024-01-07', weekend: '0000011', holidays: ['2024-01-01'] },
  4,
  (a) => {
    const start = date(a.start, 'Start date'),
      end = date(a.end, 'End date');
    const weekend = String(a.weekend);
    if (!/^[01]{7}$/.test(weekend) || weekend === '1111111')
      fail('#VALUE!', 'Enter seven 0/1 digits with at least one working day, starting Monday.');
    const holidays = new Set(
      flatten(a.holidays ?? [])
        .filter((d) => d !== null && d !== '')
        .map((d) => date(d, 'Holiday').getTime()),
    );
    const direction = start <= end ? 1 : -1,
      low = direction === 1 ? start : end,
      high = direction === 1 ? end : start;
    if ((high.getTime() - low.getTime()) / 86400000 > 366000)
      fail('#NUM!', 'Choose a date range of at most 1,000 years.');
    let count = 0;
    for (let t = low.getTime(); t <= high.getTime(); t += 86400000) {
      const d = new Date(t);
      if (weekend[(d.getUTCDay() + 6) % 7] === '0' && !holidays.has(t)) count++;
    }
    return direction * count;
  },
  ['working days', 'chutti', 'holidays', 'NETWORKDAYS.INTL'],
  ['Blank holiday cells are ignored; nonblank holiday dates must use YYYY-MM-DD.'],
);

define(
  'SERVICE',
  'Years and months of service',
  'Office & HR',
  'Calculate completed calendar years and additional completed months, with explicit start and as-of dates.',
  [input('start', 'Service start date', 'date'), input('end', 'As-of date', 'date')],
  { start: '2020-01-15', end: '2024-04-14' },
  [
    ['Completed years', 'Additional months', 'Total completed months'],
    [4, 2, 50],
  ],
  (a) => {
    const s = date(a.start, 'Start date'),
      e = date(a.end, 'As-of date');
    if (e < s) fail('#NUM!', 'As-of date cannot precede the start date.');
    const months =
      (e.getUTCFullYear() - s.getUTCFullYear()) * 12 +
      e.getUTCMonth() -
      s.getUTCMonth() -
      (e.getUTCDate() < s.getUTCDate() ? 1 : 0);
    return table(
      ['Completed years', 'Additional months', 'Total completed months'],
      [[Math.floor(months / 12), months % 12, months]],
    );
  },
  ['service', 'tenure', 'DATEDIF'],
);

define(
  'SALARY_TOTAL',
  'Salary totals',
  'Office & HR',
  'Sum supplied salary amounts. No tax, deductions, currency conversion, or pay-period assumptions are applied.',
  [input('data', 'Salary amounts')],
  { data: [50000, 65000, 35000] },
  150000,
  (a) => sum(numeric(a.data, 'Salary amounts')),
  ['salary', 'tankhwa', 'payroll'],
);

define(
  'OVERTIME',
  'Overtime pay using your rules',
  'Office & HR',
  'Calculate extra hours above your per-period threshold, using each hourly rate and your overtime multiplier.',
  [
    input('data', 'Hours worked per employee'),
    input('rates', 'Hourly rates per employee'),
    input('threshold', 'Regular-hours threshold for the same period', 'number'),
    input('multiplier', 'Overtime pay multiplier', 'number'),
  ],
  { data: [45, 38], rates: [20, 30], threshold: 40, multiplier: 1.5 },
  [
    ['Row', 'Overtime hours', 'Overtime pay'],
    [1, 5, 150],
    [2, 0, 0],
  ],
  (a) => {
    const hours = vector(a.data, 'Hours worked'),
      rates = vector(a.rates, 'Hourly rates');
    equal(hours, rates);
    const threshold = nonnegative(a.threshold, 'Regular-hours threshold'),
      multiplier = positive(a.multiplier, 'Overtime multiplier');
    return table(
      ['Row', 'Overtime hours', 'Overtime pay'],
      hours.map((h, i) => {
        const result = safe(() => {
          const extra = Math.max(0, nonnegative(h, 'Hours') - threshold);
          return [extra, extra * nonnegative(rates[i], 'Hourly rate') * multiplier];
        });
        return [i + 1, ...(Array.isArray(result) ? result : [result, result])];
      }),
    );
  },
  ['overtime', 'extra hours', 'salary rules'],
);

define(
  'DEPARTMENT_PAYROLL',
  'Department-wise payroll',
  'Office & HR',
  'Group salary amounts by the selected department column.',
  [input('groups', 'Departments'), input('amounts', 'Salary amounts')],
  { groups: ['HR', 'IT', 'HR'], amounts: [100, 200, 50] },
  [
    ['Department', 'Salary total'],
    ['HR', 150],
    ['IT', 200],
  ],
  (a) =>
    table(
      ['Department', 'Salary total'],
      groupTotals(vector(a.groups, 'Departments'), numeric(a.amounts, 'Salary amounts')),
    ),
  ['department payroll', 'salary department', 'tankhwa'],
);

define(
  'DUPLICATE_EMPLOYEES',
  'Duplicate employee detection',
  'Office & HR',
  'Find repeated employee identifiers, preserving text IDs and leading zeros. Choose the matching rule explicitly.',
  [
    input('data', 'Employee identifiers'),
    input('caseSensitive', 'Case-sensitive matching', 'boolean', { default: true }),
  ],
  { data: ['001', '002', '001'], caseSensitive: true },
  [
    ['Employee ID', 'Occurrences', 'Rows'],
    ['001', 2, '1, 3'],
  ],
  (a) => {
    const ids = vector(a.data, 'Employee identifiers');
    const m = new Map<string, { id: any; indices: number[] }>();
    ids.forEach((id, i) => {
      if (id === '' || id === null) fail('#VALUE!', `Employee identifier, row ${i + 1} is blank.`);
      const key = a.caseSensitive === false ? String(id).toLocaleLowerCase() : String(id);
      const entry = m.get(key) ?? { id, indices: [] };
      entry.indices.push(i + 1);
      m.set(key, entry);
    });
    return table(
      ['Employee ID', 'Occurrences', 'Rows'],
      [...m.values()]
        .filter((e) => e.indices.length > 1)
        .map((e) => [e.id, e.indices.length, e.indices.join(', ')]),
    );
  },
  ['duplicate', 'repeat', 'employee ID'],
);

define(
  'EMPLOYEE_LOOKUP',
  'Employee record lookup',
  'Office & HR',
  'Look up an exact employee identifier and return the chosen field, with an explicit duplicate policy.',
  [
    input('data', 'Employee identifiers'),
    input('values', 'Return values'),
    input('search', 'Employee ID to find', 'text'),
    input('duplicatePolicy', 'If the ID appears more than once', 'select', {
      options: ['error', 'first', 'last', 'all'],
      default: 'error',
    }),
    input('caseSensitive', 'Case-sensitive matching', 'boolean', { default: true }),
  ],
  {
    data: ['001', '002'],
    values: ['Amina', 'Bilal'],
    search: '001',
    duplicatePolicy: 'error',
    caseSensitive: true,
  },
  'Amina',
  (a) => {
    const ids = vector(a.data, 'Employee identifiers'),
      values = vector(a.values, 'Return values');
    equal(ids, values);
    if (a.search === '' || a.search === null || a.search === undefined)
      fail('#VALUE!', 'Enter an employee ID.');
    const key = (v: any) => (a.caseSensitive === false ? String(v).toLocaleLowerCase() : String(v));
    const found = ids.map((id, i) => (key(id) === key(a.search) ? i : -1)).filter((i) => i >= 0);
    if (!found.length) fail('#N/A', 'No employee has that identifier.');
    const policy = a.duplicatePolicy ?? 'error';
    if (!['error', 'first', 'last', 'all'].includes(policy))
      fail('#VALUE!', 'Select a duplicate policy.');
    if (found.length > 1 && policy === 'error')
      fail('#N/A', 'More than one employee has that identifier. Select a duplicate policy.');
    return policy === 'all'
      ? table(
          ['Matched row', 'Value'],
          found.map((i) => [i + 1, values[i]]),
        )
      : values[policy === 'last' ? found.at(-1)! : found[0]];
  },
  ['search employee', 'employee lookup', 'ID match'],
);

// Schools and universities

define(
  'MARKS',
  'Total and average marks',
  'Education',
  'Calculate a total and average for each student across the selected numeric subject columns.',
  [input('data', 'Marks table (one student per row)', 'matrix')],
  {
    data: [
      [75, 85, 90],
      [60, 70, 80],
    ],
  },
  [
    ['Student row', 'Total', 'Average'],
    [1, 250, 250 / 3],
    [2, 210, 70],
  ],
  (a) => {
    const data = rows(a.data, 'Marks');
    const width = data[0].length;
    if (!width || data.some((r) => r.length !== width))
      fail('#VALUE!', 'Marks must be a rectangular table.');
    return table(
      ['Student row', 'Total', 'Average'],
      data.map((r, i) => {
        const result = safe(() => {
          const n = r.map((v, c) => nonnegative(v, `Subject ${c + 1}`));
          return [sum(n), average(n)];
        });
        return [i + 1, ...(Array.isArray(result) ? result : [result, result])];
      }),
    );
  },
  ['marks', 'student total', 'average', 'ausat'],
);

define(
  'PERCENTAGE',
  'Percentage',
  'Education',
  'Divide each achieved amount by an explicitly supplied maximum and multiply by 100.',
  [input('data', 'Achieved marks or amounts'), input('maximum', 'Maximum for each row', 'number')],
  { data: [75, 90], maximum: 100 },
  [
    ['Row', 'Percentage'],
    [1, 75],
    [2, 90],
  ],
  (a) => {
    const maximum = positive(a.maximum, 'Maximum');
    return table(
      ['Row', 'Percentage'],
      vector(a.data, 'Achieved amounts').map((v, i) => [
        i + 1,
        safe(() => percentage(v, maximum, 'Achieved amount')),
      ]),
    );
  },
  ['percentage', 'percent', 'feesadi'],
);

define(
  'PASS_FAIL',
  'Pass or fail',
  'Education',
  'Compare each score with your inclusive pass threshold, in the same units as your scores.',
  [input('data', 'Scores'), input('threshold', 'Minimum score to pass', 'number')],
  { data: [39, 40, 85], threshold: 40 },
  [
    ['Row', 'Score', 'Result'],
    [1, 39, 'Fail'],
    [2, 40, 'Pass'],
    [3, 85, 'Pass'],
  ],
  (a) => {
    const threshold = nonnegative(a.threshold, 'Pass threshold');
    return table(
      ['Row', 'Score', 'Result'],
      vector(a.data, 'Scores').map((v, i) => [
        i + 1,
        v,
        safe(() => (nonnegative(v, 'Score') >= threshold ? 'Pass' : 'Fail')),
      ]),
    );
  },
  ['pass fail', 'pass', 'fail'],
);

define(
  'GRADES',
  'Grades from your grade bands',
  'Education',
  'Assign the grade with the largest qualifying inclusive lower bound. Supply your complete grading policy; no institutional grades are assumed.',
  [input('data', 'Scores'), input('bands', 'Grade bands: minimum score, grade label', 'matrix')],
  {
    data: [85, 70, 39],
    bands: [
      [0, 'F'],
      [40, 'Pass'],
      [80, 'Distinction'],
    ],
  },
  [
    ['Row', 'Score', 'Grade'],
    [1, 85, 'Distinction'],
    [2, 70, 'Pass'],
    [3, 39, 'F'],
  ],
  (a) => {
    const bands = rows(a.bands, 'Grade bands')
      .map((r) => {
        if (r.length !== 2 || r[1] === '' || r[1] == null)
          fail('#VALUE!', 'Each grade band needs a minimum and grade label.');
        return [nonnegative(r[0], 'Grade-band minimum'), String(r[1])] as [number, string];
      })
      .sort((x, y) => y[0] - x[0]);
    if (new Set(bands.map((b) => b[0])).size !== bands.length)
      fail('#VALUE!', 'Grade-band minimums must be unique.');
    return table(
      ['Row', 'Score', 'Grade'],
      vector(a.data, 'Scores').map((v, i) => [
        i + 1,
        v,
        safe(() => {
          const n = nonnegative(v, 'Score'),
            band = bands.find((b) => n >= b[0]);
          return band ? band[1] : fail('#N/A', 'No grade band covers this score.');
        }),
      ]),
    );
  },
  ['student grade', 'grade', 'grading'],
);

define(
  'RANKINGS',
  'Student rankings',
  'Education',
  'Rank numeric scores with the chosen tie policy and ranking direction.',
  [
    input('data', 'Scores'),
    input('order', 'Ranking direction', 'select', {
      options: ['highest first', 'lowest first'],
      default: 'highest first',
    }),
    input('ties', 'Tie rule', 'select', {
      options: ['competition', 'average', 'dense'],
      default: 'competition',
    }),
  ],
  { data: [80, 90, 90, 70], order: 'highest first', ties: 'competition' },
  [
    ['Row', 'Score', 'Rank'],
    [1, 80, 3],
    [2, 90, 1],
    [3, 90, 1],
    [4, 70, 4],
  ],
  (a) => {
    const data = numeric(a.data, 'Scores'),
      order = a.order ?? 'highest first',
      ties = a.ties ?? 'competition';
    if (
      !['highest first', 'lowest first'].includes(order) ||
      !['competition', 'average', 'dense'].includes(ties)
    )
      fail('#VALUE!', 'Choose a supported ranking direction and tie rule.');
    return table(
      ['Row', 'Score', 'Rank'],
      data.map((n, i) => {
        const better = data.filter((v) => (order === 'highest first' ? v > n : v < n));
        const rank =
          ties === 'dense'
            ? new Set(better).size + 1
            : better.length +
              1 +
              (ties === 'average' ? (data.filter((v) => v === n).length - 1) / 2 : 0);
        return [i + 1, n, rank];
      }),
    );
  },
  ['student rankings', 'rank', 'position'],
);

define(
  'SUBJECT_SUMMARY',
  'Subject-wise marks summary',
  'Education',
  'Group marks by subject and show count, total, average, minimum and maximum.',
  [input('groups', 'Subject names'), input('data', 'Marks')],
  { groups: ['Math', 'English', 'Math'], data: [80, 90, 60] },
  [
    ['Subject', 'Count', 'Total', 'Average', 'Minimum', 'Maximum'],
    ['Math', 2, 140, 70, 60, 80],
    ['English', 1, 90, 90, 90, 90],
  ],
  (a) => {
    const groups = vector(a.groups, 'Subjects'),
      data = numeric(a.data, 'Marks');
    equal(groups, data);
    const m = new Map<string, number[]>();
    groups.forEach((g, i) => {
      if (g == null || g === '') fail('#VALUE!', 'Subject names cannot be blank.');
      m.set(String(g), [...(m.get(String(g)) ?? []), data[i]]);
    });
    return table(
      ['Subject', 'Count', 'Total', 'Average', 'Minimum', 'Maximum'],
      [...m].map(([g, n]) => [g, n.length, sum(n), average(n), Math.min(...n), Math.max(...n)]),
    );
  },
  ['subject summary', 'marks subject'],
);

define(
  'ATTENDANCE_PERCENTAGE',
  'Attendance percentage',
  'Education',
  'Calculate attended sessions divided by eligible sessions; both counts are supplied explicitly.',
  [input('attended', 'Attended sessions'), input('eligible', 'Eligible sessions')],
  { attended: [18, 15], eligible: [20, 20] },
  [
    ['Row', 'Attendance percentage'],
    [1, 90],
    [2, 75],
  ],
  (a) => {
    const attended = vector(a.attended, 'Attended sessions'),
      eligible = vector(a.eligible, 'Eligible sessions');
    equal(attended, eligible);
    return table(
      ['Row', 'Attendance percentage'],
      attended.map((v, i) => [
        i + 1,
        safe(() => {
          const n = nonnegative(v, 'Attended sessions'),
            d = positive(eligible[i], 'Eligible sessions');
          if (n > d) fail('#NUM!', 'Attended sessions cannot exceed eligible sessions.');
          return (n / d) * 100;
        }),
      ]),
    );
  },
  ['attendance percentage', 'hazri percentage'],
);

define(
  'GPA',
  'GPA / CGPA with credits',
  'Education',
  'Calculate the credit-weighted mean of grade points using your explicit grade mapping. For CGPA, select courses from all included semesters.',
  [
    input('data', 'Course grades'),
    input('credits', 'Included course credit hours'),
    input('mapping', 'Grade mapping: grade, grade points', 'matrix'),
  ],
  {
    data: ['A', 'B', 'A'],
    credits: [3, 3, 2],
    mapping: [
      ['A', 4],
      ['B', 3],
      ['F', 0],
    ],
  },
  [
    ['Included credits', 'Quality points', 'GPA / CGPA'],
    [8, 29, 3.625],
  ],
  (a) => {
    const grades = vector(a.data, 'Course grades'),
      credits = numeric(a.credits, 'Credits');
    equal(grades, credits);
    if (credits.some((c) => c < 0) || sum(credits) <= 0)
      fail('#NUM!', 'Credits must be nonnegative with a positive total.');
    const map = new Map<string, number>();
    rows(a.mapping, 'Grade-point mapping').forEach((r) => {
      if (r.length !== 2 || r[0] === '' || r[0] == null || map.has(String(r[0])))
        fail('#VALUE!', 'Each grade needs one unique grade-point mapping.');
      map.set(String(r[0]), nonnegative(r[1], 'Grade points'));
    });
    const quality = grades.reduce((s, g, i) => {
      const points = map.get(String(g));
      return (
        s +
        (points ?? fail('#N/A', `No grade-point mapping exists for ${String(g)} (row ${i + 1}).`)) *
          credits[i]
      );
    }, 0);
    return table(
      ['Included credits', 'Quality points', 'GPA / CGPA'],
      [[sum(credits), quality, quality / sum(credits)]],
    );
  },
  ['GPA', 'CGPA', 'grade points', 'credit hours'],
  [
    'Repeated courses, withdrawals and pass/fail exclusions must be selected according to your institution before calculation.',
  ],
);

define(
  'FEES',
  'Fee paid and outstanding summary',
  'Education',
  'Compare billed fees with payments and show outstanding balances or credits for each student.',
  [
    input('data', 'Student identifiers'),
    input('billed', 'Billed fees'),
    input('paid', 'Fees paid'),
  ],
  { data: ['001', '002'], billed: [1000, 1000], paid: [1000, 700] },
  [
    ['Student', 'Billed', 'Paid', 'Outstanding / (credit)'],
    ['001', 1000, 1000, 0],
    ['002', 1000, 700, 300],
    ['Total', 2000, 1700, 300],
  ],
  (a) => {
    const ids = vector(a.data, 'Student IDs'),
      billed = numeric(a.billed, 'Billed fees'),
      paid = numeric(a.paid, 'Fees paid');
    equal(ids, billed, paid);
    if ([...billed, ...paid].some((n) => n < 0))
      fail('#NUM!', 'Billed fees and payments must be nonnegative.');
    return table(
      ['Student', 'Billed', 'Paid', 'Outstanding / (credit)'],
      [
        ...ids.map((id, i) => [id, billed[i], paid[i], billed[i] - paid[i]]),
        ['Total', sum(billed), sum(paid), sum(billed) - sum(paid)],
      ],
    );
  },
  ['fee paid', 'outstanding fees', 'student balance'],
);

// Accounts and sales

define(
  'INCOME_EXPENSE',
  'Income and expense totals',
  'Accounts & Sales',
  'Sum explicitly selected income and expense amounts and calculate net income.',
  [input('income', 'Income amounts'), input('expenses', 'Expense amounts')],
  { income: [1000, 500], expenses: [400, 200] },
  [
    ['Income', 'Expenses', 'Net income'],
    [1500, 600, 900],
  ],
  (a) => {
    const income = sum(numeric(a.income, 'Income')),
      expenses = sum(numeric(a.expenses, 'Expenses'));
    return table(['Income', 'Expenses', 'Net income'], [[income, expenses, income - expenses]]);
  },
  ['income', 'expense', 'net income'],
);

define(
  'PROFIT',
  'Profit and profit margin',
  'Accounts & Sales',
  'Profit is supplied revenue minus supplied cost. Profit margin is profit divided by revenue; select costs appropriate to the margin you need.',
  [input('revenue', 'Revenue', 'number'), input('cost', 'Total included cost', 'number')],
  { revenue: 1000, cost: 750 },
  [
    ['Revenue', 'Cost', 'Profit', 'Profit margin %'],
    [1000, 750, 250, 25],
  ],
  (a) => {
    const revenue = number(a.revenue, 'Revenue'),
      cost = number(a.cost, 'Cost'),
      profit = revenue - cost;
    if (revenue === 0) fail('#DIV/0!', 'Profit margin requires nonzero revenue.');
    return table(
      ['Revenue', 'Cost', 'Profit', 'Profit margin %'],
      [[revenue, cost, profit, (profit / revenue) * 100]],
    );
  },
  ['profit', 'munafa', 'profit margin'],
);

define(
  'CUSTOMER_BALANCE',
  'Customer balances',
  'Accounts & Sales',
  'Sum signed customer ledger movements by customer. Enter invoices as positive amounts and payments or credits as negative amounts.',
  [input('groups', 'Customer identifiers'), input('amounts', 'Signed ledger amounts')],
  { groups: ['C001', 'C001', 'C002'], amounts: [1000, -400, 500] },
  [
    ['Customer', 'Outstanding / (credit)'],
    ['C001', 600],
    ['C002', 500],
  ],
  (a) =>
    table(
      ['Customer', 'Outstanding / (credit)'],
      groupTotals(vector(a.groups, 'Customers'), numeric(a.amounts, 'Ledger amounts')),
    ),
  ['customer balance', 'receivable'],
);

define(
  'INVOICE_AGING',
  'Invoice aging',
  'Accounts & Sales',
  'Bucket outstanding invoice balances by days past the supplied due date using your ascending bucket limits and an explicit as-of date.',
  [
    input('data', 'Invoice due dates YYYY-MM-DD'),
    input('amounts', 'Outstanding balances'),
    input('asOf', 'As-of date', 'date'),
    input('limits', 'Positive upper bucket limits in days'),
  ],
  {
    data: ['2024-03-01', '2024-02-15', '2024-01-01'],
    amounts: [100, 200, 300],
    asOf: '2024-03-01',
    limits: [30, 60],
  },
  [
    ['Aging bucket', 'Outstanding balance'],
    ['Not overdue', 100],
    ['1–30 days overdue', 200],
    ['31–60 days overdue', 300],
    ['61+ days overdue', 0],
  ],
  (a) => {
    const dates = vector(a.data, 'Due dates'),
      amounts = numeric(a.amounts, 'Outstanding balances');
    equal(dates, amounts);
    const asOf = date(a.asOf, 'As-of date');
    const limits = numeric(a.limits, 'Bucket limits');
    if (limits.some((v, i) => !Number.isInteger(v) || v <= 0 || (i > 0 && v <= limits[i - 1])))
      fail('#VALUE!', 'Aging limits must be strictly increasing positive whole days.');
    const totals = Array(limits.length + 2).fill(0);
    dates.forEach((d, i) => {
      const days = Math.round(
        (asOf.getTime() - date(d, `Due date, row ${i + 1}`).getTime()) / 86400000,
      );
      const bucket = days <= 0 ? 0 : limits.findIndex((n) => days <= n) + 1;
      totals[days > 0 && bucket === 0 ? totals.length - 1 : bucket] += amounts[i];
    });
    return table(
      ['Aging bucket', 'Outstanding balance'],
      [
        ['Not overdue', totals[0]],
        ...limits.map((v, i) => [`${i ? limits[i - 1] + 1 : 1}–${v} days overdue`, totals[i + 1]]),
        [`${limits.at(-1)! + 1}+ days overdue`, totals.at(-1)],
      ],
    );
  },
  ['invoice aging', 'overdue', 'receivables aging'],
);

define(
  'MONTHLY_SALES',
  'Monthly sales summary',
  'Accounts & Sales',
  'Group sales by the calendar year and month of explicitly formatted transaction dates.',
  [input('data', 'Sale dates YYYY-MM-DD'), input('amounts', 'Sale amounts')],
  { data: ['2024-01-01', '2024-01-20', '2024-02-01'], amounts: [100, 250, 500] },
  [
    ['Month', 'Sales total'],
    ['2024-01', 350],
    ['2024-02', 500],
  ],
  (a) => {
    const dates = vector(a.data, 'Sale dates').map((d) =>
      date(d, 'Sale date').toISOString().slice(0, 7),
    );
    return table(
      ['Month', 'Sales total'],
      groupTotals(dates, numeric(a.amounts, 'Sale amounts')).sort((x, y) =>
        String(x[0]).localeCompare(String(y[0])),
      ),
    );
  },
  ['monthly sales', 'sales summary'],
);

define(
  'COMMISSION',
  'Commission using your rules',
  'Accounts & Sales',
  'Apply your explicit percentage and threshold policy to each sales amount. Select whether the threshold applies to the whole sale or only the excess.',
  [
    input('data', 'Sales amounts'),
    input('rate', 'Commission percentage (for example 5 means 5%)', 'number'),
    input('threshold', 'Sales threshold', 'number'),
    input('basis', 'Commission basis', 'select', {
      options: ['excess above threshold', 'whole amount when threshold met'],
    }),
  ],
  { data: [1000, 500], rate: 10, threshold: 600, basis: 'excess above threshold' },
  [
    ['Row', 'Sales', 'Commission'],
    [1, 1000, 40],
    [2, 500, 0],
  ],
  (a) => {
    const rate = nonnegative(a.rate, 'Commission percentage') / 100,
      threshold = nonnegative(a.threshold, 'Threshold');
    if (!['excess above threshold', 'whole amount when threshold met'].includes(a.basis))
      fail('#VALUE!', 'Select a commission basis.');
    return table(
      ['Row', 'Sales', 'Commission'],
      vector(a.data, 'Sales').map((v, i) => [
        i + 1,
        v,
        safe(() => {
          const sale = nonnegative(v, 'Sales');
          return (
            (a.basis === 'excess above threshold'
              ? Math.max(0, sale - threshold)
              : sale >= threshold
                ? sale
                : 0) * rate
          );
        }),
      ]),
    );
  },
  ['commission', 'sales incentive'],
);

define(
  'LOAN',
  'Loan installments',
  'Accounts & Sales',
  'Calculate equal installments from a nominal annual percentage rate, payments per year, number of payments and payment timing. Returns a positive outgoing payment.',
  [
    input('principal', 'Amount borrowed', 'number'),
    input('annualRate', 'Nominal annual interest percentage', 'number'),
    input('frequency', 'Payments per year', 'number'),
    input('payments', 'Total number of payments', 'number'),
    input('timing', 'Payment timing', 'select', { options: ['end', 'beginning'], default: 'end' }),
  ],
  { principal: 1200, annualRate: 0, frequency: 12, payments: 12, timing: 'end' },
  [
    ['Installment', 'Total paid', 'Interest paid'],
    [100, 1200, 0],
  ],
  (a) => {
    const principal = positive(a.principal, 'Principal'),
      annualRate = nonnegative(a.annualRate, 'Annual interest percentage'),
      frequency = positive(a.frequency, 'Payments per year'),
      payments = positive(a.payments, 'Number of payments');
    if (!Number.isInteger(frequency) || !Number.isInteger(payments))
      fail('#NUM!', 'Payment frequency and count must be whole numbers.');
    if (!['end', 'beginning'].includes(a.timing ?? 'end'))
      fail('#VALUE!', 'Select payment timing.');
    const installment = -formula(
      'PMT',
      annualRate / 100 / frequency,
      payments,
      principal,
      0,
      a.timing === 'beginning' ? 1 : 0,
    );
    return table(
      ['Installment', 'Total paid', 'Interest paid'],
      [[installment, installment * payments, installment * payments - principal]],
    );
  },
  ['loan installment', 'qist', 'PMT'],
);

define(
  'DEPRECIATION',
  'Asset depreciation',
  'Accounts & Sales',
  'Calculate straight-line or sum-of-years-digits depreciation using your asset cost, salvage value, life and period. Tax depreciation policies are not inferred.',
  [
    input('cost', 'Asset cost', 'number'),
    input('salvage', 'Salvage value', 'number'),
    input('life', 'Useful life in periods', 'number'),
    input('period', 'Period to calculate', 'number'),
    input('method', 'Depreciation method', 'select', {
      options: ['straight-line', 'sum-of-years-digits'],
      default: 'straight-line',
    }),
  ],
  { cost: 10000, salvage: 1000, life: 3, period: 1, method: 'straight-line' },
  3000,
  (a) => {
    const cost = nonnegative(a.cost, 'Cost'),
      salvage = nonnegative(a.salvage, 'Salvage'),
      life = positive(a.life, 'Useful life'),
      period = positive(a.period, 'Period');
    if (salvage > cost || !Number.isInteger(life) || !Number.isInteger(period) || period > life)
      fail(
        '#NUM!',
        'Salvage cannot exceed cost; life and period must be whole numbers, with period within life.',
      );
    if (!['straight-line', 'sum-of-years-digits'].includes(a.method ?? 'straight-line'))
      fail('#VALUE!', 'Select a depreciation method.');
    return a.method === 'sum-of-years-digits'
      ? ((cost - salvage) * (life - period + 1)) / ((life * (life + 1)) / 2)
      : (cost - salvage) / life;
  },
  ['depreciation', 'asset depreciation', 'SLN', 'SYD'],
);

define(
  'INVESTMENT',
  'Investment cash-flow analysis',
  'Accounts & Sales',
  'Discount equally spaced cash flows at your per-period rate. The first flow is at time zero. Show IRR only when it converges.',
  [
    input('data', 'Cash flows (initial outlay first)'),
    input('rate', 'Discount percentage per cash-flow period', 'number'),
  ],
  { data: [-1000, 600, 600], rate: 10 },
  [
    ['Net present value', 'IRR per period %'],
    [5000 / 121, 13.06623862918075],
  ],
  (a) => {
    const cash = numeric(a.data, 'Cash flows'),
      rate = number(a.rate, 'Discount percentage') / 100;
    if (rate <= -1) fail('#NUM!', 'Discount percentage must be greater than -100%.');
    if (cash.length < 2 || !cash.some((v) => v < 0) || !cash.some((v) => v > 0))
      fail('#NUM!', 'Investment analysis needs at least one negative and one positive cash flow.');
    const npv = sum(cash.map((v, i) => v / (1 + rate) ** i));
    const irr = safe(() => formula('IRR', cash) * 100);
    return table(['Net present value', 'IRR per period %'], [[npv, irr]]);
  },
  ['investment', 'cash flow', 'NPV', 'IRR'],
  [
    'IRR may have multiple roots; the library uses its default initial guess. Cash flows are evenly spaced; use XNPV/XIRR for irregular dates.',
  ],
);

// Industry and inventory

define(
  'STOCK',
  'Inventory stock balance',
  'Inventory & Industry',
  'Calculate opening stock plus receipts minus issues for each item. Negative balances are preserved and flagged.',
  [
    input('data', 'Item identifiers'),
    input('opening', 'Opening quantities'),
    input('receipts', 'Received quantities'),
    input('issues', 'Issued quantities'),
  ],
  { data: ['A', 'B'], opening: [100, 20], receipts: [50, 10], issues: [70, 40] },
  [
    ['Item', 'Closing stock', 'Status'],
    ['A', 80, 'Available'],
    ['B', -10, 'Negative stock'],
  ],
  (a) => {
    const items = vector(a.data, 'Item identifiers'),
      opening = vector(a.opening, 'Opening quantities'),
      receipts = vector(a.receipts, 'Received quantities'),
      issues = vector(a.issues, 'Issued quantities');
    equal(items, opening, receipts, issues);
    return table(
      ['Item', 'Closing stock', 'Status'],
      items.map((item, i) => {
        const result = safe(
          () =>
            nonnegative(opening[i], 'Opening') +
            nonnegative(receipts[i], 'Receipts') -
            nonnegative(issues[i], 'Issues'),
        );
        return [
          item,
          result,
          typeof result === 'number'
            ? result < 0
              ? 'Negative stock'
              : 'Available'
            : 'Invalid input',
        ];
      }),
    );
  },
  ['stock', 'inventory', 'closing stock'],
);

define(
  'REORDER',
  'Inventory reorder alerts',
  'Inventory & Industry',
  'Flag each stock level at or below its explicitly supplied reorder threshold.',
  [
    input('data', 'Item identifiers'),
    input('stock', 'Current stock levels'),
    input('thresholds', 'Reorder thresholds per item'),
  ],
  { data: ['A', 'B'], stock: [5, 20], thresholds: [5, 10] },
  [
    ['Item', 'Stock', 'Threshold', 'Action'],
    ['A', 5, 5, 'Reorder'],
    ['B', 20, 10, 'Sufficient'],
  ],
  (a) => {
    const items = vector(a.data, 'Item identifiers'),
      stock = vector(a.stock, 'Stock levels'),
      limits = vector(a.thresholds, 'Reorder thresholds');
    equal(items, stock, limits);
    return table(
      ['Item', 'Stock', 'Threshold', 'Action'],
      items.map((item, i) => [
        item,
        stock[i],
        limits[i],
        safe(() =>
          number(stock[i], 'Stock') <= nonnegative(limits[i], 'Threshold')
            ? 'Reorder'
            : 'Sufficient',
        ),
      ]),
    );
  },
  ['reorder', 'low stock', 'inventory alerts'],
);

define(
  'PRODUCTION_COST',
  'Material and production costs',
  'Inventory & Industry',
  'Total material quantity × unit cost, explicit labor cost and overhead; divide by good output units for unit production cost.',
  [
    input('quantities', 'Material quantities'),
    input('rates', 'Material unit costs'),
    input('labor', 'Included labor cost', 'number'),
    input('overhead', 'Included overhead cost', 'number'),
    input('output', 'Good output units', 'number'),
  ],
  { quantities: [5, 3], rates: [10, 20], labor: 50, overhead: 40, output: 10 },
  [
    ['Material cost', 'Labor cost', 'Overhead cost', 'Total cost', 'Cost per good unit'],
    [110, 50, 40, 200, 20],
  ],
  (a) => {
    const q = numeric(a.quantities, 'Material quantities'),
      rates = numeric(a.rates, 'Unit costs');
    equal(q, rates);
    if ([...q, ...rates].some((n) => n < 0))
      fail('#NUM!', 'Material quantities and costs cannot be negative.');
    const material = sum(q.map((v, i) => v * rates[i])),
      labor = nonnegative(a.labor, 'Labor'),
      overhead = nonnegative(a.overhead, 'Overhead'),
      output = positive(a.output, 'Good output');
    return table(
      ['Material cost', 'Labor cost', 'Overhead cost', 'Total cost', 'Cost per good unit'],
      [
        [
          material,
          labor,
          overhead,
          material + labor + overhead,
          (material + labor + overhead) / output,
        ],
      ],
    );
  },
  ['material cost', 'production cost', 'cost per unit'],
);

define(
  'DEFECT_PERCENTAGE',
  'Defect percentage',
  'Inventory & Industry',
  'Calculate defective units divided by inspected units. A unit can count only once in these unit-based counts.',
  [input('defects', 'Defective unit counts'), input('inspected', 'Inspected unit counts')],
  { defects: [5, 2], inspected: [100, 50] },
  [
    ['Row', 'Defect percentage'],
    [1, 5],
    [2, 4],
  ],
  (a) => {
    const defects = vector(a.defects, 'Defective units'),
      inspected = vector(a.inspected, 'Inspected units');
    equal(defects, inspected);
    return table(
      ['Row', 'Defect percentage'],
      defects.map((v, i) => [
        i + 1,
        safe(() => {
          const n = nonnegative(v, 'Defective units'),
            total = positive(inspected[i], 'Inspected units');
          if (n > total || !Number.isInteger(n) || !Number.isInteger(total))
            fail(
              '#NUM!',
              'Unit counts must be whole numbers and defects cannot exceed inspected units.',
            );
          return (n / total) * 100;
        }),
      ]),
    );
  },
  ['defect', 'quality', 'rejection percentage'],
);

define(
  'EFFICIENCY',
  'Production efficiency against targets',
  'Inventory & Industry',
  'Calculate actual good output divided by your defined output target for the same period and conditions.',
  [input('actual', 'Actual good output'), input('targets', 'Defined output targets')],
  { actual: [90, 110], targets: [100, 100] },
  [
    ['Row', 'Target attainment %'],
    [1, 90],
    [2, 110],
  ],
  (a) => {
    const actual = vector(a.actual, 'Actual output'),
      targets = vector(a.targets, 'Output targets');
    equal(actual, targets);
    return table(
      ['Row', 'Target attainment %'],
      actual.map((v, i) => [i + 1, safe(() => percentage(v, targets[i], 'Actual output'))]),
    );
  },
  ['production efficiency', 'target attainment'],
);

define(
  'UNIT_CONVERSION',
  'Unit conversion',
  'Inventory & Industry',
  'Convert measurements using Excel-compatible unit codes, such as m, ft, kg, lbm, C or F. Incompatible dimensions are rejected.',
  [
    input('data', 'Numeric measurements'),
    input('from', 'From unit code', 'text'),
    input('to', 'To unit code', 'text'),
  ],
  { data: [1, 2], from: 'm', to: 'cm' },
  [
    ['Row', 'Converted value', 'Unit'],
    [1, 100, 'cm'],
    [2, 200, 'cm'],
  ],
  (a) => {
    if (!a.from || !a.to) fail('#VALUE!', 'Supply both unit codes.');
    return table(
      ['Row', 'Converted value', 'Unit'],
      vector(a.data, 'Measurements').map((v, i) => [
        i + 1,
        safe(() => convert(number(v, 'Measurement'), String(a.from), String(a.to))),
        String(a.to),
      ]),
    );
  },
  ['unit conversion', 'convert', 'measurement'],
);

define(
  'PACKING',
  'Batch and packing calculation',
  'Inventory & Industry',
  'Calculate full packs, loose units and packs needed for each batch using your units-per-pack rule.',
  [input('data', 'Batch quantities'), input('packSize', 'Units per pack', 'number')],
  { data: [105, 100], packSize: 10 },
  [
    ['Batch row', 'Full packs', 'Loose units', 'Packs needed'],
    [1, 10, 5, 11],
    [2, 10, 0, 10],
  ],
  (a) => {
    const size = positive(a.packSize, 'Units per pack');
    if (!Number.isInteger(size)) fail('#NUM!', 'Units per pack must be a whole number.');
    return table(
      ['Batch row', 'Full packs', 'Loose units', 'Packs needed'],
      vector(a.data, 'Batch quantities').map((v, i) => {
        const result = safe(() => {
          const qty = nonnegative(v, 'Batch quantity');
          if (!Number.isInteger(qty)) fail('#NUM!', 'Batch quantities must be whole units.');
          return [Math.floor(qty / size), qty % size, Math.ceil(qty / size)];
        });
        return [i + 1, ...(Array.isArray(result) ? result : [result, result, result])];
      }),
    );
  },
  ['batch', 'packing', 'packs', 'cartons'],
);

define(
  'SUPPLIERS',
  'Supplier cost comparison',
  'Inventory & Industry',
  'Compare total landed quotes for the same required quantity, including explicit additional costs, then rank lowest cost first. All amounts must use the same currency and basis.',
  [
    input('data', 'Supplier names'),
    input('rates', 'Quoted unit prices'),
    input('extras', 'Additional shipping / included costs per supplier'),
    input('quantity', 'Required quantity', 'number'),
  ],
  { data: ['Alpha', 'Beta'], rates: [10, 9], extras: [0, 20], quantity: 10 },
  [
    ['Supplier', 'Landed total', 'Landed unit cost', 'Cost rank'],
    ['Alpha', 100, 10, 1],
    ['Beta', 110, 11, 2],
  ],
  (a) => {
    const suppliers = vector(a.data, 'Suppliers'),
      rates = numeric(a.rates, 'Unit prices'),
      extras = numeric(a.extras, 'Additional costs'),
      quantity = positive(a.quantity, 'Quantity');
    equal(suppliers, rates, extras);
    if ([...rates, ...extras].some((n) => n < 0))
      fail('#NUM!', 'Prices and additional costs cannot be negative.');
    const totals = rates.map((r, i) => r * quantity + extras[i]);
    return table(
      ['Supplier', 'Landed total', 'Landed unit cost', 'Cost rank'],
      suppliers.map((s, i) => [
        s,
        totals[i],
        totals[i] / quantity,
        totals.filter((n) => n < totals[i]).length + 1,
      ]),
    );
  },
  ['supplier comparison', 'quotes', 'procurement'],
);

// Research

const sample = (v: any, label: string, minimum = 2) => {
  const n = numeric(v, label);
  if (n.length < minimum) fail('#DIV/0!', `${label} needs at least ${minimum} observations.`);
  return n;
};
const variance = (n: number[], population = false) =>
  sum(n.map((v) => (v - average(n)) ** 2)) / (n.length - (population ? 0 : 1));
const paired = (a: Args) => {
  const x = sample(a.x, 'X values'),
    y = sample(a.y, 'Y values');
  equal(x, y);
  return { x, y };
};
const regression = (x: number[], y: number[]) => {
  const xm = average(x),
    ym = average(y),
    xx = sum(x.map((v) => (v - xm) ** 2)),
    yy = sum(y.map((v) => (v - ym) ** 2)),
    xy = sum(x.map((v, i) => (v - xm) * (y[i] - ym)));
  if (xx === 0) fail('#DIV/0!', 'X values must have variation.');
  return {
    slope: xy / xx,
    intercept: ym - (xy / xx) * xm,
    r2:
      yy === 0
        ? { error: '#DIV/0!', message: 'R² is undefined for constant Y.' }
        : (xy * xy) / (xx * yy),
    xx,
    yy,
    xy,
  };
};

define(
  'DESCRIPTIVE',
  'Descriptive statistics',
  'Research',
  'Show count, mean, median, minimum, maximum and explicitly selected sample or population variance and standard deviation.',
  [
    input('data', 'Observations'),
    input('basis', 'Variance and standard deviation basis', 'select', {
      options: ['sample', 'population'],
      default: 'sample',
    }),
  ],
  { data: [1, 2, 3, 4, 5], basis: 'sample' },
  [
    ['Statistic', 'Value'],
    ['Count', 5],
    ['Mean', 3],
    ['Median', 3],
    ['Minimum', 1],
    ['Maximum', 5],
    ['Variance (sample)', 2.5],
    ['Standard deviation (sample)', Math.sqrt(2.5)],
  ],
  (a) => {
    const basis = a.basis ?? 'sample';
    if (!['sample', 'population'].includes(basis)) fail('#VALUE!', 'Select sample or population.');
    const n = sample(a.data, 'Observations', basis === 'sample' ? 2 : 1),
      sorted = [...n].sort((x, y) => x - y),
      v = variance(n, basis === 'population');
    return table(
      ['Statistic', 'Value'],
      [
        ['Count', n.length],
        ['Mean', average(n)],
        [
          'Median',
          n.length % 2
            ? sorted[Math.floor(n.length / 2)]
            : (sorted[n.length / 2 - 1] + sorted[n.length / 2]) / 2,
        ],
        ['Minimum', Math.min(...n)],
        ['Maximum', Math.max(...n)],
        [`Variance (${basis})`, v],
        [`Standard deviation (${basis})`, Math.sqrt(v)],
      ],
    );
  },
  ['descriptive statistics', 'research', 'mean standard deviation'],
);

define(
  'CORRELATION',
  'Pearson correlation',
  'Research',
  'Calculate Pearson correlation between paired numeric observations. Association does not establish causation.',
  [input('x', 'X values'), input('y', 'Y values')],
  { x: [1, 2, 3], y: [2, 4, 6] },
  1,
  (a) => {
    const { x, y } = paired(a),
      r = regression(x, y);
    if (r.yy === 0) fail('#DIV/0!', 'Y values must have variation.');
    return r.xy / Math.sqrt(r.xx * r.yy);
  },
  ['correlation', 'relationship', 'CORREL'],
);

define(
  'REGRESSION',
  'Linear regression summary',
  'Research',
  'Fit ordinary least squares Y = intercept + slope × X, with R² and residual standard error. Association does not establish causation.',
  [input('x', 'Predictor X values'), input('y', 'Response Y values')],
  { x: [1, 2, 3, 4], y: [3, 5, 7, 9] },
  [
    ['Statistic', 'Value'],
    ['Slope', 2],
    ['Intercept', 1],
    ['R²', 1],
    ['Residual standard error', 0],
    ['Observations', 4],
  ],
  (a) => {
    const { x, y } = paired(a);
    if (x.length < 3)
      fail('#DIV/0!', 'A regression summary with residual error needs at least three pairs.');
    const r = regression(x, y),
      residuals = sum(x.map((v, i) => (y[i] - (r.intercept + r.slope * v)) ** 2));
    return table(
      ['Statistic', 'Value'],
      [
        ['Slope', r.slope],
        ['Intercept', r.intercept],
        ['R²', r.r2],
        ['Residual standard error', Math.sqrt(residuals / (x.length - 2))],
        ['Observations', x.length],
      ],
    );
  },
  ['regression', 'research regression', 'linear trend', 'LINEST'],
);

define(
  'PROBABILITY',
  'Normal probability',
  'Research',
  'Calculate a normal-distribution cumulative probability or density using your supplied population mean and standard deviation.',
  [
    input('x', 'Value', 'number'),
    input('mean', 'Population mean', 'number'),
    input('standardDeviation', 'Population standard deviation', 'number'),
    input('mode', 'Result type', 'select', {
      options: ['cumulative probability', 'density'],
      default: 'cumulative probability',
    }),
  ],
  { x: 0, mean: 0, standardDeviation: 1, mode: 'cumulative probability' },
  0.5,
  (a) => {
    const x = number(a.x, 'Value'),
      mean = number(a.mean, 'Mean'),
      sd = positive(a.standardDeviation, 'Standard deviation');
    if (!['cumulative probability', 'density'].includes(a.mode ?? 'cumulative probability'))
      fail('#VALUE!', 'Choose cumulative probability or density.');
    return a.mode === 'density' ? stats.normal.pdf(x, mean, sd) : stats.normal.cdf(x, mean, sd);
  },
  ['probability', 'normal distribution', 'NORM.DIST'],
);

define(
  'CONFIDENCE_INTERVAL',
  'Mean confidence interval',
  'Research',
  'Calculate a two-sided Student t confidence interval for the population mean from independent observations, assuming an appropriate sampling distribution.',
  [
    input('data', 'Sample observations'),
    input('confidence', 'Confidence level as a percentage', 'number'),
  ],
  { data: [2, 4, 6, 8, 10], confidence: 95 },
  [
    ['Mean', 'Lower bound', 'Upper bound', 'Confidence %', 'Degrees of freedom'],
    [6, 2.073513677044879, 9.92648632295512, 95, 4],
  ],
  (a) => {
    const n = sample(a.data, 'Observations'),
      confidence = number(a.confidence, 'Confidence level');
    if (confidence <= 0 || confidence >= 100)
      fail('#NUM!', 'Confidence must be greater than 0 and less than 100 percent.');
    const mean = average(n),
      margin =
        stats.studentt.inv((1 + confidence / 100) / 2, n.length - 1) *
        Math.sqrt(variance(n) / n.length);
    return table(
      ['Mean', 'Lower bound', 'Upper bound', 'Confidence %', 'Degrees of freedom'],
      [[mean, mean - margin, mean + margin, confidence, n.length - 1]],
    );
  },
  ['confidence interval', 'research confidence', 'CONFIDENCE.T'],
);

define(
  'STATISTICAL_TEST',
  'Two-sample or paired t test',
  'Research',
  'Run an explicitly chosen paired, equal-variance or Welch two-sample t test. Directional tails test X greater than Y or X less than Y. The p-value is not evidence of causation.',
  [
    input('x', 'Sample X'),
    input('y', 'Sample Y'),
    input('test', 'Test assumption', 'select', {
      options: ['Welch unequal variance', 'equal variance', 'paired'],
    }),
    input('alternative', 'Alternative hypothesis', 'select', {
      options: ['two-sided', 'X greater than Y', 'X less than Y'],
      default: 'two-sided',
    }),
  ],
  { x: [1, 2, 3], y: [2, 3, 4], test: 'Welch unequal variance', alternative: 'two-sided' },
  [
    ['t statistic', 'Degrees of freedom', 'p-value', 'Alternative'],
    [-1.224744871391589, 4, 0.2878641347266908, 'two-sided'],
  ],
  (a) => {
    const x = sample(a.x, 'Sample X'),
      y = sample(a.y, 'Sample Y');
    let t: number, df: number;
    if (a.test === 'paired') {
      equal(x, y);
      const d = x.map((v, i) => v - y[i]),
        se = Math.sqrt(variance(d) / d.length);
      if (!se) fail('#DIV/0!', 'Paired differences need nonzero variance.');
      t = average(d) / se;
      df = d.length - 1;
    } else if (a.test === 'equal variance') {
      df = x.length + y.length - 2;
      const pooled = ((x.length - 1) * variance(x) + (y.length - 1) * variance(y)) / df;
      const se = Math.sqrt(pooled * (1 / x.length + 1 / y.length));
      if (!se) fail('#DIV/0!', 'Samples need nonzero combined variance.');
      t = (average(x) - average(y)) / se;
    } else if (a.test === 'Welch unequal variance') {
      const vx = variance(x) / x.length,
        vy = variance(y) / y.length;
      if (vx + vy === 0) fail('#DIV/0!', 'Samples need nonzero combined variance.');
      t = (average(x) - average(y)) / Math.sqrt(vx + vy);
      df = (vx + vy) ** 2 / ((vx * vx) / (x.length - 1) + (vy * vy) / (y.length - 1));
    } else return fail('#VALUE!', 'Select a test assumption.');
    const alternative = a.alternative ?? 'two-sided';
    if (!['two-sided', 'X greater than Y', 'X less than Y'].includes(alternative))
      fail('#VALUE!', 'Choose an alternative hypothesis.');
    const p =
      alternative === 'two-sided'
        ? 2 * stats.studentt.cdf(-Math.abs(t), df)
        : alternative === 'X greater than Y'
          ? stats.studentt.cdf(-t, df)
          : stats.studentt.cdf(t, df);
    return table(
      ['t statistic', 'Degrees of freedom', 'p-value', 'Alternative'],
      [[t, df, p, alternative]],
    );
  },
  ['statistical test', 't test', 'research test', 'T.TEST'],
);

export { workflowFunctions };
