export type CellError = { error: string; message?: string };
export type CellValue = string | number | boolean | null | CellError;
export type DataType =
  'text' | 'number' | 'boolean' | 'date' | 'time' | 'percentage' | 'currency' | 'mixed';
export interface Column {
  id: string;
  name: string;
  type: DataType;
}
export interface Sheet {
  id: string;
  name: string;
  columns: Column[];
  rows: CellValue[][];
  formulae?: Record<string, string>;
  hiddenRows?: number[];
  filteredRows?: number[];
  source?: string;
}
export interface Workbook {
  id: string;
  name: string;
  sheets: Sheet[];
}
export interface ModelProvider {
  id: string;
  label: string;
  demo: boolean;
  members(dimension: string): string[];
  value(measure: string, filters: Record<string, string>): number;
}
export interface CalcContext {
  workbook?: Workbook;
  sheetId?: string;
  now?: string;
  providers?: Record<string, ModelProvider>;
}
export type InputType =
  | 'data'
  | 'matrix'
  | 'number'
  | 'text'
  | 'boolean'
  | 'select'
  | 'date'
  | 'operations'
  | 'conditions'
  | 'column'
  | 'sheet';
export interface InputDef {
  key: string;
  label: string;
  type: InputType;
  required?: boolean;
  default?: any;
  description?: string;
  options?: (string | { label: string; value: string | number })[];
}
export interface FunctionExample {
  args: Record<string, any>;
  expected: any;
  context?: CalcContext;
  tolerance?: number;
}
export interface FunctionDef {
  name: string;
  friendlyName: string;
  categories: string[];
  aliases: string[];
  description: string;
  inputs: InputDef[];
  output: string;
  defaults?: Record<string, any>;
  example: FunctionExample;
  compatibility: string[];
  testRefs: string[];
  external?: boolean;
  validate?: (args: Record<string, any>, context: CalcContext) => void;
  calculate: (args: Record<string, any>, context: CalcContext) => any;
}
export interface CalculationResult {
  id: string;
  functionName: string;
  taskName: string;
  value: any;
  args: Record<string, any>;
  settings?: Record<string, any>;
  inputSheet?: string;
  inputs?: string[];
  timestamp: string;
  warnings: string[];
  duration: number;
}
export class CalcError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CalcError';
  }
}
export function fail(code: string, message: string): never {
  throw new CalcError(code, message);
}
export const flatten = (value: any): any[] =>
  Array.isArray(value) ? value.flat(Infinity) : [value];
export const numbers = (value: any): number[] => {
  const values = flatten(value);
  for (const v of values)
    if (v && typeof v === 'object' && 'error' in v) fail(v.error, v.message || v.error);
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
};
export const numeric = (value: any, label = 'Value'): number => {
  if (value === null || value === '') return 0;
  const n = typeof value === 'boolean' ? Number(value) : Number(value);
  if (!Number.isFinite(n)) fail('#VALUE!', `${label} must be numeric.`);
  return n;
};
export const matrix = (value: any): any[][] => {
  const m = Array.isArray(value)
    ? Array.isArray(value[0])
      ? value
      : value.map((v) => [v])
    : [[value]];
  if (!m.length || !m[0]?.length || m.some((r: any[]) => r.length !== m[0].length))
    fail('#VALUE!', 'Select a nonempty rectangular range.');
  return m;
};
