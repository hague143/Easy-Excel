import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  exportCSV,
  exportXLSX,
  importFile,
  parseDelimited,
  protectCSVCell,
  validateXLSXArchive,
} from '../src/workbook/io';
import {
  createProject,
  loadLocalProject,
  parseProject,
  saveLocalProject,
  serializeProject,
} from '../src/workbook/project';
import { createSampleWorkbook, SAMPLE_DATASETS } from '../src/workbook/samples';
import type { Sheet, Workbook } from '../src/engine/types';

const sheet = (rows: Sheet['rows']): Sheet => ({
  id: 'sheet',
  name: 'Values',
  columns: [
    { id: 'id', name: 'Employee ID', type: 'text' },
    { id: 'amount', name: 'Amount', type: 'mixed' },
    { id: 'active', name: 'Active', type: 'boolean' },
    { id: 'label', name: 'Label', type: 'text' },
  ],
  rows,
});
const workbook = (rows: Sheet['rows']): Workbook => ({
  id: 'book',
  name: 'Test',
  sheets: [sheet(rows)],
});
const file = async (blob: Blob, name: string) => ({
  name,
  size: blob.size,
  arrayBuffer: () => blob.arrayBuffer(),
});

describe('CSV data integrity and preview', () => {
  it('distinguishes zero, blank, empty text, booleans, identifiers and text', () => {
    const result = parseDelimited(
      'Employee ID,Amount,Active,Label\r\n000123,0,true,""\r\n9007199254740993,,false,hello\r\n',
    );
    expect(result.workbook.sheets[0].rows).toEqual([
      ['000123', 0, true, ''],
      ['9007199254740993', null, false, 'hello'],
    ]);
    expect(result.issues.some((issue) => issue.type === 'identifier')).toBe(true);
    expect(result.issues.some((issue) => issue.type === 'blank' && issue.column === 1)).toBe(true);
  });
  it('detects delimiter, retains text and confirms ambiguous dates explicitly', () => {
    const text = 'Title\nName;Date;Revenue\nAmina;03/04/2026;12.5\nZain;15/04/2026;15';
    const preview = parseDelimited(text, { headerRow: 1, delimiter: ';' });
    expect(preview.detectedDelimiter).toBe(';');
    expect(preview.ambiguousDates).toHaveLength(1);
    expect(preview.workbook.sheets[0].rows[0][1]).toBe('03/04/2026');
    const confirmed = parseDelimited(text, { headerRow: 1, delimiter: ';', dateFormat: 'dmy' });
    expect(confirmed.ambiguousDates).toHaveLength(0);
    expect(confirmed.workbook.sheets[0].rows[0][1]).toBe('2026-04-03');
    expect(confirmed.workbook.sheets[0].columns[1].type).toBe('date');
  });
  it('reports mixed columns and rejects invalid explicit types without substituting zero', () => {
    const mixed = parseDelimited('Value\n12\nhello\n');
    expect(mixed.issues.some((issue) => issue.type === 'mixed')).toBe(true);
    expect(mixed.workbook.sheets[0].rows).toEqual([[12], ['hello']]);
    const typed = parseDelimited('Value\n12\nhello\n', { columnTypes: { 0: 'number' } });
    expect(typed.workbook.sheets[0].rows[1][0]).toEqual({
      error: '#VALUE!',
      message: '“hello” is not a valid number.',
    });
    expect(typed.issues.some((issue) => issue.type === 'invalid')).toBe(true);
  });
  it('supports data without headers and quoted delimiters/newlines', () => {
    const preview = parseDelimited('"a,b",0\n"line\nvalue",2', { headerRow: -1 });
    expect(preview.workbook.sheets[0].rows).toEqual([
      ['a,b', 0],
      ['line\nvalue', 2],
    ]);
    expect(preview.workbook.sheets[0].columns[0].name).toBe('Column 1');
  });
  it('protects CSV formulas while keeping negative numeric values numeric', async () => {
    expect(protectCSVCell('=HYPERLINK("https://example.test")')).toMatch(/^'/);
    expect(protectCSVCell('  +SUM(1,2)')).toMatch(/^'/);
    expect(protectCSVCell('\t@SUM(1,2)')).toMatch(/^'/);
    expect(protectCSVCell(-12.5)).toBe(-12.5);
    const text = await exportCSV(sheet([['00001', -12.5, true, '=1+1']])).text();
    expect(text).toContain('"00001"');
    expect(text).toContain('"-12.5"');
    expect(text).toContain('"\'=1+1"');
  });
  it('reopens exported CSV blank cells separately from quoted empty text and numeric zero', async () => {
    const original = sheet([
      ['00001', 0, true, ''],
      ['9007199254740993', null, false, 'plain'],
    ]);
    const reopened = parseDelimited(await exportCSV(original).text());
    expect(reopened.workbook.sheets[0].rows).toEqual(original.rows);
  });
  it('handles encoding selection and rejects unsupported files and encodings', async () => {
    const bytes = Uint8Array.from([78, 97, 109, 101, 10, 67, 97, 102, 233]);
    const source = { name: 'data.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer };
    await expect(importFile(source)).rejects.toThrow('encoding');
    expect(
      (await importFile(source, { encoding: 'windows-1252' })).workbook.sheets[0].rows[0][0],
    ).toBe('Café');
    await expect(importFile({ ...source, name: 'macros.xlsm' })).rejects.toThrow('Macro-enabled');
    expect(() => parseDelimited('')).toThrow('empty');
    expect(() => parseDelimited('a,b\n"broken')).toThrow('parsed');
  });
});

describe('XLSX local import and results-only export', () => {
  it('roundtrips leading zeros, huge identifiers, blank, zero, booleans and errors across sheets', async () => {
    const input = workbook([
      ['000001', 0, true, '=HYPERLINK("https://example.test")'],
      ['9007199254740993', null, false, 'plain'],
      ['000003', { error: '#DIV/0!' }, true, ''],
    ]);
    input.sheets.push({
      id: 'second',
      name: 'Second',
      columns: [{ id: 'amount', name: 'Rate', type: 'percentage' }],
      rows: [[0.125], [0]],
    });
    const blob = await exportXLSX(input);
    const imported = await importFile(await file(blob, 'results.xlsx'));
    expect(imported.workbook.sheets[0].rows).toEqual(input.sheets[0].rows);
    expect(imported.workbook.sheets).toHaveLength(2);
    expect(imported.workbook.sheets[1].columns[0].type).toBe('percentage');
    expect(imported.workbook.sheets[1].rows).toEqual([[0.125], [0]]);
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(await blob.arrayBuffer());
    expect(excel.worksheets[0].getCell('D2').type).toBe(ExcelJS.ValueType.String);
    expect(excel.worksheets[0].getCell('D2').formula).toBeUndefined();
  });
  it('preserves imported formula metadata and labels cached values rather than recalculating', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Calculated');
    ws.addRow(['Value', 'Formula']);
    ws.addRow([4, { formula: 'A2*2', result: 8 }]);
    ws.addRow([5, { formula: '[unavailable.xlsx]Sheet1!A1' }]);
    const bytes = await source.xlsx.writeBuffer();
    const preview = await importFile({
      name: 'formula.xlsx',
      size: bytes.byteLength,
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    });
    expect(preview.workbook.sheets[0].rows).toEqual([
      [4, 8],
      [5, null],
    ]);
    expect(preview.workbook.sheets[0].formulae).toEqual({
      B2: 'A2*2',
      B3: '[unavailable.xlsx]Sheet1!A1',
    });
    const noHeader = await importFile(
      {
        name: 'formula.xlsx',
        size: bytes.byteLength,
        arrayBuffer: async () => new Uint8Array(bytes).buffer,
      },
      { headerRow: -1 },
    );
    expect(noHeader.workbook.sheets[0].formulae).toEqual({
      B3: 'A2*2',
      B4: '[unavailable.xlsx]Sheet1!A1',
    });
    expect(preview.warnings.join(' ')).toContain('cached');
    const output = await exportXLSX(preview.workbook);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await output.arrayBuffer());
    expect(restored.worksheets[0].getCell('B2').formula).toBeUndefined();
  });
  it('makes duplicate or invalid worksheet names safe', async () => {
    const input = workbook([['001', 0, true, 'text']]);
    input.sheets[0].name = 'Name/with:invalid?characters[!]';
    input.sheets.push({ ...structuredClone(input.sheets[0]), id: 'two' });
    const exported = await exportXLSX(input);
    const imported = await importFile(await file(exported, 'sheets.xlsx'));
    expect(new Set(imported.workbook.sheets.map((s) => s.name)).size).toBe(2);
  });
  it('imports Excel date-time and time-only cells without losing their time components', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Dates');
    ws.addRow(['Timestamp', 'Time']);
    ws.addRow([new Date('2026-04-03T12:30:00.000Z'), new Date('1899-12-30T09:15:00.000Z')]);
    ws.getCell('A2').numFmt = 'yyyy-mm-dd hh:mm';
    ws.getCell('B2').numFmt = 'hh:mm:ss';
    const bytes = await source.xlsx.writeBuffer();
    const preview = await importFile({
      name: 'dates.xlsx',
      size: bytes.byteLength,
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    });
    expect(preview.workbook.sheets[0].rows).toEqual([['2026-04-03T12:30:00.000Z', '09:15:00']]);
    expect(preview.workbook.sheets[0].columns.map((c) => c.type)).toEqual(['date', 'time']);
  });
  it('exports a generic currency unit instead of silently assigning dollars', async () => {
    const input: Workbook = {
      id: 'money',
      name: 'Money',
      sheets: [
        {
          id: 'money',
          name: 'Amounts',
          columns: [{ id: 'amount', name: 'Amount', type: 'currency' }],
          rows: [[1234.5]],
        },
      ],
    };
    const blob = await exportXLSX(input);
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(await blob.arrayBuffer());
    expect(excel.worksheets[0].getCell('A2').numFmt).toBe('"¤"#,##0.00');
    expect(String(excel.worksheets[0].getCell('A1').note)).toContain('does not specify a currency');
    const reopened = await importFile(await file(blob, 'currency.xlsx'));
    expect(reopened.workbook.sheets[0].columns[0].type).toBe('currency');
    expect(reopened.workbook.sheets[0].rows).toEqual([[1234.5]]);
  });
  it('retains native XLSX text cells even when their content looks numeric, boolean, or date-like', async () => {
    const input: Workbook = {
      id: 'typed',
      name: 'Typed',
      sheets: [
        {
          id: 'typed',
          name: 'Native types',
          columns: [
            { id: 'text', name: 'Literal text', type: 'text' },
            { id: 'mixed', name: 'Mixed values', type: 'mixed' },
          ],
          rows: [
            ['123', 123],
            ['true', '123'],
            ['2026-01-01', true],
          ],
        },
      ],
    };
    const blob = await exportXLSX(input),
      preview = await importFile(await file(blob, 'types.xlsx'));
    expect(preview.workbook.sheets[0].rows).toEqual(input.sheets[0].rows);
    expect(preview.workbook.sheets[0].columns.map((c) => c.type)).toEqual(['text', 'mixed']);
    const explicit = await importFile(await file(blob, 'types.xlsx'), {
      columnTypes: { 0: 'number' },
    });
    expect(explicit.workbook.sheets[0].rows[0][0]).toBe(123);
    expect(explicit.workbook.sheets[0].rows[1][0]).toMatchObject({ error: '#VALUE!' });
  });
  it('rejects ZIP expansion bombs, oversized sheets, encrypted entries and broken package structure before decompression', async () => {
    const blob = await exportXLSX(workbook([['0001', 3, true, 'text']]));
    const original = await blob.arrayBuffer();
    expect(() => validateXLSXArchive(original)).not.toThrow();
    const changeEntry = (
      match: (name: string) => boolean,
      change: (view: DataView, offset: number) => void,
    ) => {
      const copy = original.slice(0),
        view = new DataView(copy),
        bytes = new Uint8Array(copy);
      for (let i = 0; i < bytes.length - 46; i++)
        if (view.getUint32(i, true) === 0x02014b50) {
          const name = new TextDecoder().decode(
            bytes.subarray(i + 46, i + 46 + view.getUint16(i + 28, true)),
          );
          if (match(name)) {
            change(view, i);
            return copy;
          }
        }
      throw new Error('Test fixture ZIP entry not found');
    };
    const bomb = changeEntry(
      () => true,
      (view, offset) => view.setUint32(offset + 24, 101 * 1024 * 1024, true),
    );
    expect(() => validateXLSXArchive(bomb)).toThrow('100 MB');
    await expect(
      importFile({ name: 'bomb.xlsx', size: bomb.byteLength, arrayBuffer: async () => bomb }),
    ).rejects.toThrow('100 MB');
    const oversizedSheet = changeEntry(
      (name) => /^xl\/worksheets\/.*\.xml$/.test(name),
      (view, offset) => view.setUint32(offset + 24, 26 * 1024 * 1024, true),
    );
    expect(() => validateXLSXArchive(oversizedSheet)).toThrow('25 MB');
    const encrypted = changeEntry(
      () => true,
      (view, offset) => view.setUint16(offset + 8, 1, true),
    );
    expect(() => validateXLSXArchive(encrypted)).toThrow('encrypted');
    expect(() => validateXLSXArchive(original.slice(0, original.byteLength - 12))).toThrow(
      'directory',
    );
  });
});

describe('validated explicit project persistence', () => {
  it('roundtrips all cell distinctions, settings, operations and calculation history', () => {
    const input = workbook([
      ['000001', 0, true, ''],
      ['9007199254740993', null, false, '=text'],
    ]);
    const project = createProject(
      input,
      [
        {
          id: 'r1',
          functionName: 'SUM',
          taskName: 'Total',
          args: { data: [1, 2] },
          value: 3,
          warnings: [],
          duration: 2,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ],
      { threshold: 50 },
      {
        selectedSheetId: 'sheet',
        operations: [
          {
            id: 'op1',
            name: 'Total',
            functionName: 'SUM',
            args: { column: 'amount' },
            dependsOn: [],
          },
        ],
      },
    );
    expect(parseProject(serializeProject(project))).toEqual(project);
    const minimal = { version: 1 as const, workbook: input, history: [], operations: [] };
    expect(parseProject(serializeProject(minimal))).toEqual(minimal);
  });
  it('rejects invalid schema, nonfinite values and prototype pollution', () => {
    const project = createProject(createSampleWorkbook());
    expect(() => parseProject('{"__proto__":{"polluted":true}}')).toThrow('unsafe property');
    expect(() => parseProject(JSON.stringify({ ...project, version: 2 }))).toThrow('version');
    const broken = structuredClone(project);
    broken.workbook.sheets[0].rows[0] = [];
    expect(() => serializeProject(broken)).toThrow('rectangular');
    expect(() => serializeProject({ ...project, settings: { unsafe: Infinity } })).toThrow(
      'unsupported',
    );
    expect(() => parseProject('not JSON')).toThrow('valid project JSON');
  });
  it('writes only when save is explicitly called, and explains storage failures', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(loadLocalProject(storage)).toBeNull();
    const project = createProject(createSampleWorkbook('marks'));
    expect(data.size).toBe(0);
    saveLocalProject(project, storage);
    expect(loadLocalProject(storage)).toEqual(project);
    expect(() =>
      saveLocalProject(project, {
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).toThrow('Download');
  });
  it('includes realistic synthetic sample datasets and clones before editing', () => {
    expect(SAMPLE_DATASETS.map((s) => s.id)).toEqual([
      'sales',
      'employees',
      'marks',
      'attendance',
      'inventory',
      'research',
    ]);
    expect(createSampleWorkbook().sheets[0].rows.length).toBeGreaterThanOrEqual(8);
    const copy = createSampleWorkbook();
    copy.sheets[0].rows[0][0] = 'edited';
    expect(createSampleWorkbook().sheets[0].rows[0][0]).toBe('001001');
  });
});
