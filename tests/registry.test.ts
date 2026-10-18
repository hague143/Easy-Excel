import { accessSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { execute, functions, registry, searchFunctions } from '../src/engine/registry';

const spec = readFileSync(resolve('docs/PRODUCT_SPEC.md'), 'utf8');
const section = spec.split('## 7. Required function catalogue')[1].split('## 8.')[0];
const required = [
  ...new Set(
    section
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\.$/, ''))
      .filter((line) => /^[A-Z][A-Z0-9.]*(?:,\s*[A-Z][A-Z0-9.]*)+$/.test(line))
      .flatMap((line) => line.split(/,\s*/)),
  ),
];

function compare(actual: any, expected: any, tolerance: number) {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
      tolerance * Math.max(1, Math.abs(expected)),
    );
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBe(expected.length);
    expected.forEach((v, i) => compare(actual[i], v, tolerance));
  } else if (expected && typeof expected === 'object') {
    expect(actual).toBeTypeOf('object');
    for (const [key, value] of Object.entries(expected)) compare(actual[key], value, tolerance);
  } else expect(actual).toEqual(expected);
}

describe('central calculation registry acceptance', () => {
  it('implements every unique function explicitly required in specification section 7', () => {
    expect(required).toHaveLength(261);
    const missing = required.filter((name) => !registry.has(name));
    expect(missing).toEqual([]);
    expect(registry.size).toBe(functions.length);
  });
  for (const f of functions) {
    it(`${f.name} has complete typed catalogue metadata and a working independent expected-result example`, () => {
      expect(f.name).toMatch(/^(?:WF\.[A-Z][A-Z0-9_]*|[A-Z][A-Z0-9]*(?:\.[A-Z0-9]+)*)$/);
      expect(f.friendlyName.trim().length).toBeGreaterThan(0);
      expect(f.description.trim().length).toBeGreaterThan(10);
      expect(f.categories.length).toBeGreaterThan(0);
      expect(f.aliases.length).toBeGreaterThan(0);
      expect(f.compatibility.length).toBeGreaterThan(0);
      expect(f.testRefs.length).toBeGreaterThan(0);
      expect(typeof f.calculate).toBe('function');
      expect(f.output.trim().length).toBeGreaterThan(0);
      expect(new Set(f.inputs.map((i) => i.key)).size).toBe(f.inputs.length);
      f.inputs.forEach((input) => {
        expect(input.label.trim()).not.toBe('');
        expect(input.key.trim()).not.toBe('');
        if (input.type === 'select') expect(input.options?.length).toBeGreaterThan(0);
      });
      f.testRefs.forEach((ref) => {
        const path = ref.split(/\s+[—–>\-]\s+/)[0];
        expect(() => accessSync(resolve(path)), `Missing referenced suite ${path}`).not.toThrow();
      });
      expect(f.example).toHaveProperty('args');
      expect(f.example).toHaveProperty('expected');
      // Deterministic RNG input isolates the adapter from randomness; the RAND result is independently known.
      const rng = f.name === 'RAND' ? vi.spyOn(Math, 'random').mockReturnValue(0.25) : undefined;
      try {
        const result = execute(f.name, f.example.args, f.example.context ?? {});
        compare(
          result.value,
          f.name === 'RAND' ? 0.25 : f.example.expected,
          f.name === 'RAND' ? 1e-12 : (f.example.tolerance ?? 1e-7),
        );
        expect(result.functionName).toBe(f.name);
        expect(result.taskName).toBe(f.friendlyName);
        expect(Number.isFinite(Date.parse(result.timestamp))).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      } finally {
        rng?.mockRestore();
      }
    });
  }
  it('returns a structured error for missing and unknown functions', () => {
    expect(execute('NOT.A.FUNCTION', {}).value.error).toBe('#NAME?');
    expect(execute('WF.PASS_FAIL', { data: [50] }).value.error).toBe('#VALUE!');
  });
  it('propagates cell errors rather than replacing them with zero', () => {
    expect(execute('SUM', { data: [100, { error: '#DIV/0!' }] }).value.error).toBe('#DIV/0!');
  });
  it('preserves supplied blank cells and empty text while distinguishing omitted inputs', () => {
    expect(execute('ISBLANK', { value: null }).value).toBe(true);
    expect(execute('ISBLANK', { value: '' }).value).toBe(false);
    expect(execute('ISTEXT', { value: '' }).value).toBe(true);
    expect(execute('ISNUMBER', { value: null }).value).toBe(false);
    expect(execute('ISBLANK', {}).value.error).toBe('#VALUE!');
    expect(execute('IF', { condition: true, ifTrue: '', ifFalse: 'Other' }).value).toBe('');
  });
  it('reports row errors without hiding valid calculated rows', () => {
    const result = execute('WF.PASS_FAIL', { data: [50, 'bad'], threshold: 40 });
    expect(result.value[1][2]).toBe('Pass');
    expect(result.value[2][2].error).toBe('#VALUE!');
    expect(result.warnings.some((w) => w.includes('Valid row results are preserved'))).toBe(true);
  });
  it('applies scalar tasks to selected column rows with independent row errors', () => {
    expect(
      execute('TRIM', { text: ['  Ali   Khan  ', '  Sana  ', ' '], __rowWise: ['text'] }).value,
    ).toEqual(['Ali Khan', 'Sana', '']);
    const result = execute('ABS', { value: [-2, 'bad', 0], __rowWise: ['value'] });
    expect(result.value[0]).toBe(2);
    expect(result.value[1].error).toBe('#VALUE!');
    expect(result.value[2]).toBe(0);
    expect(
      execute('MOD', { value: [5, 10], divisor: [2], __rowWise: ['value', 'divisor'] }).value.error,
    ).toBe('#VALUE!');
  });
});

describe('deterministic task search', () => {
  const queries: [string, string[]][] = [
    ['sum', ['SUM']],
    ['jama', ['SUM']],
    ['ausat', ['AVERAGE']],
    ['sab se bara', ['MAX']],
    ['sab se chota', ['MIN']],
    ['pass fail', ['WF.PASS_FAIL']],
    ['student grade', ['WF.GRADES']],
    ['tankhwa', ['WF.SALARY_TOTAL']],
    ['hazri', ['WF.ATTENDANCE']],
    ['chutti', ['WF.WORKING_DAYS']],
    ['repeat', ['WF.DUPLICATE_EMPLOYEES']],
    ['qist', ['PMT', 'WF.LOAN']],
    ['search employee', ['WF.EMPLOYEE_LOOKUP']],
    ['GPA', ['WF.GPA']],
    ['CGPA', ['WF.GPA']],
    ['munafa', ['WF.PROFIT']],
    ['inventory', ['WF.STOCK']],
    ['extra spaces', ['TRIM']],
    ['date difference', ['DAYS', 'DATEDIF']],
  ];
  for (const [query, targets] of queries)
    it(`finds ${query} without an AI dependency`, () => {
      const names = searchFunctions(query)
        .slice(0, 15)
        .map((f) => f.name);
      expect(targets.some((name) => names.includes(name))).toBe(true);
    });
  it('prioritizes exact function names, supports partial names, typos and category filters', () => {
    expect(searchFunctions('SUM')[0].name).toBe('SUM');
    expect(searchFunctions('sumif').some((f) => f.name === 'SUMIFS')).toBe(true);
    expect(searchFunctions('smm').some((f) => f.name === 'SUM')).toBe(true);
    expect(
      searchFunctions('payroll', 'Office & HR').every((f) => f.categories.includes('Office & HR')),
    ).toBe(true);
    expect(searchFunctions('payroll', 'Office & HR').length).toBeGreaterThan(0);
    expect(searchFunctions('NO SUCH CATEGORY', 'NO SUCH CATEGORY')).toEqual([]);
  });
});
