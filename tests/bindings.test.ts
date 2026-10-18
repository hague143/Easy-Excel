import { describe, expect, it } from 'vitest';
import {
  colIndex,
  colLetter,
  operationOrder,
  parseLiteral,
  parseScalar,
  resolveBindings,
} from '../src/engine/bindings';
import { CalcError, type Workbook, type CalculationResult, type Sheet } from '../src/engine/types';

const sheet: Sheet = {
  id: 's1',
  name: 'Employees',
  columns: [
    { id: 'ids', name: 'ID', type: 'text' },
    { id: 'hours', name: 'Hours', type: 'number' },
    { id: 'paid', name: 'Paid', type: 'boolean' },
  ],
  rows: [
    ['001', 0, false],
    ['002', null, true],
    ['100000000000000001', 35, null],
  ],
};
const workbook: Workbook = { id: 'w1', name: 'Test', sheets: [sheet] };
const result: CalculationResult = {
  id: 'r1',
  functionName: 'SUM',
  taskName: 'Sum',
  value: 35,
  args: {},
  timestamp: '2024-01-01T00:00:00Z',
  warnings: [],
  duration: 1,
};

describe('formula-free input bindings and literal preservation', () => {
  it('distinguishes blanks, zero, false, text identifiers and cell errors', () => {
    expect(parseScalar('')).toBe(null);
    expect(parseScalar('0')).toBe(0);
    expect(parseScalar('false')).toBe(false);
    expect(parseScalar('001')).toBe('001');
    expect(parseScalar('123456789012345678')).toBe('123456789012345678');
    expect(parseScalar('#N/A')).toEqual({ error: '#N/A' });
    expect(parseScalar('  ')).toBe('  ');
    expect(parseLiteral('[null,"",0,"001",false]')).toEqual([null, '', 0, '001', false]);
  });
  it('never accepts a nonfinite number as valid numeric input', () => {
    const value = parseScalar('1e309');
    expect(typeof value !== 'number' || Number.isFinite(value)).toBe(true);
  });
  it('preserves pasted trailing blank cells in a rectangular table', () => {
    expect(parseLiteral('001\t0\t\n002\tfalse\t')).toEqual([
      ['001', 0, null],
      ['002', false, null],
    ]);
    expect(parseLiteral('001\t0\t\n')).toEqual([['001', 0, null]]);
  });
  it('supports structured matrices and comma-separated values without interpreting code', () => {
    expect(parseLiteral('[[1,2],[3,4]]')).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(parseLiteral('001,2,true')).toEqual(['001', 2, true]);
    expect(parseLiteral('globalThis.alert(1)')).toBe('globalThis.alert(1)');
    expect(() => parseLiteral('[[1,2]')).toThrow(CalcError);
  });
  it('round-trips Excel column names including columns beyond Z', () => {
    for (const [index, label] of [
      [0, 'A'],
      [25, 'Z'],
      [26, 'AA'],
      [701, 'ZZ'],
      [702, 'AAA'],
      [16383, 'XFD'],
    ] as const) {
      expect(colLetter(index)).toBe(label);
      expect(colIndex(label)).toBe(index);
      expect(colIndex(label.toLowerCase())).toBe(index);
    }
  });
  it('binds columns by stable IDs preserving zero, false and null', () => {
    expect(
      resolveBindings({ __source: 'column', sheetId: 's1', columnId: 'ids' }, workbook, []),
    ).toEqual(['001', '002', '100000000000000001']);
    expect(
      resolveBindings({ __source: 'column', sheetId: 's1', columnId: 'hours' }, workbook, []),
    ).toEqual([0, null, 35]);
    expect(
      resolveBindings({ __source: 'column', sheetId: 's1', columnId: 'paid' }, workbook, []),
    ).toEqual([false, true, null]);
    const rearranged = {
      ...workbook,
      sheets: [
        {
          ...sheet,
          columns: [sheet.columns[1], sheet.columns[0], sheet.columns[2]],
          rows: sheet.rows.map((r) => [r[1], r[0], r[2]]),
        },
      ],
    };
    expect(
      resolveBindings({ __source: 'column', sheetId: 's1', columnId: 'ids' }, rearranged, []),
    ).toEqual(['001', '002', '100000000000000001']);
  });
  it('binds workbook ranges with row 1 explicitly representing headers', () => {
    expect(
      resolveBindings({ __source: 'range', sheetId: 's1', range: '$A$1:$C$2' }, workbook, []),
    ).toEqual([
      ['ID', 'Hours', 'Paid'],
      ['001', 0, false],
    ]);
    expect(
      resolveBindings({ __source: 'range', sheetId: 's1', range: 'a2:a3' }, workbook, []),
    ).toEqual([['001'], ['002']]);
    expect(
      resolveBindings({ __source: 'range', sheetId: 's1', range: 'B2' }, workbook, []),
    ).toEqual([[0]]);
  });
  it('rejects missing sources, row zero, reversed and out-of-bounds ranges', () => {
    const bindings = [
      { __source: 'column', sheetId: 'missing', columnId: 'ids' },
      { __source: 'column', sheetId: 's1', columnId: 'missing' },
      ...['A0', 'A0:A2', 'A3:A2', 'B1:A1', 'A1:D2', 'A1:A5', 'nonsense'].map((range) => ({
        __source: 'range',
        sheetId: 's1',
        range,
      })),
    ];
    bindings.forEach((binding) =>
      expect(() => resolveBindings(binding, workbook, []), JSON.stringify(binding)).toThrow(
        CalcError,
      ),
    );
  });
  it('can use whole tables, previous results and nested inputs', () => {
    expect(
      resolveBindings({ __source: 'table', sheetId: 's1', headers: false }, workbook, []),
    ).toEqual(sheet.rows);
    expect(
      resolveBindings({ __source: 'table', sheetId: 's1', headers: true }, workbook, [result])[0],
    ).toEqual(['ID', 'Hours', 'Paid']);
    expect(
      resolveBindings(
        { x: { __source: 'result', resultId: 'r1' }, y: [{ __source: 'literal', text: '001' }] },
        workbook,
        [result],
      ),
    ).toEqual({ x: 35, y: ['001'] });
    expect(() =>
      resolveBindings({ __source: 'result', resultId: 'missing' }, workbook, []),
    ).toThrow(/previous result/);
  });
});

describe('multi-step pipeline dependencies', () => {
  const operation = (id: string, dependsOn: string[] = []) => ({
    id,
    dependsOn,
    name: id,
    functionName: 'SUM',
    args: {},
  });
  it('orders dependencies before consumers, preserving every independent task once', () => {
    expect(
      operationOrder([
        operation('summary', ['clean', 'match']),
        operation('match', ['clean']),
        operation('clean'),
        operation('extra'),
      ]).map((o) => o.id),
    ).toEqual(['clean', 'match', 'summary', 'extra']);
  });
  it('rejects circular dependencies and missing predecessors', () => {
    expect(() => operationOrder([operation('a', ['b']), operation('b', ['a'])])).toThrow(
      /Circular/,
    );
    expect(() => operationOrder([operation('self', ['self'])])).toThrow(/Circular/);
    expect(() => operationOrder([operation('a', ['missing'])])).toThrow(/Missing pipeline/);
  });
  it('rejects duplicate operation IDs instead of silently losing a calculation', () =>
    expect(() => operationOrder([operation('a'), operation('a')])).toThrow(CalcError));
});
