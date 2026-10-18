import { CalcError } from './types';
import type { CellError } from './types';

export type ComparisonValue = boolean | CellError;
export type ComparisonResult = ComparisonValue | ComparisonValue[];
const errorValue = (value: any): CellError | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) && typeof value.error === 'string'
    ? value
    : undefined;
const aliases: Record<string, string> = {
  '==': '=',
  '===': '=',
  eq: '=',
  '!=': '<>',
  '!==': '<>',
  ne: '<>',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  startsWith: 'starts with',
  endsWith: 'ends with',
};
function vector(value: any): any[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.some(Array.isArray)) return value;
  if (value.length === 1 && Array.isArray(value[0]) && !value[0].some(Array.isArray))
    return value[0];
  if (value.every((row) => Array.isArray(row) && row.length === 1 && !Array.isArray(row[0])))
    return value.map((row) => row[0]);
  throw new CalcError(
    '#VALUE!',
    'A comparison needs a single row or column, rather than a two-dimensional table.',
  );
}
function one(left: any, right: any, operator: string): ComparisonValue {
  const error = errorValue(left) || errorValue(right);
  if (error) return error;
  for (const value of [left, right]) {
    if (typeof value === 'number' && !Number.isFinite(value))
      return { error: '#NUM!', message: 'A comparison input is not a finite number.' };
    if (
      value !== null &&
      value !== undefined &&
      !['string', 'number', 'boolean'].includes(typeof value)
    )
      return { error: '#VALUE!', message: 'Compare cell values, not an object or a nested table.' };
  }
  // A blank is 0 against a number, empty text against text, FALSE against a Boolean.
  // Numeric-looking text is deliberately left as text: employee ID 0012 is not 12.
  if (left === null || left === undefined)
    left = typeof right === 'string' ? '' : typeof right === 'boolean' ? false : 0;
  if (right === null || right === undefined)
    right = typeof left === 'string' ? '' : typeof left === 'boolean' ? false : 0;
  if (['contains', 'starts with', 'ends with'].includes(operator)) {
    if (typeof left !== 'string' || typeof right !== 'string')
      return { error: '#VALUE!', message: 'Text matching requires text on both sides.' };
    const a = left.toLowerCase(),
      b = right.toLowerCase();
    return operator === 'contains'
      ? a.includes(b)
      : operator === 'starts with'
        ? a.startsWith(b)
        : a.endsWith(b);
  }
  let comparison: number;
  if (typeof left === typeof right) {
    const a = typeof left === 'string' ? left.toLowerCase() : left,
      b = typeof right === 'string' ? right.toLowerCase() : right;
    comparison = a === b ? 0 : a > b ? 1 : -1;
  } else {
    // Excel comparisons order numeric cells before text cells and then Booleans.
    const order: Record<string, number> = { number: 0, string: 1, boolean: 2 };
    comparison = Math.sign(order[typeof left] - order[typeof right]);
  }
  switch (operator) {
    case '=':
      return comparison === 0;
    case '<>':
      return comparison !== 0;
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    default:
      throw new CalcError('#VALUE!', 'Choose a supported comparison operator.');
  }
}
/** Broadcast a scalar against a selected column and preserve errors at their row. */
export function compareInputs(left: any, right: any, operator: string): ComparisonResult {
  const op = aliases[operator] || operator;
  if (!['=', '<>', '>', '>=', '<', '<=', 'contains', 'starts with', 'ends with'].includes(op))
    throw new CalcError(
      '#VALUE!',
      'Choose =, <>, >, >=, <, <=, contains, starts with, or ends with.',
    );
  const a = vector(left),
    b = vector(right);
  if (a && b && a.length !== b.length)
    throw new CalcError('#VALUE!', 'Compared columns must contain the same number of rows.');
  if (a || b)
    return Array.from({ length: (a || b)!.length }, (_, i) =>
      one(a ? a[i] : left, b ? b[i] : right, op),
    );
  return one(left, right, op);
}
