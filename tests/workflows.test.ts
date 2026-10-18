import { describe, expect, it } from 'vitest';
import { workflowFunctions } from '../src/workflows';
import { CalcError } from '../src/engine/types';
import { parseLiteral, resolveBindings } from '../src/engine/bindings';

const byName = new Map(workflowFunctions.map((f) => [f.name.replace('WF.', ''), f]));
const calculate = (name: string, args?: Record<string, any>) => {
  const f = byName.get(name)!;
  return f.calculate(args ?? f.example.args, {});
};
const close = (actual: any, expected: any) => {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(actual).toBeCloseTo(expected, 7);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBe(expected.length);
    expected.forEach((v, i) => close(actual[i], v));
  } else expect(actual).toEqual(expected);
};

// Expected answers below are fixed independently of the calculation implementations.
const expected: Record<string, any> = {
  ATTENDANCE: [
    ['Status', 'Count'],
    ['P', 2],
    ['A', 1],
    ['Leave', 1],
    ['Attendance percentage', 66.66666666666667],
  ],
  WORKING_DAYS: 4,
  SERVICE: [
    ['Completed years', 'Additional months', 'Total completed months'],
    [4, 2, 50],
  ],
  SALARY_TOTAL: 150000,
  OVERTIME: [
    ['Row', 'Overtime hours', 'Overtime pay'],
    [1, 5, 150],
    [2, 0, 0],
  ],
  DEPARTMENT_PAYROLL: [
    ['Department', 'Salary total'],
    ['HR', 150],
    ['IT', 200],
  ],
  DUPLICATE_EMPLOYEES: [
    ['Employee ID', 'Occurrences', 'Rows'],
    ['001', 2, '1, 3'],
  ],
  EMPLOYEE_LOOKUP: 'Amina',
  MARKS: [
    ['Student row', 'Total', 'Average'],
    [1, 250, 83.33333333333333],
    [2, 210, 70],
  ],
  PERCENTAGE: [
    ['Row', 'Percentage'],
    [1, 75],
    [2, 90],
  ],
  PASS_FAIL: [
    ['Row', 'Score', 'Result'],
    [1, 39, 'Fail'],
    [2, 40, 'Pass'],
    [3, 85, 'Pass'],
  ],
  GRADES: [
    ['Row', 'Score', 'Grade'],
    [1, 85, 'Distinction'],
    [2, 70, 'Pass'],
    [3, 39, 'F'],
  ],
  RANKINGS: [
    ['Row', 'Score', 'Rank'],
    [1, 80, 3],
    [2, 90, 1],
    [3, 90, 1],
    [4, 70, 4],
  ],
  SUBJECT_SUMMARY: [
    ['Subject', 'Count', 'Total', 'Average', 'Minimum', 'Maximum'],
    ['Math', 2, 140, 70, 60, 80],
    ['English', 1, 90, 90, 90, 90],
  ],
  ATTENDANCE_PERCENTAGE: [
    ['Row', 'Attendance percentage'],
    [1, 90],
    [2, 75],
  ],
  GPA: [
    ['Included credits', 'Quality points', 'GPA / CGPA'],
    [8, 29, 3.625],
  ],
  FEES: [
    ['Student', 'Billed', 'Paid', 'Outstanding / (credit)'],
    ['001', 1000, 1000, 0],
    ['002', 1000, 700, 300],
    ['Total', 2000, 1700, 300],
  ],
  INCOME_EXPENSE: [
    ['Income', 'Expenses', 'Net income'],
    [1500, 600, 900],
  ],
  PROFIT: [
    ['Revenue', 'Cost', 'Profit', 'Profit margin %'],
    [1000, 750, 250, 25],
  ],
  CUSTOMER_BALANCE: [
    ['Customer', 'Outstanding / (credit)'],
    ['C001', 600],
    ['C002', 500],
  ],
  INVOICE_AGING: [
    ['Aging bucket', 'Outstanding balance'],
    ['Not overdue', 100],
    ['1–30 days overdue', 200],
    ['31–60 days overdue', 300],
    ['61+ days overdue', 0],
  ],
  MONTHLY_SALES: [
    ['Month', 'Sales total'],
    ['2024-01', 350],
    ['2024-02', 500],
  ],
  COMMISSION: [
    ['Row', 'Sales', 'Commission'],
    [1, 1000, 40],
    [2, 500, 0],
  ],
  LOAN: [
    ['Installment', 'Total paid', 'Interest paid'],
    [100, 1200, 0],
  ],
  DEPRECIATION: 3000,
  INVESTMENT: [
    ['Net present value', 'IRR per period %'],
    [41.32231404958678, 13.06623862918075],
  ],
  STOCK: [
    ['Item', 'Closing stock', 'Status'],
    ['A', 80, 'Available'],
    ['B', -10, 'Negative stock'],
  ],
  REORDER: [
    ['Item', 'Stock', 'Threshold', 'Action'],
    ['A', 5, 5, 'Reorder'],
    ['B', 20, 10, 'Sufficient'],
  ],
  PRODUCTION_COST: [
    ['Material cost', 'Labor cost', 'Overhead cost', 'Total cost', 'Cost per good unit'],
    [110, 50, 40, 200, 20],
  ],
  DEFECT_PERCENTAGE: [
    ['Row', 'Defect percentage'],
    [1, 5],
    [2, 4],
  ],
  EFFICIENCY: [
    ['Row', 'Target attainment %'],
    [1, 90],
    [2, 110],
  ],
  UNIT_CONVERSION: [
    ['Row', 'Converted value', 'Unit'],
    [1, 100, 'cm'],
    [2, 200, 'cm'],
  ],
  PACKING: [
    ['Batch row', 'Full packs', 'Loose units', 'Packs needed'],
    [1, 10, 5, 11],
    [2, 10, 0, 10],
  ],
  SUPPLIERS: [
    ['Supplier', 'Landed total', 'Landed unit cost', 'Cost rank'],
    ['Alpha', 100, 10, 1],
    ['Beta', 110, 11, 2],
  ],
  DESCRIPTIVE: [
    ['Statistic', 'Value'],
    ['Count', 5],
    ['Mean', 3],
    ['Median', 3],
    ['Minimum', 1],
    ['Maximum', 5],
    ['Variance (sample)', 2.5],
    ['Standard deviation (sample)', 1.5811388300841898],
  ],
  CORRELATION: 1,
  REGRESSION: [
    ['Statistic', 'Value'],
    ['Slope', 2],
    ['Intercept', 1],
    ['R²', 1],
    ['Residual standard error', 0],
    ['Observations', 4],
  ],
  PROBABILITY: 0.5,
  CONFIDENCE_INTERVAL: [
    ['Mean', 'Lower bound', 'Upper bound', 'Confidence %', 'Degrees of freedom'],
    [6, 2.073513677044879, 9.92648632295512, 95, 4],
  ],
  STATISTICAL_TEST: [
    ['t statistic', 'Degrees of freedom', 'p-value', 'Alternative'],
    [-1.224744871391589, 4, 0.2878641347266908, 'two-sided'],
  ],
};

describe('ready-made workflows', () => {
  it('covers all 40 required workflow tasks with independently stated results', () => {
    expect(workflowFunctions).toHaveLength(40);
    expect(new Set(workflowFunctions.map((f) => f.name)).size).toBe(40);
    expect([...byName.keys()].sort()).toEqual(Object.keys(expected).sort());
  });
  for (const [name, result] of Object.entries(expected)) {
    it(`${name} gives its independently established expected result`, () =>
      close(calculate(name), result));
  }

  it('requires an explicit attendance denominator that includes present statuses', () => {
    expect(() =>
      calculate('ATTENDANCE', { data: ['P'], presentStatuses: ['P'], eligibleStatuses: ['A'] }),
    ).toThrow(CalcError);
    expect(() =>
      calculate('ATTENDANCE', {
        data: ['Leave'],
        presentStatuses: ['P'],
        eligibleStatuses: ['P', 'A'],
      }),
    ).toThrow(/eligible denominator/);
  });
  it('supports reverse working-day ranges, holidays and leap years', () => {
    expect(
      calculate('WORKING_DAYS', {
        start: '2024-01-07',
        end: '2024-01-01',
        weekend: '0000011',
        holidays: ['2024-01-01'],
      }),
    ).toBe(-4);
    expect(
      calculate('WORKING_DAYS', {
        start: '2024-02-28',
        end: '2024-03-01',
        weekend: '0000011',
        holidays: [],
      }),
    ).toBe(3);
    expect(() =>
      calculate('WORKING_DAYS', { start: '2024-02-30', end: '2024-03-01', weekend: '0000011' }),
    ).toThrow(/valid date/);
    expect(() =>
      calculate('WORKING_DAYS', { start: '2024-01-01', end: '2024-01-07', weekend: '1111111' }),
    ).toThrow(/working day/);
  });
  it('accepts a single holiday typed through the Values input', () => {
    const holiday = parseLiteral('2024-01-01');
    expect(holiday).toBe('2024-01-01');
    expect(
      calculate('WORKING_DAYS', {
        start: '2024-01-01',
        end: '2024-01-07',
        weekend: '0000011',
        holidays: holiday,
      }),
    ).toBe(4);
    expect(
      calculate('WORKING_DAYS', {
        start: '2024-01-01',
        end: '2024-01-07',
        weekend: '0000011',
        holidays: [['2024-01-01'], [null], ['']],
      }),
    ).toBe(4);
    expect(
      calculate('WORKING_DAYS', {
        start: '2024-01-01',
        end: '2024-01-07',
        weekend: '0000011',
        holidays: parseLiteral(''),
      }),
    ).toBe(5);
    expect(() =>
      calculate('WORKING_DAYS', {
        start: '2024-01-01',
        end: '2024-01-07',
        weekend: '0000011',
        holidays: 'invalid',
      }),
    ).toThrow(/YYYY-MM-DD/);
  });
  it('accepts scalar attendance status rules without losing the configured denominator', () => {
    close(calculate('ATTENDANCE', { data: 'P', presentStatuses: 'P', eligibleStatuses: 'P' }), [
      ['Status', 'Count'],
      ['P', 1],
      ['Attendance percentage', 100],
    ]);
    expect(() =>
      calculate('ATTENDANCE', { data: 'P', presentStatuses: 'P', eligibleStatuses: 'A' }),
    ).toThrow(/also be eligible/);
  });
  it('accepts a scalar salary, preserves zero and still rejects an omitted salary input', () => {
    expect(calculate('SALARY_TOTAL', { data: 1250 })).toBe(1250);
    expect(calculate('SALARY_TOTAL', { data: 0 })).toBe(0);
    expect(() => calculate('SALARY_TOTAL', {})).toThrow(/Select Salary amounts/);
    expect(() => calculate('SALARY_TOTAL', { data: null })).toThrow(/number/);
  });
  it('accepts scalar hours and rates while retaining explicit overtime settings', () => {
    close(calculate('OVERTIME', { data: 45, rates: 20, threshold: 40, multiplier: 1.5 }), [
      ['Row', 'Overtime hours', 'Overtime pay'],
      [1, 5, 150],
    ]);
  });
  it('accepts one employee identifier and one returned value without numeric ID coercion', () => {
    expect(
      calculate('EMPLOYEE_LOOKUP', {
        data: parseLiteral('001'),
        values: 'Amina',
        search: '001',
        duplicatePolicy: 'error',
      }),
    ).toBe('Amina');
    expect(() =>
      calculate('EMPLOYEE_LOOKUP', { data: '001', values: 'Amina', search: '1' }),
    ).toThrow(/No employee/);
  });
  it('accepts scalar percentage, pass/fail and grade observations while preserving grade tables', () => {
    close(calculate('PERCENTAGE', { data: 75, maximum: 100 }), [
      ['Row', 'Percentage'],
      [1, 75],
    ]);
    close(calculate('PASS_FAIL', { data: 40, threshold: 40 }), [
      ['Row', 'Score', 'Result'],
      [1, 40, 'Pass'],
    ]);
    close(
      calculate('GRADES', {
        data: 80,
        bands: [
          [0, 'F'],
          [80, 'A'],
        ],
      }),
      [
        ['Row', 'Score', 'Grade'],
        [1, 80, 'A'],
      ],
    );
    expect(() => calculate('GRADES', { data: 80, bands: [0, 'F'] })).toThrow(/table/);
  });
  it('supports a one-course GPA only when an explicit mapping and credits are supplied', () => {
    close(calculate('GPA', { data: 'A', credits: 3, mapping: [['A', 4]] }), [
      ['Included credits', 'Quality points', 'GPA / CGPA'],
      [3, 12, 4],
    ]);
    expect(() => calculate('GPA', { data: 'A', credits: 3, mapping: ['A', 4] })).toThrow(/table/);
    expect(() => calculate('GPA', { data: 'B', credits: 3, mapping: [['A', 4]] })).toThrow(
      /No grade-point mapping/,
    );
  });
  it('accepts one customer ledger movement and one sale date', () => {
    close(calculate('CUSTOMER_BALANCE', { groups: 'C001', amounts: -25 }), [
      ['Customer', 'Outstanding / (credit)'],
      ['C001', -25],
    ]);
    close(calculate('MONTHLY_SALES', { data: '2024-01-01', amounts: 125 }), [
      ['Month', 'Sales total'],
      ['2024-01', 125],
    ]);
  });
  it('accepts a single aging limit and invoice without assuming policy bands', () => {
    close(
      calculate('INVOICE_AGING', {
        data: '2024-01-01',
        amounts: 100,
        asOf: '2024-02-15',
        limits: 30,
      }),
      [
        ['Aging bucket', 'Outstanding balance'],
        ['Not overdue', 0],
        ['1–30 days overdue', 0],
        ['31+ days overdue', 100],
      ],
    );
  });
  it('accepts a one-item stock balance and a scalar reorder threshold', () => {
    close(calculate('STOCK', { data: 'A', opening: 10, receipts: 5, issues: 8 }), [
      ['Item', 'Closing stock', 'Status'],
      ['A', 7, 'Available'],
    ]);
    close(calculate('REORDER', { data: 'A', stock: 5, thresholds: 5 }), [
      ['Item', 'Stock', 'Threshold', 'Action'],
      ['A', 5, 5, 'Reorder'],
    ]);
  });
  it('accepts scalar material quantities, defect counts and packing quantities', () => {
    close(
      calculate('PRODUCTION_COST', {
        quantities: 5,
        rates: 10,
        labor: 20,
        overhead: 30,
        output: 10,
      }),
      [
        ['Material cost', 'Labor cost', 'Overhead cost', 'Total cost', 'Cost per good unit'],
        [50, 20, 30, 100, 10],
      ],
    );
    close(calculate('DEFECT_PERCENTAGE', { defects: 2, inspected: 50 }), [
      ['Row', 'Defect percentage'],
      [1, 4],
    ]);
    close(calculate('PACKING', { data: 21, packSize: 10 }), [
      ['Batch row', 'Full packs', 'Loose units', 'Packs needed'],
      [1, 2, 1, 3],
    ]);
  });
  it('accepts one population observation while enforcing research degrees of freedom', () => {
    close(calculate('DESCRIPTIVE', { data: 7, basis: 'population' }), [
      ['Statistic', 'Value'],
      ['Count', 1],
      ['Mean', 7],
      ['Median', 7],
      ['Minimum', 7],
      ['Maximum', 7],
      ['Variance (population)', 0],
      ['Standard deviation (population)', 0],
    ]);
    expect(() => calculate('DESCRIPTIVE', { data: 7, basis: 'sample' })).toThrow(
      /at least 2 observations/,
    );
    expect(() => calculate('CORRELATION', { x: 7, y: 9 })).toThrow(/at least 2 observations/);
  });
  it('uses a prior scalar result as data and a one-cell range as a numeric workflow setting', () => {
    const workbook = {
      id: 'w',
      name: 'Settings',
      sheets: [
        {
          id: 's',
          name: 'Rules',
          columns: [{ id: 'maximum', name: 'Maximum', type: 'number' as const }],
          rows: [[100]],
        },
      ],
    };
    const history = [
      {
        id: 'r',
        functionName: 'SUM',
        taskName: 'Total achieved marks',
        value: 75,
        args: { data: [40, 35] },
        timestamp: '2024-01-01T00:00:00Z',
        warnings: [],
        duration: 0,
      },
    ];
    const args = resolveBindings(
      {
        data: { __source: 'result', resultId: 'r' },
        maximum: { __source: 'range', sheetId: 's', range: 'A2' },
      },
      workbook,
      history,
    );
    close(calculate('PERCENTAGE', args), [
      ['Row', 'Percentage'],
      [1, 75],
    ]);
  });
  it('unwraps one-cell date, text and select settings without flattening grade-mapping tables', () => {
    expect(
      calculate('WORKING_DAYS', {
        start: [['2024-01-01']],
        end: [['2024-01-07']],
        weekend: [['0000011']],
        holidays: '2024-01-01',
      }),
    ).toBe(4);
    expect(
      calculate('EMPLOYEE_LOOKUP', {
        data: '001',
        values: 'Amina',
        search: [['001']],
        duplicatePolicy: [['error']],
        caseSensitive: [[true]],
      }),
    ).toBe('Amina');
    close(
      calculate('GRADES', {
        data: 80,
        bands: [
          [0, 'F'],
          [80, 'A'],
        ],
      }),
      [
        ['Row', 'Score', 'Grade'],
        [1, 80, 'A'],
      ],
    );
  });
  it('rejects ambiguous multi-cell settings and propagates input calculation errors', () => {
    expect(() => calculate('PERCENTAGE', { data: 75, maximum: [[100], [200]] })).toThrow(
      /needs one value/,
    );
    expect(() => calculate('SALARY_TOTAL', { data: { error: '#N/A' } })).toThrowError(
      expect.objectContaining({ code: '#N/A' }),
    );
    const result = calculate('PASS_FAIL', { data: [50, { error: '#DIV/0!' }], threshold: 40 });
    expect(result[1][2]).toBe('Pass');
    expect(result[2][2].error).toBe('#DIV/0!');
  });
  it('does not count an incomplete service month as complete', () => {
    close(calculate('SERVICE', { start: '2024-01-31', end: '2024-02-29' }), [
      ['Completed years', 'Additional months', 'Total completed months'],
      [0, 0, 0],
    ]);
    expect(() => calculate('SERVICE', { start: '2024-01-02', end: '2024-01-01' })).toThrow(
      /precede/,
    );
  });
  it('rejects blank salaries rather than treating them as zero', () =>
    expect(() => calculate('SALARY_TOTAL', { data: [100, ''] })).toThrow(/blanks/));
  it('requires an overtime rule and preserves valid rows alongside row errors', () => {
    expect(() => calculate('OVERTIME', { data: [45], rates: [20], multiplier: 1.5 })).toThrow(
      CalcError,
    );
    const result = calculate('OVERTIME', {
      data: [45, -1],
      rates: [20, 20],
      threshold: 40,
      multiplier: 1.5,
    });
    expect(result[1]).toEqual([1, 5, 150]);
    expect(result[2][1].error).toBe('#NUM!');
  });
  it('rejects mismatched payroll columns', () =>
    expect(() => calculate('DEPARTMENT_PAYROLL', { groups: ['HR'], amounts: [100, 200] })).toThrow(
      /same number/,
    ));
  it('keeps leading-zero IDs distinct and makes duplicate matching configurable', () => {
    expect(calculate('DUPLICATE_EMPLOYEES', { data: ['001', '1'], caseSensitive: true })).toEqual([
      ['Employee ID', 'Occurrences', 'Rows'],
    ]);
    expect(
      calculate('DUPLICATE_EMPLOYEES', { data: ['abc', 'ABC'], caseSensitive: false })[1],
    ).toEqual(['abc', 2, '1, 2']);
    expect(() => calculate('DUPLICATE_EMPLOYEES', { data: ['001', null] })).toThrow(/blank/);
  });
  it('requires an explicit policy for duplicate lookup IDs and reports missing IDs', () => {
    expect(() =>
      calculate('EMPLOYEE_LOOKUP', { data: ['001', '001'], values: ['A', 'B'], search: '001' }),
    ).toThrow(/More than one/);
    expect(
      calculate('EMPLOYEE_LOOKUP', {
        data: ['001', '001'],
        values: ['A', 'B'],
        search: '001',
        duplicatePolicy: 'last',
      }),
    ).toBe('B');
    expect(() =>
      calculate('EMPLOYEE_LOOKUP', { data: ['001'], values: ['A'], search: '1' }),
    ).toThrow(/No employee/);
  });
  it('rejects nonrectangular marks and reports per-student invalid marks', () => {
    expect(() => calculate('MARKS', { data: [[1, 2], [3]] })).toThrow(/rectangular/);
    const result = calculate('MARKS', {
      data: [
        [1, 2],
        [null, 3],
      ],
    });
    expect(result[1]).toEqual([1, 3, 1.5]);
    expect(result[2][1].error).toBe('#VALUE!');
  });
  it('rejects a zero maximum instead of inventing a percentage', () =>
    expect(() => calculate('PERCENTAGE', { data: [20], maximum: 0 })).toThrow(/greater than zero/));
  it('requires a pass threshold rather than assuming one', () =>
    expect(() => calculate('PASS_FAIL', { data: [50] })).toThrow(CalcError));
  it('validates grade policies and shows uncovered scores as row errors', () => {
    expect(() =>
      calculate('GRADES', {
        data: [50],
        bands: [
          [0, 'F'],
          [0, 'A'],
        ],
      }),
    ).toThrow(/unique/);
    expect(calculate('GRADES', { data: [20], bands: [[40, 'Pass']] })[1][2].error).toBe('#N/A');
    expect(
      calculate('GRADES', {
        data: [80],
        bands: [
          [80, 'A'],
          [0, 'F'],
        ],
      })[1][2],
    ).toBe('A');
  });
  it('supports dense and average tied ranks and rejects invalid ranking rules', () => {
    expect(
      calculate('RANKINGS', { data: [90, 90, 80], ties: 'dense' })
        .slice(1)
        .map((r: any[]) => r[2]),
    ).toEqual([1, 1, 2]);
    expect(
      calculate('RANKINGS', { data: [90, 90, 80], ties: 'average' })
        .slice(1)
        .map((r: any[]) => r[2]),
    ).toEqual([1.5, 1.5, 3]);
    expect(() => calculate('RANKINGS', { data: [1], ties: 'random' })).toThrow(/tie rule/);
  });
  it('rejects blank subjects', () =>
    expect(() => calculate('SUBJECT_SUMMARY', { groups: [''], data: [1] })).toThrow(/blank/));
  it('rejects impossible attendance counts per row', () =>
    expect(calculate('ATTENDANCE_PERCENTAGE', { attended: [21], eligible: [20] })[1][1].error).toBe(
      '#NUM!',
    ));
  it('requires GPA mappings and positive total credits', () => {
    expect(() => calculate('GPA', { data: ['A'], credits: [0], mapping: [['A', 4]] })).toThrow(
      /positive total/,
    );
    expect(() => calculate('GPA', { data: ['B'], credits: [3], mapping: [['A', 4]] })).toThrow(
      /No grade-point mapping/,
    );
    expect(() =>
      calculate('GPA', {
        data: ['A'],
        credits: [3],
        mapping: [
          ['A', 4],
          ['A', 3],
        ],
      }),
    ).toThrow(/unique/);
  });
  it('shows fee overpayments as credits and rejects negative billed amounts', () => {
    expect(calculate('FEES', { data: ['001'], billed: [100], paid: [120] })[1]).toEqual([
      '001',
      100,
      120,
      -20,
    ]);
    expect(() => calculate('FEES', { data: ['001'], billed: [-100], paid: [0] })).toThrow(
      /nonnegative/,
    );
  });
  it('requires valid income and expense data', () =>
    expect(() => calculate('INCOME_EXPENSE', { income: [100], expenses: ['bad'] })).toThrow(
      CalcError,
    ));
  it('does not report a profit margin for zero revenue', () =>
    expect(() => calculate('PROFIT', { revenue: 0, cost: 20 })).toThrow(/nonzero revenue/));
  it('preserves customer credits and rejects missing customer IDs', () => {
    expect(calculate('CUSTOMER_BALANCE', { groups: ['C'], amounts: [-10] })[1]).toEqual(['C', -10]);
    expect(() => calculate('CUSTOMER_BALANCE', { groups: [null], amounts: [1] })).toThrow(/blank/);
  });
  it('requires ordered invoice bucket limits', () =>
    expect(() =>
      calculate('INVOICE_AGING', {
        data: ['2024-01-01'],
        amounts: [100],
        asOf: '2024-03-01',
        limits: [60, 30],
      }),
    ).toThrow(/increasing/));
  it('separates sales in different years and rejects ambiguous dates', () => {
    expect(
      calculate('MONTHLY_SALES', { data: ['2023-01-01', '2024-01-01'], amounts: [10, 20] }),
    ).toEqual([
      ['Month', 'Sales total'],
      ['2023-01', 10],
      ['2024-01', 20],
    ]);
    expect(() => calculate('MONTHLY_SALES', { data: ['01/02/2024'], amounts: [1] })).toThrow(
      /YYYY-MM-DD/,
    );
  });
  it('requires commission rules and honors the selected whole-amount basis', () => {
    expect(() => calculate('COMMISSION', { data: [100], rate: 10, threshold: 50 })).toThrow(
      /basis/,
    );
    expect(
      calculate('COMMISSION', {
        data: [100, 50, 49],
        rate: 10,
        threshold: 50,
        basis: 'whole amount when threshold met',
      })
        .slice(1)
        .map((r: any[]) => r[2]),
    ).toEqual([10, 5, 0]);
  });
  it('computes a known amortizing loan and distinguishes payment timing', () => {
    const args = { principal: 100000, annualRate: 6, frequency: 12, payments: 360, timing: 'end' };
    expect(calculate('LOAN', args)[1][0]).toBeCloseTo(599.5505251527569, 7);
    expect(calculate('LOAN', { ...args, timing: 'beginning' })[1][0]).toBeCloseTo(
      596.5676867191612,
      7,
    );
    expect(() => calculate('LOAN', { ...args, payments: 0 })).toThrow(/greater than zero/);
  });
  it('validates depreciation bounds and supports sum-of-years-digits', () => {
    expect(
      calculate('DEPRECIATION', {
        cost: 10000,
        salvage: 1000,
        life: 3,
        period: 1,
        method: 'sum-of-years-digits',
      }),
    ).toBe(4500);
    expect(() =>
      calculate('DEPRECIATION', { cost: 100, salvage: 200, life: 3, period: 1 }),
    ).toThrow(/Salvage/);
  });
  it('requires both investment outlays and inflows', () =>
    expect(() => calculate('INVESTMENT', { data: [100, 200], rate: 10 })).toThrow(
      /negative and one positive/,
    ));
  it('preserves valid inventory rows alongside invalid quantities', () => {
    const result = calculate('STOCK', {
      data: ['A', 'B'],
      opening: [10, -1],
      receipts: [0, 0],
      issues: [3, 0],
    });
    expect(result[1]).toEqual(['A', 7, 'Available']);
    expect(result[2][1].error).toBe('#NUM!');
  });
  it('requires explicit reorder thresholds', () =>
    expect(() => calculate('REORDER', { data: ['A'], stock: [5] })).toThrow(CalcError));
  it('rejects zero production output', () =>
    expect(() =>
      calculate('PRODUCTION_COST', {
        quantities: [1],
        rates: [10],
        labor: 0,
        overhead: 0,
        output: 0,
      }),
    ).toThrow(/greater than zero/));
  it('rejects defects greater than inspected counts and fractional counts', () => {
    expect(calculate('DEFECT_PERCENTAGE', { defects: [11], inspected: [10] })[1][1].error).toBe(
      '#NUM!',
    );
    expect(calculate('DEFECT_PERCENTAGE', { defects: [1.5], inspected: [10] })[1][1].error).toBe(
      '#NUM!',
    );
  });
  it('reports invalid zero output targets as row errors', () =>
    expect(calculate('EFFICIENCY', { actual: [10], targets: [0] })[1][1].error).toBe('#NUM!'));
  it('converts temperatures and rejects incompatible dimensions', () => {
    expect(calculate('UNIT_CONVERSION', { data: [0], from: 'C', to: 'F' })[1][1]).toBeCloseTo(
      32,
      10,
    );
    expect(calculate('UNIT_CONVERSION', { data: [1], from: 'm', to: 'kg' })[1][1].error).toBe(
      '#N/A',
    );
  });
  it('requires integer packing rules and quantities', () => {
    expect(() => calculate('PACKING', { data: [10], packSize: 2.5 })).toThrow(/whole number/);
    expect(calculate('PACKING', { data: [2.5], packSize: 2 })[1][1].error).toBe('#NUM!');
  });
  it('requires comparable nonnegative supplier prices', () =>
    expect(() =>
      calculate('SUPPLIERS', { data: ['A'], rates: [-1], extras: [0], quantity: 10 }),
    ).toThrow(/negative/));
  it('distinguishes population variance and rejects insufficient sample observations', () => {
    expect(calculate('DESCRIPTIVE', { data: [1, 2, 3], basis: 'population' })[6][1]).toBeCloseTo(
      2 / 3,
      10,
    );
    expect(() => calculate('DESCRIPTIVE', { data: [1], basis: 'sample' })).toThrow(/at least 2/);
  });
  it('rejects constant series in correlation', () =>
    expect(() => calculate('CORRELATION', { x: [1, 1], y: [2, 3] })).toThrow(/variation/));
  it('requires sufficient regression degrees of freedom and nonconstant predictors', () => {
    expect(() => calculate('REGRESSION', { x: [1, 2], y: [1, 2] })).toThrow(/three pairs/);
    expect(() => calculate('REGRESSION', { x: [1, 1, 1], y: [2, 3, 4] })).toThrow(/variation/);
  });
  it('validates probability parameters and distinguishes density from probability', () => {
    expect(() => calculate('PROBABILITY', { x: 0, mean: 0, standardDeviation: 0 })).toThrow(
      /greater than zero/,
    );
    expect(
      calculate('PROBABILITY', { x: 0, mean: 0, standardDeviation: 1, mode: 'density' }),
    ).toBeCloseTo(0.3989422804014327, 10);
  });
  it('rejects confidence limits outside the open 0–100 percent interval', () =>
    expect(() => calculate('CONFIDENCE_INTERVAL', { data: [1, 2], confidence: 100 })).toThrow(
      /less than 100/,
    ));
  it('supports paired t tests, directional alternatives and invalid variance errors', () => {
    const args = { x: [3, 6, 9], y: [1, 3, 5], test: 'paired', alternative: 'X greater than Y' };
    const result = calculate('STATISTICAL_TEST', args);
    expect(result[1][0]).toBeCloseTo(5.196152422706632, 9);
    expect(result[1][1]).toBe(2);
    expect(result[1][2]).toBeCloseTo(0.0175493593229923, 9);
    expect(() =>
      calculate('STATISTICAL_TEST', { x: [1, 1], y: [2, 2], test: 'Welch unequal variance' }),
    ).toThrow(/nonzero/);
    expect(() =>
      calculate('STATISTICAL_TEST', { x: [1, 2], y: [2, 3, 4], test: 'paired' }),
    ).toThrow(/same number/);
  });
});
