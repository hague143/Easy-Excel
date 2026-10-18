import type { Workbook, CalculationResult, CellValue } from './types';
import { CalcError } from './types';
import { compareInputs } from './comparison';
export type Binding = {
  __source: 'column' | 'range' | 'table' | 'result' | 'literal';
  sheetId?: string;
  columnId?: string;
  range?: string;
  resultId?: string;
  text?: string;
  headers?: boolean;
};
export function parseLiteral(text: string): any {
  if (!text.trim()) return null;
  if (/^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      throw new CalcError(
        '#VALUE!',
        'This structured value is invalid. Use the example as a guide.',
      );
    }
  }
  if (text.includes('\n') || text.includes('\t'))
    return text
      .replace(/\r?\n$/, '')
      .split(/\r?\n/)
      .map((r) => r.split('\t').map(parseScalar));
  if (text.includes(',')) return text.split(',').map(parseScalar);
  return parseScalar(text);
}
export function parseScalar(value: string): CellValue {
  if (value === '') return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^#(VALUE!|N\/A|DIV\/0!|NUM!|REF!|NAME\?|NULL!|SPILL!|CALC!)$/.test(value))
    return { error: value };
  if (
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) &&
    !/^[-+]?0\d/.test(value) &&
    value.replace(/[^\d]/g, '').length <= 15 &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return value;
}
export function colIndex(label: string): number {
  return (
    label
      .toUpperCase()
      .split('')
      .reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1
  );
}
export function colLetter(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function resolveBindings(value: any, workbook: Workbook, history: CalculationResult[]): any {
  if (Array.isArray(value)) return value.map((v) => resolveBindings(v, workbook, history));
  if (value && typeof value === 'object' && '__comparison' in value) {
    const c = value.__comparison;
    return compareInputs(
      resolveBindings(c.left, workbook, history),
      resolveBindings(c.right, workbook, history),
      c.operator,
    );
  }
  if (value && typeof value === 'object' && '__source' in value) {
    const b = value as Binding;
    if (b.__source === 'literal') return parseLiteral(b.text || '');
    if (b.__source === 'result') {
      const r = history.find((h) => h.id === b.resultId);
      if (!r) throw new CalcError('#REF!', 'Choose an available previous result.');
      return r.value;
    }
    const sheet = workbook.sheets.find((s) => s.id === b.sheetId);
    if (!sheet) throw new CalcError('#REF!', 'Choose an input worksheet.');
    if (b.__source === 'table')
      return b.headers ? [sheet.columns.map((c) => c.name), ...sheet.rows] : sheet.rows;
    if (b.__source === 'column') {
      const i = sheet.columns.findIndex((c) => c.id === b.columnId);
      if (i < 0) throw new CalcError('#REF!', 'Choose an input column.');
      return sheet.rows.map((r) => r[i] ?? null);
    }
    const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(b.range || '');
    if (!m) throw new CalcError('#REF!', 'Choose a range such as A1:C6. Row 1 is the header.');
    const c1 = colIndex(m[1]),
      r1 = Number(m[2]) - 1,
      c2 = colIndex(m[3] || m[1]),
      r2 = Number(m[4] || m[2]) - 1;
    if (
      r1 < 0 ||
      r2 < 0 ||
      c1 < 0 ||
      r1 > r2 ||
      c1 > c2 ||
      r2 > sheet.rows.length ||
      c2 >= sheet.columns.length
    )
      throw new CalcError('#REF!', 'The selected range is outside this worksheet.');
    const rows = [sheet.columns.map((c) => c.name), ...sheet.rows];
    return rows.slice(r1, r2 + 1).map((r) => r.slice(c1, c2 + 1));
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveBindings(v, workbook, history)]),
    );
  return value;
}
export interface SavedOperation {
  id: string;
  name: string;
  functionName: string;
  args: Record<string, any>;
  dependsOn: string[];
}
export function operationOrder(operations: SavedOperation[]): SavedOperation[] {
  if (new Set(operations.map((o) => o.id)).size !== operations.length)
    throw new CalcError('#REF!', 'Duplicate operation IDs are not allowed.');
  const ordered: SavedOperation[] = [],
    visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (op: SavedOperation) => {
    if (visiting.has(op.id))
      throw new CalcError('#REF!', 'Circular calculation dependency detected.');
    if (done.has(op.id)) return;
    visiting.add(op.id);
    for (const id of op.dependsOn) {
      const dep = operations.find((o) => o.id === id);
      if (!dep) throw new CalcError('#REF!', `Missing pipeline operation: ${id}`);
      visit(dep);
    }
    visiting.delete(op.id);
    done.add(op.id);
    ordered.push(op);
  };
  operations.forEach(visit);
  return ordered;
}
