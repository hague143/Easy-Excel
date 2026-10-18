import { baseFunctions } from './base';
import { numericFunctions } from './numeric';
import { advancedFunctions } from './advanced';
import { workflowFunctions } from '../workflows';
import { CalcError } from './types';
import type { CalculationResult, CalcContext, FunctionDef } from './types';

export const functions: FunctionDef[] = [
  ...workflowFunctions,
  ...baseFunctions,
  ...numericFunctions,
  ...advancedFunctions,
];
export const registry = new Map(functions.map((def) => [def.name, def]));
if (registry.size !== functions.length) throw new Error('Duplicate function names in registry.');
function normalize(value: any): any {
  if (value instanceof Error)
    return {
      error: value.message.startsWith('#') ? value.message : '#VALUE!',
      message: value.message,
    };
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && !Number.isFinite(value))
    return { error: '#NUM!', message: 'The calculation did not produce a finite number.' };
  if (value === undefined) return { error: '#N/A', message: 'No result was returned.' };
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
}
export function execute(
  name: string,
  args: Record<string, any>,
  context: CalcContext = {},
): CalculationResult {
  const start = performance.now();
  const def = registry.get(name);
  const actual = { ...def?.defaults, ...args };
  let value: any;
  const warnings: string[] = [];
  try {
    if (!def) throw new CalcError('#NAME?', `Unknown function: ${name}`);
    for (const input of def.inputs) {
      if (actual[input.key] === undefined && input.default !== undefined)
        actual[input.key] = input.default;
      if (input.required && actual[input.key] === undefined)
        throw new CalcError('#VALUE!', `Choose ${input.label.toLowerCase()} before calculating.`);
    }
    const rowKeys: string[] = actual.__rowWise || [];
    if (rowKeys.length) {
      const arrays = rowKeys.map((key) => {
        const v = actual[key];
        if (Array.isArray(v[0])) {
          if (v.length !== 1 && v.some((r: any) => !Array.isArray(r) || r.length !== 1))
            throw new CalcError(
              '#VALUE!',
              'A scalar input can use one row or column, rather than a rectangular table.',
            );
          return v.flat();
        }
        return v;
      });
      const count = Math.max(...arrays.map((a) => a.length));
      if (arrays.some((a) => a.length !== count))
        throw new CalcError('#VALUE!', 'Row-based input columns must have equal lengths.');
      value = Array.from({ length: count }, (_, i) => {
        const row = {
          ...actual,
          ...Object.fromEntries(rowKeys.map((key, j) => [key, arrays[j][i]])),
        };
        try {
          def.validate?.(row, context);
          return normalize(def.calculate(row, context));
        } catch (e) {
          return {
            error: e instanceof CalcError ? e.code : '#VALUE!',
            message: e instanceof Error ? e.message : String(e),
          };
        }
      });
    } else {
      def.validate?.(actual, context);
      value = normalize(def.calculate(actual, context));
    }
    const errors = JSON.stringify(value).match(/"error":/g)?.length || 0;
    if (errors)
      warnings.push(
        `${errors} calculation error${errors > 1 ? 's' : ''}. Valid row results are preserved.`,
      );
    if (
      (/^(SUM|AVERAGE|MIN|MAX|COUNT|PRODUCT|MEDIAN|GEOMEAN|HARMEAN)$/.test(name) ||
        /^(MODE|STDEV|VAR)\./.test(name)) &&
      Array.isArray(actual.data) &&
      !name.endsWith('IF') &&
      !name.endsWith('IFS') &&
      name !== 'SUMPRODUCT'
    ) {
      const data = actual.data.flat(Infinity),
        blanks = data.filter((v: any) => v === null).length,
        text = data.filter((v: any) => typeof v === 'string' || typeof v === 'boolean').length;
      if (blanks || text)
        warnings.unshift(
          `${blanks} blank and ${text} text/logical cells were ignored in this numeric calculation.`,
        );
    }
    if (def.compatibility.length) warnings.push(...def.compatibility);
  } catch (e) {
    value = {
      error: e instanceof CalcError ? e.code : '#VALUE!',
      message: e instanceof Error ? e.message : String(e),
    };
  }
  return {
    id: crypto.randomUUID(),
    functionName: name,
    taskName: def?.friendlyName || name,
    value,
    args: actual,
    timestamp: new Date().toISOString(),
    warnings,
    duration: performance.now() - start,
  };
}

const normalizeText = (s: string) =>
  s.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();
function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}
export function searchFunctions(query: string, category = 'All'): FunctionDef[] {
  const q = normalizeText(query);
  return functions
    .filter((f) => category === 'All' || f.categories.includes(category))
    .map((f) => {
      const n = normalizeText(f.name),
        friendly = normalizeText(f.friendlyName),
        aliases = f.aliases.map(normalizeText);
      const hay = [
        n,
        friendly,
        ...aliases,
        ...f.categories.map(normalizeText),
        normalizeText(f.description),
      ];
      let score = !q
        ? 1
        : n === q
          ? 100
          : aliases.includes(q)
            ? 95
            : friendly === q
              ? 90
              : n.startsWith(q)
                ? 80
                : hay.some((s) => s.includes(q))
                  ? 65
                  : q.split(' ').every((t) => hay.some((s) => s.includes(t)))
                    ? 50
                    : q.length > 2 && [n, ...aliases].some((s) => distance(q, s) <= 1)
                      ? 30
                      : 0;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.friendlyName.localeCompare(b.f.friendlyName))
    .map((x) => x.f);
}
