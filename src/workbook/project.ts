import type { CalculationResult, CellValue, DataType, Workbook } from '../engine/types';
import type { SavedOperation } from '../engine/bindings';

export interface AppProject {
  format?: 'sheetpilot';
  version: 1;
  savedAt?: string;
  workbook: Workbook;
  settings?: Record<string, any>;
  history: CalculationResult[];
  operations: SavedOperation[];
  selectedSheetId?: string;
  pipelines?: Record<string, unknown>[];
}
export type ProjectData = AppProject;
export const PROJECT_STORAGE_KEY = 'sheetpilot.project.v1';
export const PROJECT_MAX_BYTES = 20 * 1024 * 1024;
const types = new Set<DataType>([
  'text',
  'number',
  'boolean',
  'date',
  'time',
  'percentage',
  'currency',
  'mixed',
]);
const record = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
function invalid(message: string): never {
  throw new Error(`Invalid SheetPilot project: ${message}`);
}
const safeKeys = new Set(['__proto__', 'constructor', 'prototype']);
function validateJSON(value: unknown, depth = 0, counter = { nodes: 0 }): void {
  if (depth > 64 || ++counter.nodes > 1_500_000) invalid('data is too complex.');
  if (value === null || text(value) || typeof value === 'boolean' || finite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((v) => validateJSON(v, depth + 1, counter));
    return;
  }
  if (!record(value) || Object.getPrototypeOf(value) !== Object.prototype)
    invalid('unsupported value.');
  for (const [key, entry] of Object.entries(value)) {
    if (safeKeys.has(key)) invalid(`unsafe property “${key}”.`);
    if (entry === undefined) continue;
    validateJSON(entry, depth + 1, counter);
  }
}
function cell(value: unknown): value is CellValue {
  return (
    value === null ||
    text(value) ||
    finite(value) ||
    typeof value === 'boolean' ||
    (record(value) &&
      text(value.error) &&
      (value.message === undefined || text(value.message)) &&
      Object.keys(value).every((k) => k === 'error' || k === 'message'))
  );
}
export function validateWorkbook(value: unknown): asserts value is Workbook {
  if (
    !record(value) ||
    !text(value.id) ||
    !text(value.name) ||
    !Array.isArray(value.sheets) ||
    !value.sheets.length ||
    value.sheets.length > 200
  )
    invalid('a workbook needs between 1 and 200 worksheets.');
  const sheetIds = new Set<string>();
  let cellCount = 0;
  for (const sheet of value.sheets) {
    if (
      !record(sheet) ||
      !text(sheet.id) ||
      sheetIds.has(sheet.id) ||
      !text(sheet.name) ||
      !Array.isArray(sheet.columns) ||
      !sheet.columns.length ||
      sheet.columns.length > 16384 ||
      !Array.isArray(sheet.rows)
    )
      invalid('invalid worksheet.');
    sheetIds.add(sheet.id);
    const ids = new Set<string>();
    for (const column of sheet.columns) {
      if (
        !record(column) ||
        !text(column.id) ||
        ids.has(column.id) ||
        !text(column.name) ||
        !types.has(column.type)
      )
        invalid('invalid or duplicate column.');
      ids.add(column.id);
    }
    for (const row of sheet.rows) {
      if (!Array.isArray(row) || row.length !== sheet.columns.length || !row.every(cell))
        invalid('worksheet rows must contain rectangular, typed cells.');
      if ((cellCount += row.length) > 1_000_000) invalid('more than one million cells.');
    }
    if (sheet.source !== undefined && !text(sheet.source)) invalid('invalid worksheet source.');
    if (
      sheet.formulae !== undefined &&
      (!record(sheet.formulae) ||
        !Object.entries(sheet.formulae).every(
          ([address, formula]) => /^[A-Z]{1,3}[1-9]\d*$/.test(address) && text(formula),
        ))
    )
      invalid('invalid formula metadata.');
    for (const name of ['hiddenRows', 'filteredRows']) {
      if (
        sheet[name] !== undefined &&
        (!Array.isArray(sheet[name]) ||
          !sheet[name].every(
            (r: unknown) =>
              Number.isInteger(r) && (r as number) >= 0 && (r as number) < sheet.rows.length,
          ))
      )
        invalid('invalid row visibility metadata.');
    }
  }
}
export function createProject(
  workbook: Workbook,
  history: CalculationResult[] = [],
  settings: Record<string, unknown> = {},
  extra: Partial<Pick<ProjectData, 'operations' | 'pipelines' | 'selectedSheetId'>> = {},
): ProjectData {
  const project: ProjectData = {
    format: 'sheetpilot',
    version: 1,
    savedAt: new Date().toISOString(),
    workbook,
    history,
    settings,
    operations: [],
    ...extra,
  };
  validateProject(project);
  return structuredClone(project);
}
export function validateProject(value: unknown): asserts value is ProjectData {
  validateJSON(value);
  if (
    !record(value) ||
    (value.format !== undefined && value.format !== 'sheetpilot') ||
    value.version !== 1 ||
    (value.savedAt !== undefined &&
      (!text(value.savedAt) || !Number.isFinite(Date.parse(value.savedAt))))
  )
    invalid('unsupported format or version.');
  if (
    Object.keys(value).some(
      (k) =>
        ![
          'format',
          'version',
          'savedAt',
          'workbook',
          'settings',
          'history',
          'operations',
          'pipelines',
          'selectedSheetId',
        ].includes(k),
    )
  )
    invalid('unknown top-level field.');
  validateWorkbook(value.workbook);
  if (
    (value.settings !== undefined && !record(value.settings)) ||
    !Array.isArray(value.history) ||
    value.history.length > 10_000
  )
    invalid('invalid settings or calculation history.');
  if (
    value.selectedSheetId !== undefined &&
    (!text(value.selectedSheetId) ||
      !value.workbook.sheets.some((sheet: { id: string }) => sheet.id === value.selectedSheetId))
  )
    invalid('invalid selected worksheet.');
  for (const result of value.history) {
    if (
      !record(result) ||
      !text(result.id) ||
      !text(result.functionName) ||
      !text(result.taskName) ||
      !record(result.args) ||
      !text(result.timestamp) ||
      !Number.isFinite(Date.parse(result.timestamp)) ||
      !finite(result.duration) ||
      result.duration < 0 ||
      !Array.isArray(result.warnings) ||
      !result.warnings.every(text) ||
      !('value' in result)
    )
      invalid('invalid calculation history item.');
    if (result.settings !== undefined && !record(result.settings))
      invalid('invalid calculation settings.');
    if (
      result.inputs !== undefined &&
      (!Array.isArray(result.inputs) || !result.inputs.every(text))
    )
      invalid('invalid calculation inputs.');
    if (result.inputSheet !== undefined && !text(result.inputSheet))
      invalid('invalid calculation worksheet.');
  }
  if (!Array.isArray(value.operations) || value.operations.length > 10_000)
    invalid('invalid saved operations.');
  const operationIds = new Set<string>();
  for (const operation of value.operations) {
    if (
      !record(operation) ||
      !text(operation.id) ||
      operationIds.has(operation.id) ||
      !text(operation.name) ||
      !text(operation.functionName) ||
      !record(operation.args) ||
      !Array.isArray(operation.dependsOn) ||
      !operation.dependsOn.every(text)
    )
      invalid('invalid saved operation.');
    operationIds.add(operation.id);
  }
  if (
    value.pipelines !== undefined &&
    (!Array.isArray(value.pipelines) || !value.pipelines.every(record))
  )
    invalid('invalid pipelines.');
}
export function serializeProject(project: ProjectData): string {
  validateProject(project);
  const json = JSON.stringify(project, null, 2);
  if (new TextEncoder().encode(json).length > PROJECT_MAX_BYTES)
    throw new Error('This project exceeds the 20 MB save limit.');
  return json;
}
export function parseProject(json: string): ProjectData {
  if (new TextEncoder().encode(json).length > PROJECT_MAX_BYTES)
    throw new Error('This project exceeds the 20 MB open limit.');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('This is not valid project JSON.');
  }
  validateProject(value);
  return value;
}
/** Called only in response to the user choosing Save. There is no automatic background write. */
export function saveLocalProject(
  project: ProjectData,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  const json = serializeProject(project);
  try {
    storage.setItem(PROJECT_STORAGE_KEY, json);
  } catch {
    throw new Error(
      'Browser storage is full or unavailable. Download the project file to save it.',
    );
  }
}
export function loadLocalProject(
  storage: Pick<Storage, 'getItem'> = localStorage,
): ProjectData | null {
  const saved = storage.getItem(PROJECT_STORAGE_KEY);
  return saved === null ? null : parseProject(saved);
}
export const projectBlob = (project: ProjectData): Blob =>
  new Blob([serializeProject(project)], { type: 'application/json' });
