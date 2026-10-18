import Papa from 'papaparse';
import type {
  CellError,
  CellValue,
  Column,
  DataType,
  Sheet,
  Workbook,
  CalculationResult,
} from '../engine/types';

export type DateFormat = 'iso' | 'dmy' | 'mdy';
export interface ImportOptions {
  /** Zero-based header row. Set to -1 when the file has no header. */
  headerRow?: number;
  delimiter?: string;
  encoding?: string;
  dateFormat?: DateFormat;
  columnTypes?: Record<number, DataType>;
  name?: string;
}
export interface ImportIssue {
  type: 'blank' | 'mixed' | 'invalid' | 'identifier' | 'formula';
  message: string;
  sheet: string;
  column?: number;
  row?: number;
  count?: number;
}
export interface ImportPreview {
  workbook: Workbook;
  issues: ImportIssue[];
  warnings: string[];
  detectedDelimiter?: string;
  ambiguousDates: { sheet: string; column: number; examples: string[] }[];
}
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_CELLS = 250_000;
export const XLSX_MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isError = (v: unknown): v is CellError => Boolean(v && typeof v === 'object' && 'error' in v);
const idHeader = (name: string) =>
  /(?:\b(?:id|identifier|account|phone|telephone|mobile|postcode|zipcode|zip|roll|registration)\b|(?:employee|student|account|invoice|order|customer)[_\s-]?(?:id|number|no)$)/i.test(
    name,
  );
const unsafeInteger = (s: string) => /^[+-]?\d+$/.test(s) && !Number.isSafeInteger(Number(s));
const leadingZero = (s: string) => /^[+-]?0\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(s);
const validIsoDate = (y: number, m: number, d: number) => {
  const value = new Date(0);
  value.setUTCFullYear(y, m - 1, d);
  value.setUTCHours(0, 0, 0, 0);
  return value.getUTCFullYear() === y && value.getUTCMonth() === m - 1 && value.getUTCDate() === d;
};
function dateString(text: string, format?: DateFormat): string | undefined {
  const timestamp =
    /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      text,
    );
  if (
    timestamp &&
    validIsoDate(Number(timestamp[1]), Number(timestamp[2]), Number(timestamp[3])) &&
    Number.isFinite(Date.parse(text))
  )
    return new Date(text).toISOString();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = iso.slice(1).map(Number);
  else if (local && format && format !== 'iso') {
    y = Number(local[3]);
    m = Number(local[format === 'mdy' ? 1 : 2]);
    d = Number(local[format === 'mdy' ? 2 : 1]);
  } else return undefined;
  return validIsoDate(y, m, d)
    ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : undefined;
}
function identify(value: CellValue, header: string, format?: DateFormat): DataType {
  if (value === null || value === '') return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (isError(value)) return 'mixed';
  const s = value.trim();
  if (idHeader(header) || leadingZero(s) || unsafeInteger(s)) return 'text';
  if (/^(?:true|false)$/i.test(s)) return 'boolean';
  if (dateString(s, format)) return 'date';
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(s)) return 'time';
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*%$/.test(s)) return 'percentage';
  if (/^[+-]?[$€£¥₹₨¤]\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(s)) return 'currency';
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) && Number.isFinite(Number(s)))
    return 'number';
  return 'text';
}
function convert(value: CellValue, type: DataType, format?: DateFormat): CellValue {
  if (value === null || isError(value)) return value;
  if (type === 'mixed') return value;
  if (type === 'text') return typeof value === 'string' ? value : String(value);
  const s = String(value).trim();
  if (s === '') return value;
  if (type === 'boolean')
    return typeof value === 'boolean'
      ? value
      : /^(true|false)$/i.test(s)
        ? s.toLowerCase() === 'true'
        : { error: '#VALUE!', message: `“${s}” is not a boolean.` };
  if (type === 'date')
    return (
      dateString(s, format) ?? {
        error: '#VALUE!',
        message: `“${s}” is not a valid ${format ?? 'ISO'} date.`,
      }
    );
  if (type === 'time')
    return /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(s)
      ? s
      : { error: '#VALUE!', message: `“${s}” is not a valid time.` };
  let numberText = s;
  if (type === 'currency') numberText = s.replace(/[$€£¥₹₨¤,\s]/g, '');
  if (type === 'percentage') numberText = s.replace(/\s*%$/, '');
  const n = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numberText)
    ? Number(numberText)
    : NaN;
  return Number.isFinite(n)
    ? type === 'percentage' && /%$/.test(s)
      ? n / 100
      : n
    : { error: '#VALUE!', message: `“${s}” is not a valid ${type}.` };
}

/** Retains the meaningful distinction between an empty quoted field and an absent value. */
function quotedEmptyFields(text: string, delimiter: string): Set<string> {
  const empty = new Set<string>();
  let row = 0,
    column = 0,
    quoted = false,
    startedQuoted = false,
    contents = '';
  const finish = () => {
    if (startedQuoted && contents === '') empty.add(`${row}:${column}`);
    startedQuoted = false;
    contents = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        contents += '"';
        i++;
      } else if (quoted) quoted = false;
      else if (contents === '') {
        quoted = true;
        startedQuoted = true;
      } else contents += c;
    } else if (!quoted && c === delimiter) {
      finish();
      column++;
    } else if (!quoted && (c === '\r' || c === '\n')) {
      finish();
      row++;
      column = 0;
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else contents += c;
  }
  finish();
  return empty;
}

function makePreview(
  rawSheets: {
    name: string;
    rows: CellValue[][];
    formulae?: Record<string, string>;
    source?: string;
    types?: Record<number, DataType>;
  }[],
  options: ImportOptions,
): ImportPreview {
  const issues: ImportIssue[] = [],
    warnings: string[] = [];
  const ambiguousDates: ImportPreview['ambiguousDates'] = [];
  let cells = 0;
  const sheets = rawSheets.map((raw) => {
    const headerRow = options.headerRow ?? 0;
    if (
      !Number.isInteger(headerRow) ||
      headerRow < -1 ||
      (headerRow >= raw.rows.length && headerRow !== 0)
    )
      throw new Error('Select a header row inside the file.');
    const width = raw.rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (width > 16384 || (cells += width * raw.rows.length) > IMPORT_MAX_CELLS)
      throw new Error(
        `The import exceeds ${IMPORT_MAX_CELLS.toLocaleString()} cells. Split it into smaller datasets.`,
      );
    if (!width) throw new Error('This file contains no columns.');
    const names = Array.from({ length: width }, (_, c) =>
      headerRow >= 0
        ? String(raw.rows[headerRow]?.[c] ?? '').trim() || `Column ${c + 1}`
        : `Column ${c + 1}`,
    );
    const data = raw.rows
      .slice(headerRow >= 0 ? headerRow + 1 : 0)
      .map((r) => Array.from({ length: width }, (_, c) => r[c] ?? null));
    const columns: Column[] = names.map((name, c) => {
      const values = data.map((r) => r[c]);
      const nonblank = values.filter((v) => v !== null && v !== '');
      // XLSX stores real cell types. Explicit text such as "123" or "true" must stay text.
      const identifyImported = (v: CellValue): DataType =>
        raw.source !== 'XLSX'
          ? identify(v, name, options.dateFormat)
          : typeof v === 'string'
            ? options.dateFormat && dateString(v.trim(), options.dateFormat) && !idHeader(name)
              ? 'date'
              : 'text'
            : typeof v === 'number'
              ? 'number'
              : typeof v === 'boolean'
                ? 'boolean'
                : isError(v)
                  ? 'mixed'
                  : 'text';
      const detected = new Set(nonblank.map(identifyImported));
      const inferred =
        detected.size === 1 ? [...detected][0] : detected.size === 0 ? 'text' : 'mixed';
      let type: DataType =
        options.columnTypes?.[c] ?? (detected.size > 1 ? 'mixed' : (raw.types?.[c] ?? inferred));
      if (!options.columnTypes?.[c] && idHeader(name)) type = 'text';
      const blanks = values.filter((v) => v === null).length;
      if (blanks)
        issues.push({
          type: 'blank',
          sheet: raw.name,
          column: c,
          count: blanks,
          message: `${name}: ${blanks} blank ${blanks === 1 ? 'cell' : 'cells'}.`,
        });
      if (type === 'mixed')
        issues.push({
          type: 'mixed',
          sheet: raw.name,
          column: c,
          message: `${name} contains mixed data types; original values are preserved.`,
        });
      const ambiguous = nonblank.filter(
        (v) => typeof v === 'string' && /^(\d{1,2})[/.\-](\d{1,2})[/.\-]\d{4}$/.test(v.trim()),
      ) as string[];
      if (ambiguous.length && !options.dateFormat)
        ambiguousDates.push({
          sheet: raw.name,
          column: c,
          examples: [...new Set(ambiguous)].slice(0, 3),
        });
      const identifiers = nonblank.filter(
        (v) => typeof v === 'string' && (leadingZero(v.trim()) || unsafeInteger(v.trim())),
      );
      if (identifiers.length || idHeader(name))
        issues.push({
          type: 'identifier',
          sheet: raw.name,
          column: c,
          message: `${name}: identifiers are kept as text to preserve leading zeros and precision. Large numeric values already rounded by Excel cannot be recovered.`,
        });
      const preserveNative =
        raw.source === 'XLSX' &&
        options.columnTypes?.[c] === undefined &&
        !idHeader(name) &&
        !(options.dateFormat && type === 'date');
      if (!preserveNative && type === 'mixed')
        data.forEach((row) => {
          row[c] = convert(row[c], identifyImported(row[c]), options.dateFormat);
        });
      else if (!preserveNative)
        data.forEach((row) => {
          row[c] = convert(row[c], type, options.dateFormat);
        });
      data.forEach((row, r) => {
        if (isError(row[c]))
          issues.push({
            type: 'invalid',
            sheet: raw.name,
            column: c,
            row: r,
            message: `${name}, row ${r + 1}: ${(row[c] as CellError).message ?? (row[c] as CellError).error}`,
          });
      });
      return { id: `column-${c + 1}`, name, type };
    });
    const formulae: Record<string, string> = {};
    for (const [address, formula] of Object.entries(raw.formulae ?? {})) {
      const match = /^([A-Z]+)(\d+)$/.exec(address);
      // Addresses include the worksheet header at row 1, like the grid/reference model.
      if (match && Number(match[2]) > headerRow + 1)
        formulae[`${match[1]}${Number(match[2]) - (headerRow >= 0 ? headerRow : -1)}`] = formula;
    }
    if (Object.keys(formulae).length) {
      issues.push({
        type: 'formula',
        sheet: raw.name,
        count: Object.keys(formulae).length,
        message:
          'Imported formulas show stored cached values only. SheetPilot does not recalculate imported Excel formulas or fetch external links.',
      });
      warnings.push(
        `${raw.name}: imported formula cells contain cached values, which may be stale or blank.`,
      );
    }
    return {
      id: uid(),
      name: raw.name,
      columns,
      rows: data,
      formulae,
      source: raw.source,
    } satisfies Sheet;
  });
  if (ambiguousDates.length)
    warnings.push(
      'Confirm day/month/year or month/day/year before treating slash-separated dates as dates. They currently remain text.',
    );
  return {
    workbook: { id: uid(), name: options.name ?? 'Imported workbook', sheets },
    issues,
    warnings,
    ambiguousDates,
  };
}

export function parseDelimited(text: string, options: ImportOptions = {}): ImportPreview {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES)
    throw new Error('The file is larger than the 20 MB import limit.');
  if (!text.trim()) throw new Error('The file is empty.');
  if (options.delimiter && (options.delimiter.length !== 1 || /["\r\n]/.test(options.delimiter)))
    throw new Error('Choose a single valid delimiter character.');
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimiter: options.delimiter,
    dynamicTyping: false,
    skipEmptyLines: false,
  });
  const severe = parsed.errors.filter((e) => e.type === 'Quotes');
  if (severe.length) throw new Error(`CSV could not be parsed: ${severe[0].message}`);
  const delimiter = parsed.meta.delimiter || options.delimiter || ',';
  const quoted = quotedEmptyFields(text.replace(/^\uFEFF/, ''), delimiter);
  let rows = parsed.data.map((row, r) =>
    row.map((v, c) => (v === '' && !quoted.has(`${r}:${c}`) ? null : v)),
  );
  if (/[\r\n]$/.test(text) && rows.at(-1)?.every((v) => v === null)) rows = rows.slice(0, -1);
  const preview = makePreview(
    [{ name: options.name?.replace(/\.[^.]+$/, '') ?? 'Imported data', rows, source: 'CSV' }],
    options,
  );
  preview.detectedDelimiter = delimiter;
  const widths = rows.map((row) => row.length);
  if (new Set(widths).size > 1)
    preview.warnings.push(
      'Rows have different field counts. Missing fields are kept as blank cells.',
    );
  return preview;
}

function xlsxCell(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().replace(/T00:00:00\.000Z$/, '');
  if (typeof value === 'number')
    return Number.isFinite(value)
      ? value
      : { error: '#NUM!', message: 'Non-finite number in workbook.' };
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, any>;
    if ('formula' in v || 'sharedFormula' in v) return xlsxCell(v.result);
    if ('error' in v) return { error: String(v.error) };
    if (Array.isArray(v.richText)) return v.richText.map((r: { text: string }) => r.text).join('');
    if ('text' in v) return String(v.text);
  }
  return String(value);
}

/** Inspect the ZIP directory before ExcelJS expands XML. ZIP64/encrypted packages are deliberately unsupported. */
export function validateXLSXArchive(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  const reject = (message: string): never => {
    throw new Error(`Unsafe or invalid XLSX structure: ${message}`);
  };
  if (bytes.length < 22) reject('the ZIP directory is missing.');
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === bytes.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0) reject('the ZIP directory is missing or truncated.');
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    directory = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count
  )
    reject('split archives are unsupported.');
  if (count === 0xffff || size === 0xffffffff || directory === 0xffffffff)
    reject('ZIP64 archives are unsupported.');
  if (!count || count > 10_000 || directory + size > end)
    reject('invalid archive entry count or directory size.');
  let offset = directory,
    expanded = 0;
  const names = new Set<string>();
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > directory + size || view.getUint32(offset, true) !== 0x02014b50)
      reject('a ZIP entry is truncated.');
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true),
      uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true),
      extraLength = view.getUint16(offset + 30, true),
      commentLength = view.getUint16(offset + 32, true),
      local = view.getUint32(offset + 42, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (
      next > directory + size ||
      local + 30 > directory ||
      compressed > bytes.length ||
      view.getUint32(local, true) !== 0x04034b50
    )
      reject('a ZIP entry has invalid offsets.');
    if (flags & 1 || ![0, 8].includes(method)) reject('encrypted or unsupported ZIP compression.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!name || names.has(name) || /(?:^\/|\\|(?:^|\/)\.\.(?:\/|$))/.test(name))
      reject('duplicate or unsafe archive path.');
    names.add(name);
    if (uncompressed === 0xffffffff || (expanded += uncompressed) > XLSX_MAX_EXPANDED_BYTES)
      reject('expanded workbook exceeds the 100 MB safety limit.');
    if (/^xl\/worksheets\/.*\.xml$/i.test(name) && uncompressed > 25 * 1024 * 1024)
      reject('a worksheet XML exceeds the 25 MB safety limit.');
    const localNameLength = view.getUint16(local + 26, true),
      localExtraLength = view.getUint16(local + 28, true);
    if (local + 30 + localNameLength + localExtraLength + compressed > directory)
      reject('a ZIP entry overlaps the directory.');
    offset = next;
  }
  if (
    offset !== directory + size ||
    !names.has('[Content_Types].xml') ||
    !names.has('xl/workbook.xml')
  )
    reject('required workbook package entries are missing.');
}

export async function importFile(
  file: File | { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
  options: ImportOptions = {},
): Promise<ImportPreview> {
  if (file.size > IMPORT_MAX_BYTES)
    throw new Error('The file is larger than the 20 MB import limit.');
  if (!file.size) throw new Error('The file is empty.');
  const name = options.name ?? file.name.replace(/\.[^.]+$/, '');
  const bytes = await file.arrayBuffer();
  if (/\.(?:csv|tsv|txt)$/i.test(file.name)) {
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(options.encoding ?? 'utf-8', { fatal: true });
    } catch {
      throw new Error('Choose a supported text encoding.');
    }
    let text: string;
    try {
      text = decoder.decode(bytes);
    } catch {
      throw new Error(
        'This file does not match the selected encoding. Choose the file’s encoding and try again.',
      );
    }
    return parseDelimited(text, {
      ...options,
      name,
      delimiter: options.delimiter ?? (/\.tsv$/i.test(file.name) ? '\t' : undefined),
    });
  }
  if (!/\.xlsx$/i.test(file.name))
    throw new Error(
      'Choose a CSV, TSV, TXT, or XLSX file. Macro-enabled and legacy Excel files are not supported.',
    );
  if (new Uint8Array(bytes)[0] !== 0x50 || new Uint8Array(bytes)[1] !== 0x4b)
    throw new Error('This is not a valid XLSX file.');
  validateXLSXArchive(bytes);
  const ExcelJS = (await import('exceljs')).default;
  const excel = new ExcelJS.Workbook();
  try {
    await excel.xlsx.load(bytes);
  } catch {
    throw new Error(
      'The XLSX file is damaged, encrypted, or unsupported. Export an unencrypted XLSX copy and try again.',
    );
  }
  if (!excel.worksheets.length) throw new Error('The workbook contains no worksheets.');
  let cells = 0;
  const rawSheets = excel.worksheets
    .filter((sheet) => sheet.rowCount > 0 && sheet.columnCount > 0)
    .map((sheet) => {
      const width = sheet.columnCount,
        height = sheet.rowCount;
      if ((cells += width * height) > IMPORT_MAX_CELLS)
        throw new Error(
          `The import exceeds ${IMPORT_MAX_CELLS.toLocaleString()} cells. Split it into smaller datasets.`,
        );
      const formulae: Record<string, string> = {},
        types: Record<number, DataType> = {};
      const rows: CellValue[][] = [];
      for (let r = 1; r <= height; r++) {
        const row: CellValue[] = [];
        for (let c = 1; c <= width; c++) {
          const cell = sheet.getCell(r, c);
          if (cell.type === ExcelJS.ValueType.Formula) formulae[cell.address] = cell.formula ?? '';
          const timeOnly =
            cell.value instanceof Date &&
            /[hs]/i.test((cell.numFmt ?? '').replace(/"[^"]*"/g, '')) &&
            !/[yd]/i.test((cell.numFmt ?? '').replace(/"[^"]*"/g, ''));
          if (r > (options.headerRow ?? 0) + 1 && cell.value instanceof Date)
            types[c - 1] = timeOnly ? 'time' : 'date';
          else if (r > (options.headerRow ?? 0) + 1 && typeof cell.value === 'number') {
            if (cell.numFmt?.includes('%')) types[c - 1] = 'percentage';
            else if (/[$€£¥₹₨¤]/.test(cell.numFmt ?? '')) types[c - 1] = 'currency';
          }
          row.push(
            timeOnly && cell.value instanceof Date
              ? cell.value.toISOString().slice(11, 19)
              : xlsxCell(cell.value),
          );
        }
        rows.push(row);
      }
      return { name: sheet.name, rows, formulae, types, source: 'XLSX' };
    });
  if (!rawSheets.length) throw new Error('The workbook contains no data.');
  return makePreview(rawSheets, { ...options, name });
}

/** CSV consumers may execute text as formulas. A leading apostrophe forces literal text. */
export function protectCSVCell(value: CellValue): string | number | boolean {
  if (value === null) return '';
  if (isError(value)) return value.error;
  if (typeof value !== 'string') return value;
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}
export function exportCSV(sheet: Sheet): Blob {
  // Papa emits null as an unquoted absent field and empty text as "", preserving the distinction on reopen.
  const rows = [
    sheet.columns.map((c) => protectCSVCell(c.name)),
    ...sheet.rows.map((row) => row.map((value) => (value === null ? null : protectCSVCell(value)))),
  ];
  return new Blob(['\uFEFF', Papa.unparse(rows, { quotes: true, newline: '\r\n' })], {
    type: 'text/csv;charset=utf-8',
  });
}
const excelErrors = new Set(['#N/A', '#REF!', '#NAME?', '#DIV/0!', '#NULL!', '#VALUE!', '#NUM!']);
export async function exportXLSX(workbook: Workbook): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const excel = new ExcelJS.Workbook();
  excel.creator = 'SheetPilot';
  excel.created = new Date();
  const used = new Set<string>();
  for (const input of workbook.sheets) {
    let name = input.name.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Sheet';
    const base = name;
    let index = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${index++})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    const sheet = excel.addWorksheet(name);
    sheet.addRow(input.columns.map((c) => c.name));
    input.columns.forEach((column, index) => {
      if (column.type === 'currency')
        sheet.getCell(1, index + 1).note =
          'Currency amount. The generic ¤ marker does not specify a currency or perform conversion. Confirm units from your source data.';
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF326C51' } };
    input.rows.forEach((row, r) =>
      row.forEach((value, c) => {
        const cell = sheet.getCell(r + 2, c + 1);
        if (isError(value))
          cell.value = { error: excelErrors.has(value.error) ? (value.error as any) : '#VALUE!' };
        else cell.value = value; // Strings are explicit XLSX strings, never formulas; metadata is not executed.
        const type = input.columns[c]?.type;
        if (typeof value === 'number' && type === 'percentage') cell.numFmt = '0.00%';
        else if (typeof value === 'number' && type === 'currency') cell.numFmt = '"¤"#,##0.00';
      }),
    );
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const data = await excel.xlsx.writeBuffer();
  return new Blob([new Uint8Array(data)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
export function resultSheet(result: CalculationResult): Sheet {
  const value = result.value;
  const rows: CellValue[][] = Array.isArray(value)
    ? Array.isArray(value[0])
      ? value
      : value.map((v) => [v])
    : [[value]];
  const width = Math.max(1, ...rows.map((row) => row.length));
  return {
    id: uid(),
    name: result.taskName,
    columns: Array.from({ length: width }, (_, c) => ({
      id: `result-${c}`,
      name: width === 1 ? 'Result' : `Result ${c + 1}`,
      type: 'mixed',
    })),
    rows: rows.map((row) =>
      Array.from({ length: width }, (_, c) => {
        const v = row[c] ?? null;
        return typeof v === 'object' && v !== null && !isError(v) ? JSON.stringify(v) : v;
      }),
    ),
  };
}
export const exportResultCSV = (result: CalculationResult): Blob => exportCSV(resultSheet(result));
export const exportResultXLSX = (result: CalculationResult): Promise<Blob> =>
  exportXLSX({ id: uid(), name: result.taskName, sheets: [resultSheet(result)] });
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
