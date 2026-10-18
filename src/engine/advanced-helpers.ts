import {
  CalcError,
  fail,
  flatten,
  matrix,
  numeric,
  type CalcContext,
  type ModelProvider,
  type Sheet,
} from './types';

export const cellError = (value: any): void => {
  if (value && typeof value === 'object' && 'error' in value)
    fail(value.error, value.message || value.error);
};
export const integer = (value: any, label = 'Value'): number => Math.trunc(numeric(value, label));
export const cmp = (a: any, b: any): number => {
  cellError(a);
  cellError(b);
  if (a === null) a = 0;
  if (b === null) b = 0;
  if (typeof a === 'string' && typeof b === 'string') {
    a = a.toLocaleLowerCase();
    b = b.toLocaleLowerCase();
  }
  if (a === b) return 0;
  // Excel sorts numbers before strings and strings before logical values.
  const typeOrder = (v: any) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  if (typeof a !== typeof b) return Math.sign(typeOrder(a) - typeOrder(b));
  return a < b ? -1 : 1;
};
export const wildcard = (pattern: string, text: any): boolean => {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '~' && i + 1 < pattern.length)
      source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (char === '*') source += '.*';
    else if (char === '?') source += '.';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'i').test(String(text ?? ''));
};
export const matchesCriterion = (value: any, criterion: any, prefix = false): boolean => {
  cellError(value);
  if (criterion === null || criterion === '') return true;
  if (typeof criterion !== 'string') return cmp(value, criterion) === 0;
  const parsed = criterion.match(/^(<=|>=|<>|=|<|>)(.*)$/s);
  const operator = parsed?.[1] || '=';
  let target: any = parsed ? parsed[2] : criterion;
  const original = target;
  if (target.trim() !== '' && Number.isFinite(Number(target))) target = Number(target);
  if (target === '') {
    const blank = value === '' || value === null;
    return operator === '<>' ? !blank : operator === '=' ? blank : false;
  }
  if (typeof target === 'string' && ['=', '<>'].includes(operator)) {
    const hasWildcards = /[?*~]/.test(original);
    const equal = hasWildcards
      ? typeof value === 'string' && wildcard(original, value)
      : prefix && !parsed
        ? typeof value === 'string' && value.toLowerCase().startsWith(target.toLowerCase())
        : cmp(value, target) === 0;
    return operator === '<>' ? !equal : equal;
  }
  const d = cmp(value, target);
  return operator === '='
    ? d === 0
    : operator === '<>'
      ? d !== 0
      : operator === '<'
        ? d < 0
        : operator === '<='
          ? d <= 0
          : operator === '>'
            ? d > 0
            : d >= 0;
};
export const vector = (value: any, label = 'Lookup range'): any[] => {
  const m = matrix(value);
  if (m.length !== 1 && m[0].length !== 1)
    fail('#VALUE!', `${label} must be one row or one column.`);
  return flatten(m);
};
export function lookupIndex(
  value: any,
  values: any[],
  mode = 0,
  search = 1,
  duplicates = 'first',
): number[] {
  cellError(value);
  if (![0, -1, 1, 2].includes(mode))
    fail(
      '#VALUE!',
      'Match mode must be exact (0), next smaller (-1), next larger (1), or wildcard (2).',
    );
  if (![1, -1, 2, -2].includes(search)) fail('#VALUE!', 'Search direction must be 1, -1, 2 or -2.');
  if (Math.abs(search) === 2) {
    if (mode === 2) fail('#VALUE!', 'Wildcard matching cannot use binary search.');
    for (let i = 1; i < values.length; i++)
      if (cmp(values[i - 1], values[i]) * Math.sign(search) > 0)
        fail('#N/A', 'Binary search requires a lookup range sorted in the selected direction.');
  }
  const exact = values
    .map((v, i) =>
      mode === 2 && typeof value === 'string'
        ? typeof v === 'string' && wildcard(value, v)
          ? i
          : -1
        : cmp(v, value) === 0
          ? i
          : -1,
    )
    .filter((i) => i >= 0);
  if (exact.length) {
    if (duplicates === 'error' && exact.length > 1)
      fail('#N/A', 'Multiple lookup matches found; choose a duplicate policy.');
    if (duplicates === 'all') return exact;
    return [
      duplicates === 'last' || (duplicates === 'first' && search < 0)
        ? exact[exact.length - 1]
        : exact[0],
    ];
  }
  if (mode === 0 || mode === 2) return [];
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    const d = cmp(values[i], value);
    if ((mode === -1 && d < 0) || (mode === 1 && d > 0)) {
      if (best === -1 || cmp(values[i], values[best]) * mode < 0) best = i;
    }
  }
  return best === -1 ? [] : [best];
}
export const missingLookup = (args: Record<string, any>): any => {
  if (args.missing === 'blank') return null;
  if (args.missing === 'custom' || args.ifNotFound !== undefined) return args.ifNotFound ?? '';
  return fail('#N/A', 'No matching value was found.');
};
export const columnLetters = (column: number): string => {
  if (!Number.isInteger(column) || column < 1 || column > 16384)
    fail('#REF!', 'Column must be from 1 to 16384.');
  let output = '';
  while (column > 0) {
    column--;
    output = String.fromCharCode(65 + (column % 26)) + output;
    column = Math.floor(column / 26);
  }
  return output;
};
export const columnNumber = (letters: string): number =>
  [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
export interface Reference {
  sheet: Sheet;
  row: number;
  column: number;
  height: number;
  width: number;
}
export function resolveReference(
  reference: any,
  context: CalcContext,
  style = 'A1',
  anchorRow = 1,
  anchorColumn = 1,
): Reference {
  if (!context.workbook) fail('#REF!', 'Select a workbook before resolving a reference.');
  let text = String(reference ?? '').trim();
  let sheet =
    context.workbook.sheets.find((s) => s.id === context.sheetId) || context.workbook.sheets[0];
  const named = text.match(/^(?:'((?:[^']|'')+)'|([^'!]+))!(.+)$/);
  if (named) {
    const name = named[1]?.replace(/''/g, "'") || named[2];
    sheet = context.workbook.sheets.find(
      (s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name,
    )!;
    text = named[3];
  }
  if (!sheet || (/[\[\]]/.test(text) && style === 'A1'))
    fail('#REF!', 'Unknown sheet or external workbook reference.');
  const parse = (part: string): [number, number] => {
    if (style === 'R1C1') {
      const p = part.match(/^R(\d+|\[-?\d+\])?C(\d+|\[-?\d+\])?$/i);
      if (!p) return fail('#REF!', 'Choose a valid R1C1 reference.');
      const coord = (v: string | undefined, anchor: number) =>
        !v ? anchor : v.startsWith('[') ? anchor + Number(v.slice(1, -1)) : Number(v);
      return [coord(p[1], anchorRow), coord(p[2], anchorColumn)];
    }
    const p = part.match(/^\$?([A-Za-z]{1,3})\$?(\d+)$/);
    if (!p) return fail('#REF!', 'Choose a valid cell or rectangular range.');
    return [Number(p[2]), columnNumber(p[1])];
  };
  const pieces = text.split(':');
  if (pieces.length > 2) fail('#REF!', 'A reference must be one rectangular range.');
  const start = parse(pieces[0]),
    end = parse(pieces[1] || pieces[0]);
  if (
    start[0] < 1 ||
    end[0] > 1048576 ||
    start[1] < 1 ||
    end[1] > 16384 ||
    end[0] < start[0] ||
    end[1] < start[1]
  )
    fail('#REF!', 'Reference is outside Excel worksheet bounds.');
  return {
    sheet,
    row: start[0],
    column: start[1],
    height: end[0] - start[0] + 1,
    width: end[1] - start[1] + 1,
  };
}
export const referenceValues = (ref: Reference): any[][] => {
  if (ref.height * ref.width > 1_000_000)
    fail('#NUM!', 'Select at most one million cells at a time.');
  // Worksheet row 1 contains headers; stored rows begin at worksheet row 2.
  return Array.from({ length: ref.height }, (_, r) =>
    Array.from({ length: ref.width }, (_, c) =>
      ref.row + r === 1
        ? (ref.sheet.columns[ref.column - 1 + c]?.name ?? null)
        : (ref.sheet.rows[ref.row - 2 + r]?.[ref.column - 1 + c] ?? null),
    ),
  );
};
export const collapse = (m: any[][]): any => (m.length === 1 && m[0].length === 1 ? m[0][0] : m);
export const transpose = (m: any[][]): any[][] => m[0].map((_, c) => m.map((r) => r[c]));
export const NA = (): { error: string; message: string } => ({
  error: '#N/A',
  message: 'Padded array cell.',
});

export interface SafeOperation {
  op: string;
  value?: any;
  name?: string;
  args?: SafeOperation[];
  bindings?: { name: string; value: SafeOperation | any }[];
  body?: SafeOperation;
}
export type SafeScope = Record<string, any>;
export function evaluateOperation(expression: any, scope: SafeScope = {}, depth = 0): any {
  if (depth > 64) fail('#NUM!', 'Operation nesting exceeds 64 levels.');
  if (expression === null || typeof expression !== 'object' || Array.isArray(expression))
    return expression;
  const node: SafeOperation = expression;
  if (node.op === 'value') return node.value;
  if (node.op === 'variable') {
    if (!node.name || !Object.prototype.hasOwnProperty.call(scope, node.name))
      fail('#NAME?', `Unknown operation variable: ${node.name || '(empty)'}.`);
    return scope[node.name];
  }
  if (node.op === 'let') {
    const local = Object.assign(Object.create(null), scope);
    for (const binding of node.bindings || []) {
      validName(binding.name);
      local[binding.name] = evaluateOperation(binding.value, local, depth + 1);
    }
    return evaluateOperation(node.body, local, depth + 1);
  }
  const args = node.args || [];
  const evaluate = (a: any) => evaluateOperation(a, scope, depth + 1);
  if (node.op === 'if') {
    if (args.length !== 3)
      fail('#VALUE!', 'A conditional operation needs a test and two outcomes.');
    return evaluate(args[0]) ? evaluate(args[1]) : evaluate(args[2]);
  }
  if (node.op === 'iferror') {
    try {
      return evaluate(args[0]);
    } catch (error) {
      if (error instanceof CalcError) return evaluate(args[1]);
      throw error;
    }
  }
  const values = args.map(evaluate);
  values.forEach(cellError);
  const nums = () => {
    const cells = flatten(values);
    cells.forEach(cellError);
    return cells.filter((v) => typeof v === 'number' && Number.isFinite(v));
  };
  const binary = (f: (a: number, b: number) => any) => {
    if (values.length !== 2) fail('#VALUE!', `${node.op} requires two operands.`);
    const out = f(numeric(values[0]), numeric(values[1]));
    if (typeof out === 'number' && !Number.isFinite(out))
      fail('#NUM!', 'Operation produced a nonfinite result.');
    return out;
  };
  switch (node.op) {
    case 'add':
      return binary((a, b) => a + b);
    case 'subtract':
      return binary((a, b) => a - b);
    case 'multiply':
      return binary((a, b) => a * b);
    case 'divide':
      return binary((a, b) => (b === 0 ? fail('#DIV/0!', 'Cannot divide by zero.') : a / b));
    case 'power':
      return binary((a, b) => a ** b);
    case 'sum':
      return nums().reduce((a, b) => a + b, 0);
    case 'average': {
      const n = nums();
      return n.length
        ? n.reduce((a, b) => a + b, 0) / n.length
        : fail('#DIV/0!', 'No numeric values to average.');
    }
    case 'min':
      return nums().length ? Math.min(...nums()) : 0;
    case 'max':
      return nums().length ? Math.max(...nums()) : 0;
    case 'count':
      return flatten(values).filter((v) => typeof v === 'number' && Number.isFinite(v)).length;
    case 'concat':
      return flatten(values)
        .map((v) => v ?? '')
        .join('');
    case 'upper':
      return String(values[0] ?? '').toUpperCase();
    case 'lower':
      return String(values[0] ?? '').toLowerCase();
    case 'abs':
      return Math.abs(numeric(values[0]));
    case 'round': {
      const n = numeric(values[0]),
        factor = 10 ** integer(values[1] ?? 0);
      return (Math.sign(n) * Math.round(Math.abs(n) * factor + Number.EPSILON)) / factor;
    }
    case 'gt':
      return cmp(values[0], values[1]) > 0;
    case 'gte':
      return cmp(values[0], values[1]) >= 0;
    case 'lt':
      return cmp(values[0], values[1]) < 0;
    case 'lte':
      return cmp(values[0], values[1]) <= 0;
    case 'eq':
      return cmp(values[0], values[1]) === 0;
    case 'neq':
      return cmp(values[0], values[1]) !== 0;
    case 'and':
      return values.every(Boolean);
    case 'or':
      return values.some(Boolean);
    case 'not':
      return !values[0];
    default:
      return fail('#NAME?', `Operation '${node.op}' is not in the safe operation catalogue.`);
  }
}
export function validName(name: string): void {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
    ['__proto__', 'constructor', 'prototype'].includes(name)
  )
    fail('#NAME?', 'Use a safe variable name beginning with a letter or underscore.');
}
export function parameterNames(value: any, defaults: string[]): string[] {
  const names =
    value === undefined || value === ''
      ? defaults
      : Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((s) => s.trim());
  names.forEach(validName);
  if (new Set(names).size !== names.length)
    fail('#VALUE!', 'Reusable calculation parameter names must be unique.');
  return names;
}
export const boundedSize = (rows: number, cols: number): void => {
  if (rows < 1 || cols < 1 || rows * cols > 1_000_000)
    fail('#NUM!', 'Array dimensions must be positive and contain at most one million cells.');
};
export const scalarResult = (v: any): any =>
  Array.isArray(v) ? fail('#CALC!', 'The operation must return one value per processed item.') : v;

// This is an explicit local analytical provider, not a remote Excel/SSAS cube.
const demoFacts = [
  { Region: 'North', Product: 'Paper', Sales: 1200, Units: 120 },
  { Region: 'North', Product: 'Pens', Sales: 800, Units: 200 },
  { Region: 'South', Product: 'Paper', Sales: 1500, Units: 150 },
  { Region: 'South', Product: 'Pens', Sales: 500, Units: 125 },
];
export const demoProvider: ModelProvider = {
  id: 'demo',
  label: 'Demonstration sales model (local sample data)',
  demo: true,
  members(dimension) {
    if (!['Region', 'Product'].includes(dimension))
      fail('#N/A', `Unknown demo dimension '${dimension}'. Choose Region or Product.`);
    return [...new Set(demoFacts.map((row) => String(row[dimension as 'Region' | 'Product'])))];
  },
  value(measure, filters) {
    if (!['Sales', 'Units'].includes(measure))
      fail('#N/A', 'Unknown measure. Choose Sales or Units.');
    for (const [dimension, member] of Object.entries(filters))
      if (!this.members(dimension).includes(member))
        fail('#N/A', `Member '${member}' is not in dimension '${dimension}'.`);
    return demoFacts
      .filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key as 'Region' | 'Product'] === value),
      )
      .reduce((sum, row) => sum + row[measure as 'Sales' | 'Units'], 0);
  },
};
