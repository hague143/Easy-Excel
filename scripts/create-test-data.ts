import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { SAMPLE_DATASETS } from '../src/workbook/samples';
import { exportCSV, importFile, parseDelimited } from '../src/workbook/io';
import { execute } from '../src/engine/registry';
import type { Sheet, DataType, CellValue } from '../src/engine/types';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'downloads/test-data');
await mkdir(destination, { recursive: true });
const filenames: Record<string, string> = {
  'sales-sheet': 'sales.csv',
  'employees-sheet': 'employees.csv',
  'employee-records-sheet': 'employee-lookup.csv',
  'marks-sheet': 'students.csv',
  'attendance-sheet': 'attendance.csv',
  'holidays-sheet': 'holidays.csv',
  'inventory-sheet': 'inventory.csv',
  'research-sheet': 'research.csv',
};
const sheets: Sheet[] = structuredClone(
  SAMPLE_DATASETS.flatMap((sample) => sample.workbook.sheets),
);
const inventory = sheets.find((s) => s.id === 'inventory-sheet')!;
const closing = [330, 70, 1600, 240, 5500, 25, 46, 720];
inventory.columns.push({ id: 'inventory-expected-closing', name: 'Closing stock', type: 'number' });
inventory.rows.forEach((row, i) => row.push(closing[i]));

function extra(id: string, name: string, fields: [string, DataType][], rows: CellValue[][]) {
  filenames[id] = `${id}.csv`;
  sheets.push({
    id,
    name,
    columns: fields.map(([name, type], i) => ({ id: `${id}-${i}`, name, type })),
    rows,
  });
}
extra(
  'text-cleaning',
  'Text cleaning',
  [
    ['Record ID', 'text'],
    ['Name', 'text'],
    ['Email', 'text'],
  ],
  [
    ['001', '  Amina   Khan  ', 'amina@example.test'],
    ['002', '  BILAL  AHMED ', 'bilal@example.test'],
    ['001', 'Amina Khan', 'amina2@example.test'],
    ['003', 'Noor', 'noor@example.test'],
  ],
);
extra(
  'import-checks',
  'Import checks',
  [
    ['Identifier', 'text'],
    ['Amount', 'mixed'],
    ['Note', 'text'],
    ['Active', 'boolean'],
  ],
  [
    ['00001', 0, 'Numeric zero', true],
    ['00002', null, 'Blank amount', false],
    ['9007199254740993', 'not-a-number', 'Invalid numeric text; keep identifier exact', true],
    ['00004', 12.5, '', false],
  ],
);
extra(
  'gpa-courses',
  'GPA courses',
  [
    ['Student ID', 'text'],
    ['Course', 'text'],
    ['Grade', 'text'],
    ['Credit hours', 'number'],
  ],
  [
    ['001', 'Mathematics', 'A', 3],
    ['001', 'English', 'B', 3],
    ['001', 'Science', 'A', 4],
  ],
);
extra(
  'grade-points',
  'Grade points',
  [
    ['Grade', 'text'],
    ['Grade points', 'number'],
  ],
  [
    ['A', 4],
    ['B', 3],
    ['C', 2],
    ['D', 1],
    ['F', 0],
  ],
);
extra(
  'grade-bands',
  'Grade bands',
  [
    ['Minimum score', 'number'],
    ['Grade', 'text'],
  ],
  [
    [0, 'F'],
    [40, 'D'],
    [60, 'C'],
    [75, 'B'],
    [90, 'A'],
  ],
);
extra(
  'loan-settings',
  'Loan settings',
  [
    ['Setting', 'text'],
    ['Value', 'mixed'],
  ],
  [
    ['Principal', 100000],
    ['Nominal annual rate (percent)', 12],
    ['Payments per year', 12],
    ['Total number of payments', 12],
    ['Payment timing', 'end'],
  ],
);

const files = new Map<string, Uint8Array>();
for (const sheet of sheets) {
  const text = (await exportCSV(sheet).text()).replaceAll('\r\n', '\n');
  const bytes = new TextEncoder().encode(text);
  const filename = filenames[sheet.id];
  files.set(filename, bytes);
  await writeFile(resolve(destination, filename), bytes);
  const reopened = parseDelimited(text, { dateFormat: 'iso' }).workbook.sheets[0];
  assert.equal(reopened.rows.length, sheet.rows.length, `${filename}: row count`);
  assert.deepEqual(
    reopened.columns.map((c) => c.name),
    sheet.columns.map((c) => c.name),
  );
  sheet.columns.forEach((column, c) => {
    if (/\bID\b|Identifier|SKU/.test(column.name))
      assert.deepEqual(
        reopened.rows.map((r) => r[c]),
        sheet.rows.map((r) => r[c]),
        `${filename}: identifier preservation`,
      );
  });
}

const excel = new ExcelJS.Workbook();
excel.creator = 'SheetPilot synthetic test data';
excel.created = excel.modified = new Date('2026-01-01T00:00:00Z');
for (const sheet of sheets) {
  const ws = excel.addWorksheet(sheet.name);
  ws.addRow(sheet.columns.map((c) => c.name));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176C50' } };
  sheet.rows.forEach((row, r) =>
    row.forEach((value, c) => {
      const cell = ws.getCell(r + 2, c + 1),
        type = sheet.columns[c].type;
      if (type === 'date' && typeof value === 'string') {
        cell.value = new Date(`${value}T00:00:00Z`);
        cell.numFmt = 'yyyy-mm-dd';
      } else if (value && typeof value === 'object')
        cell.value = { error: value.error as ExcelJS.ErrorValue };
      else cell.value = value;
      if (type === 'text') cell.numFmt = '@';
      if (type === 'currency') cell.numFmt = '"¤"#,##0.00';
    }),
  );
  ws.columns.forEach((c) => {
    c.width = 24;
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}
const xlsx = new Uint8Array(await excel.xlsx.writeBuffer());
const xlsxName = 'SheetPilot-Test-Data.xlsx';
await writeFile(resolve(destination, xlsxName), xlsx);
files.set(xlsxName, xlsx);

const imported = await importFile(
  {
    name: xlsxName,
    size: xlsx.byteLength,
    arrayBuffer: async () => xlsx.slice().buffer as ArrayBuffer,
  },
  { dateFormat: 'iso' },
);
assert.equal(imported.workbook.sheets.length, sheets.length);
const sheet = (name: string) => imported.workbook.sheets.find((s) => s.name === name)!;
const column = (name: string, field: string) => {
  const s = sheet(name),
    c = s.columns.findIndex((c) => c.name === field);
  assert(c >= 0);
  return s.rows.map((r) => r[c]);
};
assert.deepEqual(column('Import checks', 'Identifier'), [
  '00001',
  '00002',
  '9007199254740993',
  '00004',
]);
assert.deepEqual(column('Import checks', 'Amount'), [0, null, 'not-a-number', 12.5]);
assert.equal(column('Import checks', 'Note')[3], '');
assert.deepEqual(column('Employee directory', 'Employee ID'), [
  '0001',
  '0002',
  '0003',
  '0004',
  '0005',
  '0006',
  '0007',
  '0008',
]);
assert.equal(sheet('Sales overview').columns.find((c) => c.name === 'Date')!.type, 'date');
const check = (name: string, actual: any, expected: any) => {
  if (typeof expected === 'number')
    assert(
      Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
      `${name}: expected ${expected}, got ${actual}`,
    );
  else assert.deepEqual(actual, expected, name);
};
const run = (name: string, args: Record<string, any>) => {
  const r = execute(name, args);
  assert(!r.value?.error, `${name}: ${JSON.stringify(r.value)}`);
  return r.value;
};
const revenue = column('Sales overview', 'Revenue'),
  cost = column('Sales overview', 'Cost');
check('Sales total', run('SUM', { data: revenue }), 33040);
check('Sales average', run('AVERAGE', { data: revenue }), 2753.3333333333335);
check('Cost total', run('SUM', { data: cost }), 20450);
check(
  'North + Paid',
  run('SUMIFS', {
    data: revenue,
    conditions: [
      { range: column('Sales overview', 'Region'), criteria: 'North' },
      { range: column('Sales overview', 'Status'), criteria: 'Paid' },
    ],
  }),
  10960,
);
check('Payroll total', run('SUM', { data: column('Employee directory', 'Salary') }), 700000);
check('Math total', run('SUM', { data: column('Student marks', 'Mathematics') }), 577);
check(
  'Math pass count',
  run('COUNTIF', { range: column('Student marks', 'Mathematics'), criteria: '>=40' }),
  7,
);
check(
  'Working days',
  run('WF.WORKING_DAYS', {
    start: '2026-01-01',
    end: '2026-01-16',
    weekend: '0000011',
    holidays: column('Holiday list', 'Date'),
  }),
  10,
);
check(
  'Attendance',
  run('WF.ATTENDANCE', {
    data: column('Attendance register', 'Status'),
    presentStatuses: ['Present'],
    eligibleStatuses: ['Present', 'Absent'],
  }).at(-1)[1],
  87.5,
);
check('Trim names', run('TRIM', { text: column('Text cleaning', 'Name'), __rowWise: ['text'] }), [
  'Amina Khan',
  'BILAL AHMED',
  'Amina Khan',
  'Noor',
]);
check(
  'Inventory closing reference',
  run('WF.STOCK', {
    data: column('Inventory tracker', 'SKU'),
    opening: column('Inventory tracker', 'Opening stock'),
    receipts: column('Inventory tracker', 'Receipts'),
    issues: column('Inventory tracker', 'Issues'),
  })
    .slice(1)
    .map((r: any[]) => r[1]),
  closing,
);
check(
  'Reorder alerts',
  run('WF.REORDER', {
    data: column('Inventory tracker', 'SKU'),
    stock: column('Inventory tracker', 'Closing stock'),
    thresholds: column('Inventory tracker', 'Reorder level'),
  })
    .slice(1)
    .filter((r: any[]) => r[3] === 'Reorder')
    .map((r: any[]) => r[0]),
  ['000102', '000106'],
);
check(
  'GPA',
  run('WF.GPA', {
    data: column('GPA courses', 'Grade'),
    credits: column('GPA courses', 'Credit hours'),
    mapping: sheet('Grade points').rows,
  })[1][2],
  3.7,
);
check(
  'Grade bands',
  run('WF.GRADES', {
    data: column('Student marks', 'Mathematics'),
    bands: sheet('Grade bands').rows,
  })
    .slice(1)
    .map((r: any[]) => r[2]),
  ['A', 'B', 'B', 'D', 'A', 'C', 'B', 'F'],
);
const x = column('Research observations', 'Study hours'),
  y = column('Research observations', 'Test score');
check('Regression slope', run('SLOPE', { x, y }), 173 / 33);
check('Regression intercept', run('INTERCEPT', { x, y }), 709 / 15);
check(
  'Loan installment',
  run('WF.LOAN', {
    principal: 100000,
    annualRate: 12,
    frequency: 12,
    payments: 12,
    timing: 'end',
  })[1][0],
  8884.87886783417,
);

const guide = await readFile(resolve(destination, 'README.md'));
files.set('README.md', new Uint8Array(guide));
const zip = new JSZip();
for (const [name, bytes] of files) zip.file(name, bytes);
const bundle = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
const zipName = resolve(root, 'downloads/SheetPilot-Test-Data.zip');
await writeFile(zipName, bundle);
const verified = await JSZip.loadAsync(bundle, { checkCRC32: true });
for (const [name, bytes] of files)
  assert.deepEqual(await verified.file(name)!.async('uint8array'), bytes, `ZIP: ${name}`);
console.log(
  `Created and re-imported ${sheets.length} worksheets, ${sheets.reduce((n, s) => n + s.rows.length, 0)} data rows, ${sheets.length} CSVs, and XLSX/ZIP downloads. All 17 expected-result checks passed.`,
);
