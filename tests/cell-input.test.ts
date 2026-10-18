import { describe, expect, it } from 'vitest';
import { parseCellInput, formatCellInput } from '../src/engine/cell-input';
import { compareInputs } from '../src/engine/comparison';
import { baseFunctions } from '../src/engine/base';
import { CalcError } from '../src/engine/types';
import type { DataType } from '../src/engine/types';
const cases: [DataType, string, any][] = [
  ['text', '00123', '00123'],
  ['text', '', ''],
  ['text', '  Ali  ', '  Ali  '],
  ['text', 'TRUE', 'TRUE'],
  ['text', '#N/A', '#N/A'],
  ['text', '=SUM(A1)', '=SUM(A1)'],
  ['text', '9007199254740993', '9007199254740993'],
  ['mixed', '00123', '00123'],
  ['mixed', '-00123', '-00123'],
  ['mixed', '1234567890123456', '1234567890123456'],
  ['mixed', '9007199254740993', '9007199254740993'],
  ['mixed', 'false', false],
  ['mixed', '-2.5', -2.5],
  ['mixed', '0', 0],
  ['mixed', '1e2', 100],
  ['mixed', '1e999', '1e999'],
  ['mixed', '2024-01-01', '2024-01-01'],
  ['mixed', '=SUM(A1)', '=SUM(A1)'],
  ['mixed', '', null],
  ['number', '', null],
  ['number', '  ', null],
  ['number', '-25', -25],
  ['number', '+0.5', 0.5],
  ['number', '0', 0],
  ['number', '.25', 0.25],
  ['number', '1e-3', 0.001],
  ['number', '00123', 123],
  ['currency', '$1,234.50', 1234.5],
  ['currency', '-$1,234.50', -1234.5],
  ['currency', '$-1,234.50', -1234.5],
  ['currency', '($1,234.50)', -1234.5],
  ['currency', '₨ 1,234', 1234],
  ['currency', 'PKR 1,234.50', 1234.5],
  ['currency', '1,234.50 USD', 1234.5],
  ['currency', '-20', -20],
  ['currency', '', null],
  ['percentage', '25%', 0.25],
  ['percentage', '-2.5%', -0.025],
  ['percentage', '.25', 0.25],
  ['percentage', '25', 25],
  ['percentage', '0%', 0],
  ['percentage', '', null],
  ['boolean', 'TRUE', true],
  ['boolean', ' false ', false],
  ['boolean', '', null],
  ['date', '2024-2-29', '2024-02-29'],
  ['date', '1900-02-29', '1900-02-29'],
  ['date', '', null],
  ['time', '1:30 PM', '13:30'],
  ['time', '12:00 AM', '00:00'],
  ['time', '12:00 PM', '12:00'],
  ['time', '0:00:00', '00:00:00'],
  ['time', '23:59:59.500', '23:59:59.5'],
  ['time', '1:02:03.000', '01:02:03'],
  ['time', '', null],
];
describe('explicit cell type parsing', () => {
  for (const [type, input, expected] of cases)
    it(`${type}: ${JSON.stringify(input)}`, () =>
      expect(parseCellInput(input, type)).toEqual(expected));
  for (const type of [
    'number',
    'currency',
    'percentage',
    'boolean',
    'date',
    'time',
    'mixed',
  ] as DataType[])
    it(`${type} retains a typed error`, () =>
      expect(parseCellInput('#N/A', type)).toEqual({ error: '#N/A' }));
  const invalid: [DataType, string, string][] = [
    ['number', 'false', '#VALUE!'],
    ['number', '1,2', '#VALUE!'],
    ['number', 'NaN', '#VALUE!'],
    ['number', 'Infinity', '#VALUE!'],
    ['number', '0x20', '#VALUE!'],
    ['number', '9007199254740993', '#NUM!'],
    ['number', '1e999', '#NUM!'],
    ['number', '=1+1', '#VALUE!'],
    ['currency', '1,2', '#VALUE!'],
    ['currency', '1,23,456', '#VALUE!'],
    ['currency', '($-1)', '#VALUE!'],
    ['currency', 'USD NaN', '#VALUE!'],
    ['currency', '--1', '#VALUE!'],
    ['percentage', 'abc%', '#VALUE!'],
    ['percentage', '2%%', '#VALUE!'],
    ['percentage', 'false', '#VALUE!'],
    ['boolean', '0', '#VALUE!'],
    ['boolean', '1', '#VALUE!'],
    ['boolean', 'yes', '#VALUE!'],
    ['date', '03/04/2024', '#VALUE!'],
    ['date', '2023-02-29', '#VALUE!'],
    ['date', '2024-04-31', '#VALUE!'],
    ['date', '1899-12-31', '#VALUE!'],
    ['time', '24:00', '#VALUE!'],
    ['time', '12:60', '#VALUE!'],
    ['time', '12:30:60', '#VALUE!'],
    ['time', '0:30 PM', '#VALUE!'],
    ['time', '13:30 PM', '#VALUE!'],
    ['time', '-1:30', '#VALUE!'],
  ];
  for (const [type, input, code] of invalid)
    it(`${type} rejects ${JSON.stringify(input)} with ${code}`, () => {
      const value = parseCellInput(input, type);
      expect(value).toMatchObject({ error: code });
      expect(value).not.toBe(0);
    });
  it('formats common edited values without accidental re-interpretation', () => {
    expect(formatCellInput(0.29, 'percentage')).toBe('29%');
    expect(parseCellInput(formatCellInput(-0.025, 'percentage'), 'percentage')).toBe(-0.025);
    expect(formatCellInput(false, 'boolean')).toBe('FALSE');
    expect(formatCellInput(45292, 'date')).toBe('2024-01-01');
    expect(formatCellInput(0.5625, 'time')).toBe('13:30:00');
    expect(formatCellInput((1 + 1.25 / 60) / 24, 'time')).toBe('01:01:15');
  });
  it('typed time edits feed clock calculation functions', () => {
    const time = parseCellInput('1:02:03 PM', 'time');
    const functions = Object.fromEntries(baseFunctions.map((f) => [f.name, f]));
    expect(functions.HOUR.calculate({ date: time }, {})).toBe(13);
    expect(functions.MINUTE.calculate({ date: time }, {})).toBe(2);
    expect(functions.SECOND.calculate({ date: time }, {})).toBe(3);
    expect(functions.TIMEVALUE.calculate({ text: time }, {})).toBeCloseTo(
      (13 * 3600 + 2 * 60 + 3) / 86400,
      12,
    );
  });
  it('format preserves blanks, empty text, IDs, and errors', () => {
    expect(formatCellInput(null, 'text')).toBe('');
    expect(formatCellInput('', 'text')).toBe('');
    expect(formatCellInput('00123', 'text')).toBe('00123');
    expect(formatCellInput({ error: '#NUM!' }, 'number')).toBe('#NUM!');
  });
});

describe('formula-free comparison bindings', () => {
  const comparisons: [any, any, string, any][] = [
    [3, 2, '>', true],
    [-3, -2, '>', false],
    [-3, -2, '<', true],
    [0, 0, '>=', true],
    [0, 0, '<=', true],
    [3, 3, '=', true],
    [3, 2, '<>', true],
    [true, false, '>', true],
    [false, false, '=', true],
    [true, 1, '=', false],
    [false, 0, '=', false],
    ['TRUE', true, '=', false],
    ['Ali', 'ali', '=', true],
    ['00123', 123, '=', false],
    ['123', 123, '=', false],
    ['00123', '123', '=', false],
    ['A', 'b', '<', true],
    [null, 0, '=', true],
    [null, '', '=', true],
    [null, false, '=', true],
    [null, null, '=', true],
    ['', 0, '=', false],
    ['North zone', 'ZONE', 'contains', true],
    ['North zone', 'nOr', 'starts with', true],
    ['North zone', 'ZONE', 'ends with', true],
    ['00123', '123', 'contains', true],
    [[10, 20, 30], 20, '>=', [false, true, true]],
    [20, [10, 20, 30], '>', [true, false, false]],
    [[1, 2], [1, 3], '=', [true, false]],
    [[[1], [2]], 1, '>', [false, true]],
    [[[1, 2]], 2, '=', [false, true]],
    [[], 1, '=', []],
    [[], [], '=', []],
    [false, true, 'lt', true],
    [-1, -2, 'gt', true],
    ['a', 'A', '==', true],
    ['a', 'b', '!=', true],
  ];
  for (const [left, right, op, expected] of comparisons)
    it(`${JSON.stringify(left)} ${op} ${JSON.stringify(right)}`, () =>
      expect(compareInputs(left, right, op)).toEqual(expected));
  it('preserves cell errors at their original rows', () => {
    const error = { error: '#N/A', message: 'Missing employee' };
    expect(compareInputs([1, error, 3], 2, '>')).toEqual([false, error, true]);
    expect(compareInputs(error, 1, '=')).toBe(error);
    expect(compareInputs(1, [error, 2], '<')).toEqual([error, true]);
  });
  it('classifies invalid finite-number and object inputs without hiding valid rows', () => {
    expect(compareInputs([Infinity, 2, { foo: 'bar' }], 1, '>')).toEqual([
      { error: '#NUM!', message: expect.any(String) },
      true,
      { error: '#VALUE!', message: expect.any(String) },
    ]);
    expect(compareInputs(1, '1', 'contains')).toMatchObject({ error: '#VALUE!' });
  });
  it('requires equally sized selected columns', () =>
    expect(() => compareInputs([1, 2], [1], '=')).toThrow(CalcError));
  it('rejects a nonvector matrix', () =>
    expect(() =>
      compareInputs(
        [
          [1, 2],
          [3, 4],
        ],
        1,
        '=',
      ),
    ).toThrow(CalcError));
  it('rejects ragged ranges', () =>
    expect(() => compareInputs([[1], 2], 1, '=')).toThrow(CalcError));
  it('rejects unsupported operators before calculating', () =>
    expect(() => compareInputs([1], 2, 'execute')).toThrow(CalcError));
});
