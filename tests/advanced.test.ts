import { describe, expect, it } from 'vitest';
import { advancedFunctions, demoProvider } from '../src/engine/advanced';
import { evaluateOperation, matchesCriterion } from '../src/engine/advanced-helpers';
import { CalcError, type CalcContext } from '../src/engine/types';

const run = (name: string, args: Record<string, any>, context: CalcContext = {}) => {
  const fn = advancedFunctions.find((f) => f.name === name)!;
  return fn.calculate({ ...fn.defaults, ...args }, context);
};
const fails = (
  name: string,
  args: Record<string, any>,
  code: string,
  context: CalcContext = {},
) => {
  try {
    run(name, args, context);
    throw new Error('Expected a spreadsheet error');
  } catch (error) {
    expect(error).toBeInstanceOf(CalcError);
    expect((error as CalcError).code).toBe(code);
  }
};
const context: CalcContext = {
  sheetId: 'staff',
  workbook: {
    id: 'book',
    name: 'Employees',
    sheets: [
      {
        id: 'staff',
        name: "People's salaries",
        columns: [
          { id: 'id', name: 'ID', type: 'text' },
          { id: 'pay', name: 'Pay', type: 'number' },
        ],
        rows: [
          ['001', 100],
          ['002', 200],
          ['003', 300],
        ],
      },
    ],
  },
};
const db = [
  ['Team', 'Pay', 'Name'],
  ['HR', 100, 'Ali'],
  ['IT', 200, 'Bina'],
  ['HR', 300, 'Chen'],
  ['HR', null, 'Dina'],
];
const v = (name: string) => ({ op: 'variable', name });
const c = (value: any) => ({ op: 'value', value });

describe('Advanced catalogue independent expected examples', () => {
  for (const fn of advancedFunctions)
    it(fn.name, () => {
      const result = fn.calculate({ ...fn.defaults, ...fn.example.args }, fn.example.context || {});
      if (typeof fn.example.expected === 'number')
        expect(result).toBeCloseTo(fn.example.expected, 10);
      else expect(result).toEqual(fn.example.expected);
    });
  it('contains every required advanced function exactly once', () => {
    const names =
      'XLOOKUP VLOOKUP HLOOKUP LOOKUP INDEX MATCH XMATCH CHOOSE INDIRECT ADDRESS ROW COLUMN ROWS COLUMNS OFFSET FILTER SORT SORTBY UNIQUE SEQUENCE TRANSPOSE TAKE DROP CHOOSECOLS CHOOSEROWS VSTACK HSTACK TOCOL TOROW EXPAND WRAPROWS WRAPCOLS LET LAMBDA MAP BYROW BYCOL REDUCE SCAN MAKEARRAY DSUM DAVERAGE DCOUNT DCOUNTA DMAX DMIN DGET DPRODUCT DSTDEV DVAR GETPIVOTDATA CUBEVALUE CUBEMEMBER'.split(
        ' ',
      );
    expect(advancedFunctions.map((f) => f.name).sort()).toEqual(names.sort());
    for (const fn of advancedFunctions) {
      expect(fn.inputs.length).toBeGreaterThan(0);
      expect(fn.testRefs).toContain(`tests/advanced.test.ts > ${fn.name}`);
    }
  });
});

describe('Lookup matching and error policies', () => {
  it('XLOOKUP respects duplicate and missing policies', () => {
    const args = { value: '001', lookup: ['001', '002', '001'], returns: [10, 20, 30] };
    expect(run('XLOOKUP', { ...args, duplicates: 'all' })).toEqual([[10], [30]]);
    expect(run('XLOOKUP', { ...args, duplicates: 'last' })).toBe(30);
    fails('XLOOKUP', { ...args, duplicates: 'error' }, '#N/A');
    expect(run('XLOOKUP', { ...args, value: '404', missing: 'blank' })).toBeNull();
    expect(
      run('XLOOKUP', { ...args, value: '404', missing: 'custom', ifNotFound: 'Missing' }),
    ).toBe('Missing');
    fails('XLOOKUP', { ...args, value: '404' }, '#N/A');
  });
  it('XLOOKUP returns a horizontal selected column and multiple matching columns', () => {
    expect(
      run('XLOOKUP', {
        value: 'B',
        lookup: [['A', 'B', 'B']],
        returns: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        duplicates: 'all',
      }),
    ).toEqual([
      [2, 3],
      [5, 6],
    ]);
    fails('XLOOKUP', { value: 1, lookup: [1, 2], returns: [10] }, '#VALUE!');
  });
  it('XLOOKUP exact next smaller and next larger differ', () => {
    const args = { value: 25, lookup: [30, 10, 20], returns: ['C', 'A', 'B'] };
    expect(run('XLOOKUP', { ...args, matchMode: -1 })).toBe('B');
    expect(run('XLOOKUP', { ...args, matchMode: 1 })).toBe('C');
    fails('XLOOKUP', { ...args, searchMode: 2 }, '#N/A');
  });
  it('XMATCH handles escaped wildcards, reverse search and invalid modes', () => {
    expect(run('XMATCH', { value: 'A~*', lookup: ['Ab', 'A*', 'A?'], matchMode: 2 })).toBe(2);
    expect(run('XMATCH', { value: 'A', lookup: ['a', 'b', 'A'], searchMode: -1 })).toBe(3);
    fails('XMATCH', { value: 5, lookup: [1, 2], matchMode: 3 }, '#VALUE!');
    fails('XMATCH', { value: 5, lookup: [1, 2], searchMode: 0 }, '#VALUE!');
  });
  it('VLOOKUP and HLOOKUP enforce sorted approximate keys and valid return index', () => {
    fails(
      'VLOOKUP',
      {
        value: 5,
        table: [
          [10, 20],
          [0, 50],
        ],
      },
      '#N/A',
    );
    fails('VLOOKUP', { value: 10, table: [[10, 20]], index: 3 }, '#REF!');
    fails(
      'HLOOKUP',
      {
        value: 'A',
        table: [
          ['A', 'B'],
          [1, 2],
        ],
        index: 0,
      },
      '#REF!',
    );
    expect(
      run('VLOOKUP', {
        value: 'a*',
        table: [
          ['Alan', 10],
          ['Bina', 20],
        ],
        approximate: false,
      }),
    ).toBe(10);
    fails(
      'HLOOKUP',
      {
        value: 'Z',
        table: [
          ['A', 'B'],
          [1, 2],
        ],
        approximate: false,
      },
      '#N/A',
    );
    fails('VLOOKUP', { value: '10', table: [[10, 'Number']], approximate: false }, '#N/A');
    expect(run('VLOOKUP', { value: 10, table: [[10, 'Number']], approximate: false })).toBe(
      'Number',
    );
  });
  it('LOOKUP validates range size and sort order', () => {
    fails('LOOKUP', { value: 2, lookup: [2, 1], returns: [10, 20] }, '#N/A');
    fails('LOOKUP', { value: 2, lookup: [1, 2], returns: [10] }, '#VALUE!');
    fails('LOOKUP', { value: 0, lookup: [1, 2], returns: [10, 20] }, '#N/A');
  });
  it('MATCH supports descending approximate keys', () => {
    expect(run('MATCH', { value: 25, lookup: [40, 30, 20, 10], matchType: -1 })).toBe(2);
    fails('MATCH', { value: 25, lookup: [10, 20, 30], matchType: -1 }, '#N/A');
    fails('MATCH', { value: 'Z', lookup: ['A', 'B'], matchType: 0 }, '#N/A');
    fails('MATCH', { value: '*', lookup: [10, 20], matchType: 0 }, '#N/A');
  });
  it('INDEX supports full row/column selection and bounds', () => {
    expect(
      run('INDEX', {
        data: [
          [1, 2],
          [3, 4],
        ],
        row: 0,
        column: 2,
      }),
    ).toEqual([[2], [4]]);
    expect(
      run('INDEX', {
        data: [
          [1, 2],
          [3, 4],
        ],
        row: 2,
        column: 0,
      }),
    ).toEqual([[3, 4]]);
    fails('INDEX', { data: [[1]], row: 2 }, '#REF!');
    fails('CHOOSE', { values: ['a', 'b'], index: 0 }, '#VALUE!');
  });
});

describe('Real workbook addresses', () => {
  it('INDIRECT resolves quoted sheets, headers, empty cells and relative R1C1', () => {
    expect(run('INDIRECT', { reference: "'People''s salaries'!A1:B2" }, context)).toEqual([
      ['ID', 'Pay'],
      ['001', 100],
    ]);
    expect(
      run(
        'INDIRECT',
        { reference: 'R[1]C[-1]', style: 'R1C1', anchorRow: 2, anchorColumn: 2 },
        context,
      ),
    ).toBe('002');
    expect(run('INDIRECT', { reference: 'C10' }, context)).toBeNull();
    fails('INDIRECT', { reference: 'A0' }, '#REF!', context);
    fails('INDIRECT', { reference: 'Missing!A1' }, '#REF!', context);
    fails('INDIRECT', { reference: 'A1' }, '#REF!');
  });
  it('ADDRESS supports R1C1 relative and Excel maximum bounds', () => {
    expect(run('ADDRESS', { row: 5, column: 3, absNum: 4, a1: false })).toBe('R[5]C[3]');
    expect(run('ADDRESS', { row: 1048576, column: 16384 })).toBe('$XFD$1048576');
    fails('ADDRESS', { row: 1, column: 16385 }, '#VALUE!');
    fails('ADDRESS', { row: 0, column: 1 }, '#VALUE!');
  });
  it('ROW and COLUMN report complete selected coordinates', () => {
    expect(run('ROW', { reference: 'A2:B4' }, context)).toEqual([[2], [3], [4]]);
    expect(run('COLUMN', { reference: 'B2:D3' }, context)).toEqual([[2, 3, 4]]);
    fails('ROW', { reference: 'A1048577' }, '#REF!', context);
    fails('COLUMN', { reference: 'XFE1' }, '#REF!', context);
  });
  it('OFFSET shifts stored cell references and prevents out of bounds', () => {
    expect(run('OFFSET', { reference: 'A2:B3', rows: 1 }, context)).toEqual([
      ['002', 200],
      ['003', 300],
    ]);
    fails('OFFSET', { reference: 'A1', rows: -1 }, '#REF!', context);
    fails('OFFSET', { reference: 'A1', height: 0 }, '#REF!', context);
    fails('ROWS', { data: [[1], [2, 3]] }, '#VALUE!');
    fails('COLUMNS', { data: [] }, '#VALUE!');
  });
});

describe('Dynamic array dimensions and errors', () => {
  it('FILTER can filter columns and detect empty or misaligned includes', () => {
    expect(
      run('FILTER', {
        data: [
          [1, 2],
          [3, 4],
        ],
        include: [[false, true]],
      }),
    ).toEqual([[2], [4]]);
    fails('FILTER', { data: [[1], [2]], include: [false, false] }, '#CALC!');
    expect(run('FILTER', { data: [[1], [2]], include: [false, false], ifEmpty: 'None' })).toBe(
      'None',
    );
    fails(
      'FILTER',
      {
        data: [
          [1, 2],
          [3, 4],
        ],
        include: [true, false, true],
      },
      '#VALUE!',
    );
    fails('FILTER', { data: [[1]], include: ['true'] }, '#VALUE!');
  });
  it('SORT supports columns and invalid sort fields', () => {
    expect(
      run('SORT', {
        data: [
          [3, 1, 2],
          ['c', 'a', 'b'],
        ],
        byCol: true,
      }),
    ).toEqual([
      [1, 2, 3],
      ['a', 'b', 'c'],
    ]);
    fails('SORT', { data: [[1, 2]], sortIndex: 3 }, '#VALUE!');
    fails('SORT', { data: [[1]], sortOrder: 0 }, '#VALUE!');
  });
  it('SORTBY handles multiple keys', () => {
    expect(run('SORTBY', { data: [['A'], ['B'], ['C']], by: [1, 1, 2], by2: [20, 10, 0] })).toEqual(
      [['B'], ['A'], ['C']],
    );
    fails('SORTBY', { data: [1, 2], by: [1] }, '#VALUE!');
  });
  it('UNIQUE compares complete columns and handles no exactly-once items', () => {
    expect(
      run('UNIQUE', {
        data: [
          [1, 1, 2],
          [3, 3, 4],
        ],
        byCol: true,
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    fails('UNIQUE', { data: [1, 1], exactlyOnce: true }, '#CALC!');
  });
  it('SEQUENCE rejects excessive or nonpositive size; TRANSPOSE rejects ragged input', () => {
    fails('SEQUENCE', { rows: 0, columns: 2 }, '#NUM!');
    fails('SEQUENCE', { rows: 10000, columns: 10000 }, '#NUM!');
    fails('TRANSPOSE', { data: [[1], [2, 3]] }, '#VALUE!');
  });
  it('TAKE and DROP support signed limits without mutating inputs', () => {
    expect(
      run('TAKE', {
        data: [
          [1, 2],
          [3, 4],
        ],
        rows: 99,
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(
      run('DROP', {
        data: [
          [1, 2],
          [3, 4],
        ],
        rows: 0,
        columns: 1,
      }),
    ).toEqual([[2], [4]]);
    fails('TAKE', { data: [1, 2], rows: 0 }, '#CALC!');
    fails('DROP', { data: [1, 2], rows: 2 }, '#CALC!');
  });
  it('CHOOSECOLS and CHOOSEROWS validate nonzero positions', () => {
    fails('CHOOSECOLS', { data: [[1, 2]], indices: [0] }, '#VALUE!');
    fails('CHOOSEROWS', { data: [[1], [2]], indices: [-3] }, '#VALUE!');
  });
  it('VSTACK and HSTACK expose padded cells as errors', () => {
    const stacked = run('VSTACK', { first: [[1, 2]], second: [[3]] });
    expect(stacked[1][0]).toBe(3);
    expect(stacked[1][1]).toMatchObject({ error: '#N/A' });
    const joined = run('HSTACK', { first: [[1], [2]], second: [[3, 4]] });
    expect(joined[1][0]).toBe(2);
    expect(joined[1][1]).toMatchObject({ error: '#N/A' });
  });
  it('TOCOL/TOROW distinguish null, empty strings and errors', () => {
    const values = [[null, '', 0, { error: '#DIV/0!' }]];
    expect(run('TOROW', { data: values, ignore: 3 })).toEqual([['', 0]]);
    expect(run('TOCOL', { data: [[null, 2]], ignore: 0 })).toEqual([[0], [2]]);
    fails('TOCOL', { data: [[null]], ignore: 1 }, '#CALC!');
    fails('TOROW', { data: [1], ignore: 4 }, '#VALUE!');
  });
  it('EXPAND and wrap validate dimensions and pad values', () => {
    fails('EXPAND', { data: [[1, 2]], rows: 2, columns: 1 }, '#VALUE!');
    fails('WRAPROWS', { data: [1, 2], wrapCount: 0 }, '#NUM!');
    fails(
      'WRAPCOLS',
      {
        data: [
          [1, 2],
          [3, 4],
        ],
        wrapCount: 2,
      },
      '#VALUE!',
    );
    expect(run('WRAPCOLS', { data: [1, 2, 3], wrapCount: 2, pad: 'x' })).toEqual([
      [1, 3],
      [2, 'x'],
    ]);
  });
});

describe('Safe reusable operation builder', () => {
  it('LET evaluates bindings in order and rejects unsafe variable names', () => {
    expect(
      run('LET', {
        bindings: [
          { name: 'base', value: c(3) },
          { name: 'double', value: { op: 'multiply', args: [v('base'), c(2)] } },
        ],
        operations: { op: 'add', args: [v('base'), v('double')] },
      }),
    ).toBe(9);
    fails(
      'LET',
      { bindings: [{ name: '__proto__', value: 1 }], operations: v('__proto__') },
      '#NAME?',
    );
    fails('LET', { bindings: [], operations: v('missing') }, '#NAME?');
  });
  it('LAMBDA executes named parameters and validates argument count', () => {
    expect(
      run('LAMBDA', {
        parameters: 'x,y',
        arguments: [7, 3],
        operations: { op: 'subtract', args: [v('x'), v('y')] },
      }),
    ).toBe(4);
    fails('LAMBDA', { parameters: 'x,y', arguments: [7] }, '#VALUE!');
    fails('LAMBDA', { parameters: 'x,x', arguments: [7, 3] }, '#VALUE!');
  });
  it('MAP takes two aligned arrays and forbids dimension mismatches', () => {
    expect(
      run('MAP', {
        data: [2, 3],
        second: [10, 20],
        parameters: 'value,other',
        operations: { op: 'multiply', args: [v('value'), v('other')] },
      }),
    ).toEqual([[20], [60]]);
    fails('MAP', { data: [2, 3], second: [10], parameters: 'value,other' }, '#VALUE!');
    fails('MAP', { data: [2], operations: { op: 'value', value: [1, 2] } }, '#CALC!');
  });
  it('BYROW and BYCOL support average operations and reject bad parameter counts', () => {
    expect(
      run('BYROW', {
        data: [
          [10, 20],
          [30, 50],
        ],
        operations: { op: 'average', args: [v('values')] },
      }),
    ).toEqual([[15], [40]]);
    expect(
      run('BYCOL', {
        data: [
          [10, 20],
          [30, 50],
        ],
        operations: { op: 'average', args: [v('values')] },
      }),
    ).toEqual([[20, 35]]);
    fails('BYROW', { data: [1, 2], parameters: 'x,y' }, '#VALUE!');
    fails('BYCOL', { data: [1, 2], operations: { op: 'value', value: [1] } }, '#CALC!');
  });
  it('REDUCE and SCAN accumulate multiplication with an explicit initial value', () => {
    const args = {
      data: [[2, 3, 4]],
      initial: 1,
      operations: { op: 'multiply', args: [v('accumulator'), v('value')] },
    };
    expect(run('REDUCE', args)).toBe(24);
    expect(run('SCAN', args)).toEqual([[2, 6, 24]]);
    fails('REDUCE', { ...args, parameters: 'x' }, '#VALUE!');
    fails('SCAN', { ...args, operations: { op: 'divide', args: [c(1), c(0)] } }, '#DIV/0!');
  });
  it('MAKEARRAY receives 1-based row and column positions', () => {
    expect(
      run('MAKEARRAY', {
        rows: 2,
        columns: 2,
        operations: { op: 'add', args: [{ op: 'multiply', args: [v('row'), c(10)] }, v('column')] },
      }),
    ).toEqual([
      [11, 12],
      [21, 22],
    ]);
    fails('MAKEARRAY', { rows: -1, columns: 2 }, '#NUM!');
  });
  it('rejects JavaScript operations and evaluates condition branches lazily', () => {
    expect(() => evaluateOperation({ op: 'eval', value: 'globalThis' })).toThrow(CalcError);
    expect(
      evaluateOperation({ op: 'if', args: [c(true), c(42), { op: 'divide', args: [c(1), c(0)] }] }),
    ).toBe(42);
  });
  it('preserves valid mapped values when an individual operation fails', () => {
    const mapped = run('MAP', {
      data: [2, 0, 4],
      operations: { op: 'divide', args: [c(8), v('value')] },
    });
    expect(mapped[0][0]).toBe(4);
    expect(mapped[1][0]).toMatchObject({ error: '#DIV/0!' });
    expect(mapped[2][0]).toBe(2);
    const rows = run('BYROW', {
      data: [
        [1, 2],
        [3, { error: '#N/A' }],
      ],
    });
    expect(rows[0][0]).toBe(3);
    expect(rows[1][0]).toMatchObject({ error: '#N/A' });
  });
});

describe('Database criteria and sample statistics', () => {
  it('DSUM supports OR criteria rows and AND criteria columns', () => {
    expect(
      run('DSUM', {
        database: db,
        field: 'Pay',
        criteria: [
          ['Team', 'Pay'],
          ['HR', '>100'],
          ['IT', '>100'],
        ],
      }),
    ).toBe(500);
    expect(
      run('DSUM', {
        database: db,
        field: 2,
        criteria: [
          ['Pay', 'Pay'],
          ['>=100', '<=200'],
        ],
      }),
    ).toBe(300);
    expect(matchesCriterion('A*', '=A~*', true)).toBe(true);
  });
  it('DAVERAGE, DSTDEV and DVAR reject insufficient numeric observations', () => {
    for (const name of ['DAVERAGE', 'DSTDEV', 'DVAR'])
      fails(name, { database: db, field: 'Pay', criteria: [['Name'], ['Dina']] }, '#DIV/0!');
    for (const name of ['DSTDEV', 'DVAR'])
      fails(name, { database: db, field: 'Pay', criteria: [['Team'], ['IT']] }, '#DIV/0!');
  });
  it('DCOUNT excludes text and blanks while DCOUNTA counts text', () => {
    expect(run('DCOUNT', { database: db, field: 'Name', criteria: [] })).toBe(0);
    expect(run('DCOUNTA', { database: db, field: 'Name', criteria: [] })).toBe(4);
    expect(run('DMAX', { database: db, field: 'Pay', criteria: [['Team'], ['ZZZ']] })).toBe(0);
    expect(run('DMIN', { database: db, field: 'Pay', criteria: [['Team'], ['ZZZ']] })).toBe(0);
    expect(run('DPRODUCT', { database: db, field: 'Pay', criteria: [['Team'], ['ZZZ']] })).toBe(0);
  });
  it('DGET distinguishes no match from multiple matches', () => {
    fails('DGET', { database: db, field: 'Pay', criteria: [['Team'], ['HR']] }, '#NUM!');
    fails('DGET', { database: db, field: 'Pay', criteria: [['Team'], ['ZZZ']] }, '#VALUE!');
  });
  it('validates unknown fields and criterion headers for every database function', () => {
    for (const name of [
      'DSUM',
      'DAVERAGE',
      'DCOUNT',
      'DCOUNTA',
      'DMAX',
      'DMIN',
      'DGET',
      'DPRODUCT',
      'DSTDEV',
      'DVAR',
    ]) {
      fails(name, { database: db, field: 'Missing', criteria: [] }, '#VALUE!');
      fails(name, { database: db, field: 'Pay', criteria: [['Unknown'], [1]] }, '#VALUE!');
    }
  });
});

describe('Local pivot summaries and explicit analytical providers', () => {
  it('GETPIVOTDATA computes sum and count with local field filters', () => {
    expect(
      run('GETPIVOTDATA', {
        database: db,
        field: 'Pay',
        filters: [
          { column: 'Team', value: 'HR' },
          { column: 'Pay', operator: '>', value: 150 },
        ],
      }),
    ).toBe(300);
    expect(
      run('GETPIVOTDATA', { database: db, field: 'Name', aggregation: 'counta', filters: [] }),
    ).toBe(4);
    fails(
      'GETPIVOTDATA',
      { database: db, field: 'Pay', filters: [{ column: 'Team', value: 'ZZZ' }] },
      '#REF!',
    );
  });
  it('never invents a value when cube connections or members are missing', () => {
    fails('CUBEVALUE', { connection: 'demo', measure: 'Sales' }, '#CONNECT!');
    fails('CUBEMEMBER', { connection: 'demo', dimension: 'Region' }, '#CONNECT!');
    const models = { providers: { demo: demoProvider } };
    expect(demoProvider.demo).toBe(true);
    expect(
      run(
        'CUBEVALUE',
        { connection: 'demo', measure: 'Units', filters: { Region: 'South', Product: 'Pens' } },
        models,
      ),
    ).toBe(125);
    expect(run('CUBEMEMBER', { connection: 'demo', dimension: 'Region' }, models)).toEqual([
      ['North'],
      ['South'],
    ]);
    fails('CUBEVALUE', { connection: 'demo', measure: 'Missing' }, '#N/A', models);
    fails(
      'CUBEMEMBER',
      { connection: 'demo', dimension: 'Region', member: 'West' },
      '#N/A',
      models,
    );
    fails(
      'CUBEVALUE',
      { connection: 'demo', measure: 'Sales', filters: { Region: 'West' } },
      '#N/A',
      models,
    );
  });
});
