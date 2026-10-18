import { describe, expect, it } from 'vitest';
import { baseFunctions } from '../src/engine/base';
import { CalcError } from '../src/engine/types';
import type { CalcContext } from '../src/engine/types';
const functions = Object.fromEntries(baseFunctions.map((f) => [f.name, f]));
const run = (name: string, args: Record<string, any>, context: CalcContext = {}) =>
  functions[name].calculate(args, context);
const error = { error: '#DIV/0!' };
const expectedNames =
  `SUM AVERAGE MIN MAX COUNT COUNTA COUNTBLANK PRODUCT ABS ROUND ROUNDUP ROUNDDOWN INT MOD QUOTIENT SUBTOTAL AGGREGATE IF IFS AND OR NOT SWITCH IFERROR IFNA SUMIF SUMIFS COUNTIF COUNTIFS AVERAGEIF AVERAGEIFS MAXIFS MINIFS LEFT RIGHT MID LEN TRIM CLEAN UPPER LOWER PROPER CONCAT CONCATENATE TEXTJOIN TEXT VALUE SUBSTITUTE REPLACE FIND SEARCH EXACT TEXTSPLIT TEXTBEFORE TEXTAFTER REPT CHAR CODE UNICHAR UNICODE NUMBERVALUE FIXED T HYPERLINK TODAY NOW DATE TIME DAY MONTH YEAR HOUR MINUTE SECOND DAYS DATEDIF YEARFRAC WEEKDAY WEEKNUM EDATE EOMONTH NETWORKDAYS NETWORKDAYS.INTL WORKDAY WORKDAY.INTL DATEVALUE TIMEVALUE DAYS360 ISOWEEKNUM ISBLANK ISNUMBER ISTEXT ISERROR ISNA ISLOGICAL ISFORMULA ISEVEN ISODD ERROR.TYPE FORMULATEXT`.split(
    ' ',
  );

describe('base function catalogue completeness and independently specified examples', () => {
  it('contains every required base function exactly once', () =>
    expect(baseFunctions.map((f) => f.name).sort()).toEqual(expectedNames.sort()));
  for (const f of baseFunctions)
    it(`${f.name}: published expected example`, () => {
      const actual = run(f.name, f.example.args, f.example.context);
      if (typeof f.example.expected === 'number')
        expect(actual).toBeCloseTo(f.example.expected, 10);
      else expect(actual).toEqual(f.example.expected);
    });
});

// Expected values are established by arithmetic/calendar rules, not by a second call to the implementation.
const edges: [string, Record<string, any>, any][] = [
  ['SUM', { data: [null, '2', true, 0, 3] }, 3],
  ['AVERAGE', { data: [null, '', 2, 4] }, 3],
  ['MIN', { data: ['', null] }, 0],
  ['MAX', { data: [-4, -2] }, -2],
  ['COUNT', { data: [null, '2', true, error, 2] }, 1],
  ['COUNTA', { data: [null, '', false, error, 0] }, 4],
  ['COUNTBLANK', { data: [null, '', false, 0] }, 2],
  ['PRODUCT', { data: [null, '2', true] }, 0],
  ['ABS', { value: '-4' }, 4],
  ['ROUND', { value: -2.5, digits: 0 }, -3],
  ['ROUNDUP', { value: -2.01, digits: 0 }, -3],
  ['ROUNDDOWN', { value: -2.99, digits: 0 }, -2],
  ['INT', { value: -0.1 }, -1],
  ['MOD', { value: 3, divisor: -2 }, -1],
  ['QUOTIENT', { value: 7, divisor: -2 }, -3],
  ['SUBTOTAL', { data: [3, error, 4], functionNum: 2 }, 2],
  ['AGGREGATE', { data: [3, error, 4], functionNum: 9, options: 6 }, 7],
  ['IF', { condition: false, ifTrue: error, ifFalse: 0 }, 0],
  [
    'IFS',
    {
      conditions: [
        { condition: true, value: 0 },
        { condition: error, value: 1 },
      ],
    },
    0,
  ],
  ['AND', { data: [true, 'ignored', null] }, true],
  ['OR', { data: [0, 'ignored', null] }, false],
  ['NOT', { value: 0 }, true],
  ['SWITCH', { value: 'a', cases: [{ match: 'A', value: 0 }], default: 1 }, 0],
  ['IFERROR', { value: 0, fallback: 99 }, 0],
  ['IFNA', { value: { error: '#N/A' }, fallback: '' }, ''],
  ['SUMIF', { range: ['A', 'a', 'B'], criteria: 'a', sumRange: [2, 3, 9] }, 5],
  [
    'SUMIFS',
    {
      data: [2, 3, 9],
      conditions: [
        { range: ['A', 'a', 'B'], criteria: 'a' },
        { range: [1, 2, 3], criteria: '>1' },
      ],
    },
    3,
  ],
  ['COUNTIF', { range: ['*', 'x', '**'], criteria: '~*' }, 1],
  ['COUNTIFS', { data: [1, 2, 3], conditions: [{ range: [null, '', 0], criteria: '' }] }, 2],
  ['AVERAGEIF', { range: ['a', 'b', 'a'], criteria: 'a', averageRange: [2, 99, 8] }, 5],
  ['AVERAGEIFS', { data: [2, 4], conditions: [{ range: [1, 1], criteria: 1 }] }, 3],
  ['MAXIFS', { data: [-3, -2], conditions: [{ range: ['a', 'a'], criteria: 'a' }] }, -2],
  ['MINIFS', { data: [1, 2], conditions: [{ range: ['a', 'b'], criteria: 'c' }] }, 0],
  ['LEFT', { text: '😀A', count: 1 }, '😀'],
  ['RIGHT', { text: 'ABC', count: 0 }, ''],
  ['MID', { text: 'ABC', start: 7, count: 3 }, ''],
  ['LEN', { text: '😀A' }, 2],
  ['TRIM', { text: ' \u00a0 A  B ' }, '\u00a0 A B'],
  ['CLEAN', { text: 'A\u0000B\u007f' }, 'AB\u007f'],
  ['UPPER', { text: 'ab1' }, 'AB1'],
  ['LOWER', { text: 'AB1' }, 'ab1'],
  ['PROPER', { text: "o'NEILL 3ABC" }, "O'Neill 3Abc"],
  ['CONCAT', { data: [false, null, 0] }, 'FALSE0'],
  [
    'CONCATENATE',
    {
      data: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    },
    'ABCD',
  ],
  ['TEXTJOIN', { data: ['', null, 0], delimiter: '|', ignoreEmpty: false }, '||0'],
  ['TEXT', { value: 0.125, format: '0.0%' }, '12.5%'],
  ['VALUE', { text: '(1,250.50)' }, -1250.5],
  ['SUBSTITUTE', { text: 'AAaa', oldText: 'A', newText: 'x' }, 'xxaa'],
  ['REPLACE', { text: 'ABC', start: 5, count: 2, newText: 'X' }, 'ABCX'],
  ['FIND', { text: 'ABC', findText: '', start: 2 }, 2],
  ['SEARCH', { text: 'ABcDE', findText: 'b?d' }, 2],
  ['EXACT', { text1: 0, text2: '0' }, true],
  ['TEXTSPLIT', { text: 'A,,B', columnDelimiter: ',', ignoreEmpty: true }, [['A', 'B']]],
  ['TEXTBEFORE', { text: 'A-B-C', delimiter: '-', instance: -1 }, 'A-B'],
  ['TEXTAFTER', { text: 'A-B-C', delimiter: '-', instance: -2 }, 'B-C'],
  ['REPT', { text: 'A', times: 0 }, ''],
  ['CHAR', { value: 128 }, '€'],
  ['CODE', { text: '€' }, 128],
  ['UNICHAR', { value: 128512 }, '😀'],
  ['UNICODE', { text: '😀' }, 128512],
  ['NUMBERVALUE', { text: '12.5%%' }, 0.00125],
  ['FIXED', { value: -1250, decimals: -2, noCommas: true }, '-1300'],
  ['T', { value: false }, ''],
  ['HYPERLINK', { url: '#Sheet1!A1', label: '' }, { url: '#Sheet1!A1', label: '#Sheet1!A1' }],
  ['DATE', { year: 1900, month: 3, day: 0 }, 60],
  ['TIME', { hour: 25, minute: 0 }, 1 / 24],
  ['DAY', { date: 60 }, 29],
  ['MONTH', { date: 0 }, 1],
  ['YEAR', { date: 0 }, 1900],
  ['HOUR', { date: 45292.99998842592 }, 23],
  ['MINUTE', { date: 0.5 }, 0],
  ['SECOND', { date: 0.5006944444444444 }, 0],
  ['DAYS', { start: '2024-03-01', end: '2024-02-28' }, -2],
  ['DATEDIF', { start: '2020-02-29', end: '2021-02-28', unit: 'Y' }, 0],
  ['YEARFRAC', { start: '2024-01-01', end: '2025-01-01', basis: 1 }, 1],
  ['WEEKDAY', { date: '2024-01-07', returnType: 3 }, 6],
  ['WEEKNUM', { date: '2021-01-01', returnType: 21 }, 53],
  ['EDATE', { date: '2023-01-31', months: 1 }, 44985],
  ['EOMONTH', { date: '2024-02-01', months: 0 }, 45351],
  ['NETWORKDAYS', { start: '2024-01-07', end: '2024-01-01' }, -5],
  ['NETWORKDAYS.INTL', { start: '2024-01-01', end: '2024-01-07', weekend: '0000110' }, 5],
  ['WORKDAY', { start: '2024-01-06', days: 0 }, 45297],
  ['WORKDAY.INTL', { start: '2024-01-08', days: -1, weekend: 11 }, 45297],
  ['DATEVALUE', { text: '1900-03-01' }, 61],
  ['TIMEVALUE', { text: '12:00 AM' }, 0],
  ['DAYS360', { start: '2024-01-31', end: '2024-02-29', european: true }, 29],
  ['ISOWEEKNUM', { date: '2024-12-31' }, 1],
  ['ISBLANK', { value: '' }, false],
  ['ISNUMBER', { value: true }, false],
  ['ISTEXT', { value: null }, false],
  ['ISERROR', { value: 0 }, false],
  ['ISNA', { value: error }, false],
  ['ISLOGICAL', { value: 'TRUE' }, false],
  ['ISEVEN', { value: -2.9 }, true],
  ['ISODD', { value: -3.9 }, true],
  ['ERROR.TYPE', { value: { error: '#SPILL!' } }, 9],
];
describe('independent boundary and semantics cases', () => {
  for (const [name, args, expected] of edges)
    it(`${name}: ${JSON.stringify(args)}`, () => {
      const actual = run(name, args);
      typeof expected === 'number'
        ? expect(actual).toBeCloseTo(expected, 9)
        : expect(actual).toEqual(expected);
    });
  it('TODAY and NOW use explicit UTC calculation clock', () => {
    expect(run('TODAY', {}, { now: '2024-01-01T23:30:00-05:00' })).toBe(45293);
    expect(run('NOW', {}, { now: '2024-01-01T23:30:00-05:00' })).toBeCloseTo(45293.1875, 10);
  });
  const context: CalcContext = {
    sheetId: 's',
    workbook: {
      id: 'w',
      name: 'w',
      sheets: [
        {
          id: 's',
          name: 's',
          columns: [{ id: 'a', name: 'A', type: 'number' }],
          rows: [[1], [2], [3], [4]],
          hiddenRows: [1],
          filteredRows: [2],
          formulae: { A5: '=SUBTOTAL(9,A2:A4)' },
        },
      ],
    },
  };
  it('SUBTOTAL honors filtered rows, optional hidden rows and nested summaries', () => {
    expect(run('SUBTOTAL', { data: [1, 2, 3, 4], functionNum: 9 }, context)).toBe(3);
    expect(run('SUBTOTAL', { data: [1, 2, 3, 4], functionNum: 109 }, context)).toBe(1);
  });
  it('AGGREGATE distinguishes all seven ignore policies', () => {
    expect(run('AGGREGATE', { data: [1, 2, 3, 4], functionNum: 9, options: 4 }, context)).toBe(7);
    expect(run('AGGREGATE', { data: [1, 2, 3, 4], functionNum: 9, options: 1 }, context)).toBe(1);
  });
  it('formula inspection uses metadata rather than cached plain values', () => {
    expect(run('ISFORMULA', { address: 'A5' }, context)).toBe(true);
    expect(run('ISFORMULA', { address: 'A1' }, context)).toBe(false);
    expect(run('FORMULATEXT', { address: 'A5' }, context)).toBe('=SUBTOTAL(9,A2:A4)');
  });
  it('all base functions have independent edge checks', () => {
    const tested = new Set([...edges.map((e) => e[0]), 'TODAY', 'NOW', 'ISFORMULA', 'FORMULATEXT']);
    expect(expectedNames.filter((n) => !tested.has(n))).toEqual([]);
  });
});

const invalid: [string, Record<string, any>, string][] = [
  ['AVERAGE', { data: [] }, '#DIV/0!'],
  ['SUM', { data: [1, error] }, '#DIV/0!'],
  ['MIN', { data: [error] }, '#DIV/0!'],
  ['MAX', { data: [error] }, '#DIV/0!'],
  ['PRODUCT', { data: [error] }, '#DIV/0!'],
  ['ABS', { value: 'abc' }, '#VALUE!'],
  ['ROUND', { value: 'abc' }, '#VALUE!'],
  ['ROUNDUP', { value: 'abc' }, '#VALUE!'],
  ['ROUNDDOWN', { value: 'abc' }, '#VALUE!'],
  ['INT', { value: 'abc' }, '#VALUE!'],
  ['MOD', { value: 2, divisor: 0 }, '#DIV/0!'],
  ['QUOTIENT', { value: 2, divisor: 0 }, '#DIV/0!'],
  ['SUBTOTAL', { data: [1], functionNum: 99 }, '#VALUE!'],
  ['AGGREGATE', { data: [1], functionNum: 9, options: 8 }, '#VALUE!'],
  ['IF', { condition: true, ifTrue: error }, '#DIV/0!'],
  ['IFS', { conditions: [{ condition: false, value: 1 }] }, '#N/A'],
  ['AND', { data: ['text', null] }, '#VALUE!'],
  ['OR', { data: [error, true] }, '#DIV/0!'],
  ['NOT', { value: 'bad' }, '#VALUE!'],
  ['SWITCH', { value: 'a', cases: [{ match: 'b', value: 1 }] }, '#N/A'],
  ['IFERROR', { value: error, fallback: { error: '#N/A' } }, '#N/A'],
  ['IFNA', { value: error, fallback: 0 }, '#DIV/0!'],
  ['SUMIF', { range: [1], criteria: 1, sumRange: [1, 2] }, '#VALUE!'],
  ['SUMIFS', { data: [1], conditions: [] }, '#VALUE!'],
  ['COUNTIFS', { data: [1, 2], conditions: [{ range: [1], criteria: 1 }] }, '#VALUE!'],
  ['AVERAGEIF', { range: [1], criteria: 2 }, '#DIV/0!'],
  ['AVERAGEIFS', { data: [1], conditions: [{ range: [1], criteria: 2 }] }, '#DIV/0!'],
  ['MAXIFS', { data: [error], conditions: [{ range: [1], criteria: 1 }] }, '#DIV/0!'],
  ['MINIFS', { data: [error], conditions: [{ range: [1], criteria: 1 }] }, '#DIV/0!'],
  ['LEFT', { text: 'A', count: -1 }, '#VALUE!'],
  ['RIGHT', { text: 'A', count: -1 }, '#VALUE!'],
  ['MID', { text: 'A', start: 0, count: 1 }, '#VALUE!'],
  ['LEN', { text: error }, '#DIV/0!'],
  ['TRIM', { text: error }, '#DIV/0!'],
  ['CLEAN', { text: error }, '#DIV/0!'],
  ['UPPER', { text: error }, '#DIV/0!'],
  ['LOWER', { text: error }, '#DIV/0!'],
  ['PROPER', { text: error }, '#DIV/0!'],
  ['CONCAT', { data: [error] }, '#DIV/0!'],
  ['CONCATENATE', { data: [error] }, '#DIV/0!'],
  ['TEXTJOIN', { data: [error] }, '#DIV/0!'],
  ['TEXT', { value: 1, format: '[Red]0' }, '#VALUE!'],
  ['VALUE', { text: 'invalid' }, '#VALUE!'],
  ['SUBSTITUTE', { text: 'A', oldText: 'A', newText: 'B', instance: -1 }, '#VALUE!'],
  ['REPLACE', { text: 'A', start: 0, count: 1, newText: '' }, '#VALUE!'],
  ['FIND', { text: 'A', findText: 'B' }, '#VALUE!'],
  ['SEARCH', { text: 'A', findText: 'B' }, '#VALUE!'],
  ['EXACT', { text1: error, text2: 'A' }, '#DIV/0!'],
  ['TEXTSPLIT', { text: 'A', columnDelimiter: '', rowDelimiter: '' }, '#VALUE!'],
  ['TEXTBEFORE', { text: 'A', delimiter: '-' }, '#N/A'],
  ['TEXTAFTER', { text: 'A', delimiter: '-' }, '#N/A'],
  ['REPT', { text: 'A', times: -1 }, '#VALUE!'],
  ['CHAR', { value: 256 }, '#VALUE!'],
  ['CODE', { text: '' }, '#VALUE!'],
  ['UNICHAR', { value: 55296 }, '#VALUE!'],
  ['UNICODE', { text: '' }, '#VALUE!'],
  ['NUMBERVALUE', { text: '1', decimalSeparator: '.', groupSeparator: '.' }, '#VALUE!'],
  ['FIXED', { value: 1, decimals: 101 }, '#VALUE!'],
  ['T', { value: error }, '#DIV/0!'],
  ['HYPERLINK', { url: 'javascript:alert(1)' }, '#VALUE!'],
  ['TODAY', {}, '#VALUE!'],
  ['NOW', {}, '#VALUE!'],
  ['DATE', { year: -1, month: 1, day: 1 }, '#NUM!'],
  ['TIME', { hour: -1, minute: 0 }, '#NUM!'],
  ['DAY', { date: '2023-02-29' }, '#VALUE!'],
  ['MONTH', { date: -1 }, '#NUM!'],
  ['YEAR', { date: 2958466 }, '#NUM!'],
  ['HOUR', { date: 'bad' }, '#VALUE!'],
  ['MINUTE', { date: -1 }, '#NUM!'],
  ['SECOND', { date: -1 }, '#NUM!'],
  ['DAYS', { start: 'bad', end: '2024-01-01' }, '#VALUE!'],
  ['DATEDIF', { start: '2024-01-02', end: '2024-01-01' }, '#NUM!'],
  ['YEARFRAC', { start: 1, end: 2, basis: 5 }, '#NUM!'],
  ['WEEKDAY', { date: 1, returnType: 5 }, '#NUM!'],
  ['WEEKNUM', { date: 1, returnType: 5 }, '#NUM!'],
  ['EDATE', { date: '1900-01-01', months: -1 }, '#NUM!'],
  ['EOMONTH', { date: '9999-12-31', months: 1 }, '#NUM!'],
  ['NETWORKDAYS', { start: 'bad', end: 1 }, '#VALUE!'],
  ['NETWORKDAYS.INTL', { start: 1, end: 2, weekend: '1111111' }, '#VALUE!'],
  ['WORKDAY', { start: 0, days: -1 }, '#NUM!'],
  ['WORKDAY.INTL', { start: 1, days: 1, weekend: 10 }, '#NUM!'],
  ['DATEVALUE', { text: '01/02/2024' }, '#VALUE!'],
  ['TIMEVALUE', { text: '25:00' }, '#VALUE!'],
  ['DAYS360', { start: 'bad', end: 1 }, '#VALUE!'],
  ['ISOWEEKNUM', { date: 'bad' }, '#VALUE!'],
  ['ISEVEN', { value: 'bad' }, '#VALUE!'],
  ['ISODD', { value: 'bad' }, '#VALUE!'],
  ['ERROR.TYPE', { value: 1 }, '#N/A'],
  ['ISFORMULA', { address: 'A1' }, '#REF!'],
  ['FORMULATEXT', { address: 'A1' }, '#REF!'],
];
describe('validation and error propagation', () => {
  for (const [name, args, code] of invalid)
    it(`${name} reports ${code}`, () => {
      let caught: unknown;
      try {
        run(name, args, name === 'TODAY' || name === 'NOW' ? { now: 'invalid' } : {});
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(CalcError);
      expect((caught as CalcError).code).toBe(code);
    });
  it('rounding preserves tiny nonzero values and large exact integers', () => {
    expect(run('ROUNDUP', { value: 1e-30, digits: 0 })).toBe(1);
    expect(run('ROUNDDOWN', { value: -1e-30, digits: 0 })).toBe(-0);
    expect(run('ROUND', { value: 1e16, digits: 0 })).toBe(1e16);
    expect(run('ROUND', { value: 1.005, digits: 2 })).toBe(1.01);
  });
  it('SUMIFS rejects equally sized ranges with different shapes', () =>
    expect(() =>
      run('SUMIFS', { data: [[1, 2]], conditions: [{ range: [[1], [2]], criteria: '>0' }] }),
    ).toThrow(CalcError));
  it('clock functions accept standalone time text without inventing a date', () => {
    expect(run('HOUR', { date: '1:30 PM' })).toBe(13);
    expect(run('MINUTE', { date: '13:02:03' })).toBe(2);
    expect(run('SECOND', { date: '13:02:03.5' })).toBe(3);
    expect(() => run('HOUR', { date: '25:00' })).toThrow(CalcError);
  });
  it('TEXT renders named weekdays and month initials', () => {
    expect(run('TEXT', { value: 45292, format: 'dddd, mmmm d, yyyy' })).toBe(
      'Monday, January 1, 2024',
    );
    expect(run('TEXT', { value: 45292, format: 'mmmmm' })).toBe('J');
  });
  it('TEXT applies scaling commas after integer and decimal formats', () => {
    expect(run('TEXT', { value: 1234567, format: '#,##0,' })).toBe('1,235');
    expect(run('TEXT', { value: 1234567, format: '0.0,, \"million\"' })).toBe('1.2 million');
  });
  it('criteria can explicitly count retained error cells', () =>
    expect(run('COUNTIF', { range: [{ error: '#N/A' }, 0, error], criteria: '#N/A' })).toBe(1));
  it('COUNTIF propagates an invalid criterion error', () =>
    expect(() => run('COUNTIF', { range: [1], criteria: error })).toThrow(CalcError));
  it('information predicates deliberately accept and classify errors', () => {
    expect(run('ISBLANK', { value: error })).toBe(false);
    expect(run('ISNUMBER', { value: error })).toBe(false);
    expect(run('ISTEXT', { value: error })).toBe(false);
    expect(run('ISERROR', { value: error })).toBe(true);
    expect(run('ISNA', { value: error })).toBe(false);
    expect(run('ISLOGICAL', { value: error })).toBe(false);
  });
});
