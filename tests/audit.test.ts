import { describe, expect, it } from 'vitest';
import references from './fixtures/audit-reference.json';
import { execute, functions } from '../src/engine/registry';
import { evaluateOperation } from '../src/engine/advanced-helpers';

function compare(actual: any, expected: any, rtol: number, atol: number) {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBe(expected.length);
    expected.forEach((v, i) => compare(actual[i], v, rtol, atol));
  } else {
    expect(actual).toBeTypeOf('number');
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
      Math.max(atol, rtol * Math.abs(expected)),
    );
  }
}
function freeze(value: any): any {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function clone(value: any): any {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  return value;
}
describe('independent numerical audit references', () => {
  for (const [i, entry] of references.cases.entries()) {
    it(`${entry.name} reference ${i + 1}`, () =>
      compare(execute(entry.name, entry.args).value, entry.expected, entry.rtol, entry.atol));
  }
});
describe('all registered formulas and workflows preserve their source inputs', () => {
  for (const def of functions)
    it(`${def.name} accepts frozen input data`, () => {
      const args = freeze(structuredClone(def.example.args));
      const context = freeze(clone(def.example.context ?? {}));
      const result = execute(def.name, args, context).value;
      // Each execution must preserve every caller-owned value and finish normally.
      expect(args).toEqual(def.example.args);
      expect(context).toEqual(def.example.context ?? {});
      if (!def.example.expected?.error) expect(result?.error).toBeUndefined();
      expect(result).not.toBeUndefined();
    });
});
const upstream = { error: '#N/A', message: 'Source value is missing.' };
describe('numeric inputs preserve original spreadsheet errors', () => {
  for (const def of functions)
    for (const input of def.inputs.filter((i) => i.type === 'number' && i.required)) {
      it(`${def.name} / ${input.key} preserves #N/A`, () => {
        const args = { ...structuredClone(def.example.args), [input.key]: upstream };
        const value = execute(def.name, args, def.example.context ?? {}).value;
        // REDUCE/SCAN expose the initial error through the first accumulated cell.
        const cell = def.name === 'SCAN' ? (value?.[0]?.[0] ?? value) : value;
        expect(cell?.error).toBe('#N/A');
      });
    }
});
describe('additional boundary and reusable-operation regressions', () => {
  it.each([
    ['SUMSQ', { data: [] }, 0],
    ['SUMSQ', { data: [null, '', 'text', true] }, 0],
    ['FREQUENCY', { data: [], bins: [10, 20] }, [0, 0, 0]],
    ['FREQUENCY', { data: [1, 2, 3], bins: [] }, [3]],
    ['FREQUENCY', { data: [], bins: [] }, [0]],
    ['Z.TEST', { data: [10], x: 10, sigma: 2 }, 0.5],
    ['TEXT', { value: 0.125, format: '0.0"%"' }, '0.1%'],
    ['TEXT', { value: 12.5, format: '"Invoice 000: "0.00' }, 'Invoice 000: 12.50'],
    ['TEXT', { value: -12.5, format: '0.0;"Loss; "0.0' }, 'Loss; 12.5'],
    ['TEXT', { value: 1234, format: '"USD "0.00E+00' }, 'USD 1.23E+03'],
    ['TEXT', { value: 1.005, format: '0.00E+00' }, '1.01E+00'],
    ['TEXT', { value: 0.125, format: '0.0\\%' }, '0.1%'],
  ] as [string, Record<string, any>, any][])('%s handles %j', (name, args, expected) =>
    expect(execute(name, args).value).toEqual(expected),
  );
  it.each([
    ['COMBIN', { number: -0.1, chosen: 0 }, '#NUM!'],
    ['PERMUT', { number: 2, chosen: -0.1 }, '#NUM!'],
    ['MEDIAN', { data: [] }, '#NUM!'],
    ['MODE.SNGL', { data: [] }, '#N/A'],
    ['MODE.MULT', { data: [] }, '#N/A'],
    ['TEXT', { value: 1, format: '0.00"unfinished' }, '#VALUE!'],
    ['DATEVALUE', { text: upstream }, '#N/A'],
    ['DATEVALUE', { text: '12:30' }, '#VALUE!'],
    ['XNPV', { rate: 0.1, values: [-100, 110], dates: [-1, 365] }, '#NUM!'],
    ['XNPV', { rate: 0.1, values: [-100, 110], dates: ['2024-01-01', upstream] }, '#N/A'],
    ['NETWORKDAYS.INTL', { start: '2024-01-01', end: '2024-01-05', weekend: upstream }, '#N/A'],
    ['MMULT', { matrix1: [[upstream]], matrix2: [[1]] }, '#N/A'],
    ['LINEST', { y: [1, upstream, 3], x: [1, 2, 3] }, '#N/A'],
  ] as [string, Record<string, any>, string][])(
    '%s rejects %j with the correct error',
    (name, args, code) => expect(execute(name, args).value.error).toBe(code),
  );
  it('treats an explicit FALSE distribution setting as false', () => {
    expect(execute('NORM.DIST', { x: 0, mean: 0, sd: 1, cumulative: 'FALSE' }).value).toBeCloseTo(
      0.3989422804014327,
      14,
    );
  });
  it('rounds reusable MAP operations like decimal ROUND, including negative midpoints', () => {
    expect(
      execute('MAP', {
        data: [1.005, -1.005, 2.675],
        operations: {
          op: 'round',
          args: [
            { op: 'variable', name: 'value' },
            { op: 'value', value: 2 },
          ],
        },
      }).value,
    ).toEqual([[1.01], [-1.01], [2.68]]);
  });
  it('IFERROR handles an error supplied as a value as well as one thrown by arithmetic', () => {
    expect(
      evaluateOperation({
        op: 'iferror',
        args: [
          { op: 'value', value: upstream },
          { op: 'value', value: 'Missing' },
        ],
      }),
    ).toBe('Missing');
    expect(
      evaluateOperation({
        op: 'iferror',
        args: [
          { op: 'divide', args: [1, 0] },
          { op: 'value', value: 'Missing' },
        ],
      }),
    ).toBe('Missing');
  });
  it('IF propagates an erroneous condition and evaluates only the selected branch', () => {
    expect(() =>
      evaluateOperation({ op: 'if', args: [{ op: 'value', value: upstream }, 1, 2] }),
    ).toThrow('Source value is missing.');
    expect(evaluateOperation({ op: 'if', args: [false, { op: 'divide', args: [1, 0] }, 2] })).toBe(
      2,
    );
    expect(evaluateOperation({ op: 'if', args: ['FALSE', 1, 2] })).toBe(2);
  });
  it('logical reusable operations interpret booleans rather than JavaScript truthiness', () => {
    expect(evaluateOperation({ op: 'not', args: ['FALSE'] })).toBe(true);
    expect(evaluateOperation({ op: 'and', args: [true, 'FALSE'] })).toBe(false);
    expect(evaluateOperation({ op: 'or', args: [false, 'FALSE'] })).toBe(false);
  });
});

describe('visible summaries apply worksheet metadata to each row and column of a block', () => {
  const sheet = {
    id: 'visibility',
    name: 'Visibility',
    columns: ['ID', 'First amount', 'Second amount'].map((name, i) => ({
      id: `c${i}`,
      name,
      type: 'number' as const,
    })),
    rows: [
      [1, 10, 20],
      [2, 30, 40],
    ],
    hiddenRows: [] as number[],
    filteredRows: [] as number[],
    formulae: {} as Record<string, string>,
  };
  const args = {
    data: [
      [10, 20],
      [30, 40],
    ],
    startRow: 2,
    column: 'B',
  };
  const context = (changes: Partial<typeof sheet>) => ({
    workbook: {
      id: 'visibility-book',
      name: 'Visibility audit',
      sheets: [{ ...sheet, ...changes }],
    },
    sheetId: sheet.id,
  });
  for (const name of ['SUBTOTAL', 'AGGREGATE']) {
    const settings = { functionNum: name === 'SUBTOTAL' ? 109 : 9, options: 1 };
    it(`${name} excludes every selected cell in a hidden row`, () => {
      expect(execute(name, { ...args, ...settings }, context({ hiddenRows: [0] })).value).toBe(70);
    });
    it(`${name} excludes every selected cell in a filtered row`, () => {
      expect(execute(name, { ...args, ...settings }, context({ filteredRows: [1] })).value).toBe(
        30,
      );
    });
    it(`${name} recognizes nested summaries in each selected column`, () => {
      expect(
        execute(
          name,
          { ...args, ...settings },
          context({ formulae: { $B$2: 'SUBTOTAL(9,B4:B5)', C3: '=AGGREGATE(9,0,C4:C5)' } }),
        ).value,
      ).toBe(50);
    });
    it(`${name} treats a horizontal selection as one worksheet row`, () => {
      expect(
        execute(name, { ...args, ...settings, data: [[10, 20]] }, context({ hiddenRows: [0] }))
          .value,
      ).toBe(0);
    });
  }
  it('AGGREGATE option 4 retains hidden rows and nested values', () => {
    expect(
      execute(
        'AGGREGATE',
        { ...args, functionNum: 9, options: 4 },
        context({ hiddenRows: [0], formulae: { B2: 'SUBTOTAL(9,B4:B5)' } }),
      ).value,
    ).toBe(100);
  });
});
