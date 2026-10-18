import type { CellValue, Column, DataType, Sheet, Workbook } from '../engine/types';

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  category: string;
  workbook: Workbook;
}
const table = (
  id: string,
  name: string,
  fields: [string, DataType][],
  rows: CellValue[][],
): Sheet => ({
  id: `${id}-sheet`,
  name,
  columns: fields.map(([label, type], i): Column => ({
    id: `${id}-column-${i}`,
    name: label,
    type,
  })),
  rows,
});
const sample = (
  id: string,
  name: string,
  description: string,
  category: string,
  fields: [string, DataType][],
  rows: CellValue[][],
  extra: Sheet[] = [],
): SampleDataset => ({
  id,
  name,
  description,
  category,
  workbook: { id: `sample-${id}`, name, sheets: [table(id, name, fields, rows), ...extra] },
});

/** Fixtures contain synthetic data only. All business rules remain user configurable. */
export const SAMPLE_DATASETS: SampleDataset[] = [
  sample(
    'sales',
    'Sales overview',
    'Track revenue, costs, regions, and your sales team.',
    'Accounts & sales',
    [
      ['Order ID', 'text'],
      ['Date', 'date'],
      ['Customer', 'text'],
      ['Region', 'text'],
      ['Product', 'text'],
      ['Quantity', 'number'],
      ['Revenue', 'currency'],
      ['Cost', 'currency'],
      ['Status', 'text'],
    ],
    [
      [
        '001001',
        '2026-01-03',
        'Atlas Studios',
        'North',
        'Office essentials',
        12,
        2400,
        1560,
        'Paid',
      ],
      ['001002', '2026-01-06', 'Cedar & Co.', 'South', 'Desk accessories', 8, 1280, 760, 'Paid'],
      ['001003', '2026-01-10', 'Nova Labs', 'East', 'Office essentials', 20, 4000, 2600, 'Pending'],
      ['001004', '2026-01-14', 'Peak Design', 'West', 'Storage solutions', 6, 1800, 1080, 'Paid'],
      ['001005', '2026-01-19', 'Orbit Group', 'North', 'Desk accessories', 15, 2400, 1425, 'Paid'],
      [
        '001006',
        '2026-01-23',
        'Sage Digital',
        'South',
        'Storage solutions',
        10,
        3000,
        1800,
        'Pending',
      ],
      [
        '001007',
        '2026-02-02',
        'Atlas Studios',
        'North',
        'Office essentials',
        18,
        3600,
        2340,
        'Paid',
      ],
      ['001008', '2026-02-08', 'Nova Labs', 'East', 'Desk accessories', 25, 4000, 2375, 'Paid'],
      [
        '001009',
        '2026-02-12',
        'Cedar & Co.',
        'South',
        'Office essentials',
        10,
        2000,
        1300,
        'Pending',
      ],
      ['001010', '2026-02-17', 'Peak Design', 'West', 'Storage solutions', 14, 4200, 2520, 'Paid'],
      ['001011', '2026-02-21', 'Orbit Group', 'North', 'Desk accessories', 16, 2560, 1520, 'Paid'],
      [
        '001012',
        '2026-02-26',
        'Sage Digital',
        'South',
        'Office essentials',
        9,
        1800,
        1170,
        'Pending',
      ],
    ],
  ),
  sample(
    'employees',
    'Employee directory',
    'Practice payroll, department summaries, duplicate IDs, and lookups.',
    'Office & HR',
    [
      ['Employee ID', 'text'],
      ['Name', 'text'],
      ['Department', 'text'],
      ['Salary', 'currency'],
      ['Hire date', 'date'],
      ['Overtime hours', 'number'],
      ['Active', 'boolean'],
    ],
    [
      ['0001', 'Ayesha Khan', 'Finance', 85000, '2020-03-15', 6, true],
      ['0002', 'Bilal Ahmed', 'Engineering', 120000, '2019-07-01', 9, true],
      ['0003', 'Sara Ali', 'HR', 78000, '2022-02-14', 3, true],
      ['0004', 'Hamza Malik', 'Sales', 72000, '2023-10-05', 12, true],
      ['0005', 'Fatima Raza', 'Engineering', 110000, '2021-09-20', 7, true],
      ['0006', 'Omar Hassan', 'Finance', 90000, '2018-11-09', 0, true],
      ['0007', 'Maryam Shah', 'Sales', 76000, '2024-01-10', 5, true],
      ['0008', 'Ali Hussain', 'HR', 69000, '2024-06-03', 2, false],
    ],
    [
      table(
        'employee-records',
        'Employee lookup records',
        [
          ['Employee ID', 'text'],
          ['Email', 'text'],
          ['City', 'text'],
        ],
        [
          ['0001', 'ayesha@example.test', 'Lahore'],
          ['0002', 'bilal@example.test', 'Karachi'],
          ['0003', 'sara@example.test', 'Islamabad'],
          ['0005', 'fatima@example.test', 'Lahore'],
        ],
      ),
    ],
  ),
  sample(
    'marks',
    'Student marks',
    'Calculate marks, percentages, grades, ranks, and credit-weighted GPA.',
    'Schools & universities',
    [
      ['Student ID', 'text'],
      ['Student', 'text'],
      ['Mathematics', 'number'],
      ['English', 'number'],
      ['Science', 'number'],
      ['Credit hours', 'number'],
      ['Fee due', 'currency'],
      ['Fee paid', 'currency'],
    ],
    [
      ['001', 'Amina', 92, 88, 95, 3, 24000, 24000],
      ['002', 'Zain', 76, 81, 73, 3, 24000, 18000],
      ['003', 'Hira', 85, 91, 89, 3, 24000, 24000],
      ['004', 'Usman', 45, 62, 51, 3, 24000, 12000],
      ['005', 'Noor', 98, 94, 97, 3, 24000, 24000],
      ['006', 'Daniyal', 67, 72, 69, 3, 24000, 20000],
      ['007', 'Iqra', 81, 85, 84, 3, 24000, 24000],
      ['008', 'Saad', 33, 48, 39, 3, 24000, 6000],
    ],
  ),
  sample(
    'attendance',
    'Attendance register',
    'Summarize attendance and calculate working days with an explicit holiday list.',
    'Office & HR',
    [
      ['Employee ID', 'text'],
      ['Name', 'text'],
      ['Date', 'date'],
      ['Status', 'text'],
      ['Hours', 'number'],
    ],
    [
      ['0001', 'Ayesha Khan', '2026-01-05', 'Present', 8],
      ['0002', 'Bilal Ahmed', '2026-01-05', 'Present', 8],
      ['0003', 'Sara Ali', '2026-01-05', 'Absent', 0],
      ['0001', 'Ayesha Khan', '2026-01-06', 'Present', 8],
      ['0002', 'Bilal Ahmed', '2026-01-06', 'Leave', 0],
      ['0003', 'Sara Ali', '2026-01-06', 'Present', 8],
      ['0001', 'Ayesha Khan', '2026-01-07', 'Present', 8],
      ['0002', 'Bilal Ahmed', '2026-01-07', 'Present', 7],
      ['0003', 'Sara Ali', '2026-01-07', 'Present', 8],
    ],
    [
      table(
        'holidays',
        'Holiday list',
        [
          ['Date', 'date'],
          ['Description', 'text'],
        ],
        [
          ['2026-01-01', 'Example holiday'],
          ['2026-01-15', 'Example local holiday'],
        ],
      ),
    ],
  ),
  sample(
    'inventory',
    'Inventory tracker',
    'Calculate stock balances, reorder alerts, production costs, and defects.',
    'Industry & inventory',
    [
      ['SKU', 'text'],
      ['Item', 'text'],
      ['Supplier', 'text'],
      ['Opening stock', 'number'],
      ['Receipts', 'number'],
      ['Issues', 'number'],
      ['Reorder level', 'number'],
      ['Unit cost', 'currency'],
      ['Produced', 'number'],
      ['Defects', 'number'],
    ],
    [
      ['000101', 'Packaging boxes', 'Atlas Supply', 600, 250, 520, 300, 12, 1000, 14],
      ['000102', 'Safety gloves', 'SafeWorks', 180, 100, 210, 100, 85, 850, 8],
      ['000103', 'Steel bolts', 'MetalWorks', 2400, 1000, 1800, 1200, 8, 2400, 36],
      ['000104', 'Packing tape', 'Atlas Supply', 320, 200, 280, 150, 45, 600, 3],
      ['000105', 'Labels', 'PrintHouse', 8000, 4000, 6500, 3000, 2, 4000, 28],
      ['000106', 'Motor units', 'ElectroParts', 95, 40, 110, 50, 2400, 120, 2],
      ['000107', 'Cable reels', 'ElectroParts', 68, 20, 42, 30, 1250, 200, 5],
      ['000108', 'Foam inserts', 'Atlas Supply', 1200, 500, 980, 600, 18, 1500, 12],
    ],
  ),
  sample(
    'research',
    'Research observations',
    'Explore descriptive statistics, correlation, regression, and statistical tests.',
    'Research',
    [
      ['Observation', 'text'],
      ['Study hours', 'number'],
      ['Test score', 'number'],
      ['Control', 'number'],
      ['Treatment', 'number'],
    ],
    [
      ['R001', 1, 52, 20, 23],
      ['R002', 2, 58, 22, 27],
      ['R003', 3, 63, 19, 24],
      ['R004', 4, 67, 24, 29],
      ['R005', 5, 74, 21, 25],
      ['R006', 6, 79, 23, 28],
      ['R007', 7, 85, 20, 26],
      ['R008', 8, 91, 25, 31],
      ['R009', 9, 94, 22, 28],
      ['R010', 10, 98, 24, 30],
    ],
  ),
];

export function createSampleWorkbook(id = 'sales'): Workbook {
  const dataset = SAMPLE_DATASETS.find((item) => item.id === id);
  if (!dataset) throw new Error(`Unknown sample dataset: ${id}`);
  return structuredClone(dataset.workbook);
}
export const sampleDatasets = SAMPLE_DATASETS;
