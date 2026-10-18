import { describe, expect, it } from 'vitest';
import { functions, registry, execute } from '../src/engine/registry';
import { functionGuide, inputGuidance, topics, isCellInput } from '../src/help/guides';
import { averageExampleSheet, averageSelections } from '../src/help/selection-example';
import { resolveBindings } from '../src/engine/bindings';

describe('beginner guide catalogue', () => {
  it('covers every registered function and workflow without stale entries', () => {
    expect(Object.keys(topics).sort()).toEqual(functions.map((f) => f.name).sort());
    expect(new Set(Object.values(topics).map((t) => t.purpose)).size).toBe(functions.length);
  });
  for (const def of functions) {
    it(`${def.name} explains its purpose, inputs, result and example`, () => {
      const guide = functionGuide(def);
      expect(guide.purpose.length).toBeGreaterThan(35);
      expect(guide.result.length).toBeGreaterThan(40);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.inputs.map((i) => i.input.key)).toEqual(def.inputs.map((i) => i.key));
      for (const field of guide.inputs) {
        expect(field.instructions.length).toBeGreaterThan(90);
        expect(field.instructions).not.toMatch(/undefined|\[object Object\]/);
        // Every required field must have a usable worked-example value.
        if (field.input.required)
          expect(
            def.example.args[field.input.key] !== undefined
              ? def.example.args[field.input.key]
              : (field.input.default ?? def.defaults?.[field.input.key]),
          ).not.toBeUndefined();
      }
    });
  }
  it('explains changing random and clock results instead of promising fixed test values', () => {
    expect(functionGuide(registry.get('RAND')!).exampleAnswer).toContain('random decimal');
    expect(functionGuide(registry.get('TODAY')!).exampleAnswer).toContain(
      'current UTC calendar date',
    );
    expect(functionGuide(registry.get('NOW')!).exampleAnswer).toContain('current UTC time');
    expect(functionGuide(registry.get('AVERAGE')!).exampleAnswer).toBe(
      registry.get('AVERAGE')!.example.expected,
    );
  });
  it('distinguishes monthly decimal rates from workflow annual percentages', () => {
    const help = (name: string, key: string) => {
      const def = registry.get(name)!;
      return inputGuidance(
        def,
        def.inputs.find((i) => i.key === key)!,
      );
    };
    expect(help('PMT', 'rate')).toContain('0.12 / 12 = 0.01');
    expect(help('WF.LOAN', 'annualRate')).toContain('12 for 12%');
    expect(help('WF.LOAN', 'payments')).toContain('60, not 5');
    expect(help('XNPV', 'rate')).toContain('annual discount rate');
    expect(help('DSUM', 'criteria')).toContain('separate criteria rows are OR');
    expect(help('DSUM', 'database')).toContain('Include column headers');
    expect(help('XLOOKUP', 'returns')).toContain('same reference records');
  });
});

describe('beginner selection examples actually calculate as taught', () => {
  for (const [mode, lesson] of Object.entries(averageSelections)) {
    it(`AVERAGE ${mode} uses the promised cells and result`, () => {
      const sheet = averageExampleSheet('practice', 'Practice');
      const workbook = { id: 'book', name: 'Practice', sheets: [sheet] };
      const args = resolveBindings(
        { data: { __source: 'range', sheetId: sheet.id, range: lesson.range } },
        workbook,
        [],
      );
      expect(args.data.flat()).toEqual(lesson.values);
      expect(execute('AVERAGE', args).value).toBe(lesson.answer);
    });
  }
  it('cell checks and error replacements operate on each selected value', () => {
    for (const name of ['ISBLANK', 'IFERROR']) {
      const def = registry.get(name)!;
      const values = name === 'ISBLANK' ? [null, 0, ''] : [10, { error: '#DIV/0!' }, 0];
      const args: Record<string, any> = { value: values, fallback: 'Check input' };
      args.__rowWise = def.inputs
        .filter((i) => isCellInput(def, i) && Array.isArray(args[i.key]))
        .map((i) => i.key);
      expect(execute(name, args).value).toEqual(
        name === 'ISBLANK' ? [true, false, false] : [10, 'Check input', 0],
      );
    }
  });
});
