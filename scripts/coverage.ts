import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { functions, execute } from '../src/engine/registry';

const root = fileURLToPath(new URL('../', import.meta.url));
const spec = await readFile(`${root}docs/PRODUCT_SPEC.md`, 'utf8');
const section = spec.split('## 7. Required function catalogue')[1]?.split('## 8.')[0];
if (!section) throw new Error('Required function catalogue section is missing.');
const required = [
  ...new Set(
    section
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\.$/, ''))
      .filter((line) => /^[A-Z][A-Z0-9.]*(?:,\s*[A-Z][A-Z0-9.]*)+$/.test(line))
      .flatMap((line) => line.split(/,\s*/)),
  ),
];
if (required.length !== 261)
  throw new Error(
    `Expected 261 functions from the approved specification; found ${required.length}. Review the parser or changed specification.`,
  );

function compare(
  actual: any,
  expected: any,
  tolerance: number,
  path = 'result',
): string | undefined {
  if (typeof expected === 'number') {
    if (
      typeof actual !== 'number' ||
      !Number.isFinite(actual) ||
      Math.abs(actual - expected) > tolerance * Math.max(1, Math.abs(expected))
    )
      return `${path}: expected ${expected}, received ${JSON.stringify(actual)}`;
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      return `${path}: array dimensions differ`;
    for (let i = 0; i < expected.length; i++) {
      const mismatch = compare(actual[i], expected[i], tolerance, `${path}[${i}]`);
      if (mismatch) return mismatch;
    }
  } else if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return `${path}: expected an object`;
    // Error messages can contain context; the independently specified error code is the expected contract.
    const keys = Object.keys(expected);
    for (const key of keys) {
      const mismatch = compare(actual[key], expected[key], tolerance, `${path}.${key}`);
      if (mismatch) return mismatch;
    }
  } else if (actual !== expected)
    return `${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`;
}
const records = await Promise.all(
  [...required, ...functions.filter((f) => !required.includes(f.name)).map((f) => f.name)].map(
    async (name) => {
      const definition = functions.find((f) => f.name === name);
      if (!definition)
        return {
          name,
          required: true,
          implementationStatus: 'missing',
          exampleTest: 'not run',
          testReferences: [],
          compatibility: [],
          externalDependencies: [],
          mismatch: 'Not registered.',
        };
      const testReferences = [...new Set(['tests/registry.test.ts', ...definition.testRefs])];
      const missingTestFiles: string[] = [];
      for (const ref of testReferences) {
        const path = ref.split(/\s+[—–>\-]\s+/)[0];
        try {
          await access(`${root}${path}`);
        } catch {
          missingTestFiles.push(path);
        }
      }
      const result = execute(name, definition.example.args, definition.example.context ?? {});
      const mismatch =
        name === 'RAND'
          ? typeof result.value === 'number' && result.value >= 0 && result.value < 1
            ? undefined
            : 'RAND must return a number in [0,1).'
          : compare(
              result.value,
              definition.example.expected,
              definition.example.tolerance ?? 1e-7,
            );
      return {
        name,
        required: required.includes(name),
        friendlyName: definition.friendlyName,
        categories: definition.categories,
        implementationStatus: 'implemented',
        exampleTest: mismatch ? 'failed' : 'passed',
        testReferences,
        missingTestFiles,
        compatibility: definition.compatibility,
        externalDependencies: definition.external
          ? [
              'Analytical model provider. Included demo provider is for demonstrations; production providers require configuration.',
            ]
          : [],
        ...(mismatch ? { mismatch } : {}),
      };
    },
  ),
);
const failed = records.filter(
  (r) => r.implementationStatus === 'missing' || r.exampleTest !== 'passed',
);
const summary = {
  generatedAt: new Date().toISOString(),
  requiredFunctions: required.length,
  implementedRequired: records.filter((r) => r.required && r.implementationStatus === 'implemented')
    .length,
  passingRequiredExamples: records.filter((r) => r.required && r.exampleTest === 'passed').length,
  workflows: functions.filter((f) => f.name.startsWith('WF.')).length,
  totalRegistered: functions.length,
  note: 'Example checks compare against explicitly stated expected answers. The automated test suites also cover edge cases and invalid inputs. Passing examples establish exercised behavior, not exhaustive Excel compatibility. External cube functions are tested against a clearly labeled demonstration model.',
};
const escape = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const lines = [
  '# SheetPilot function coverage',
  '',
  `Generated ${summary.generatedAt}.`,
  '',
  `Required functions: **${summary.implementedRequired}/${summary.requiredFunctions} implemented**; **${summary.passingRequiredExamples}/${summary.requiredFunctions} expected-result examples passed**. Ready-made workflows: **${summary.workflows}**. Total registered tasks: **${summary.totalRegistered}**.`,
  '',
  summary.note,
  '',
  'Run `npm test` for the automated suites and `npm run coverage:report` to regenerate this report. Random numbers are checked against their documented bounds; deterministic examples use explicit timestamps where needed. Numerical comparisons use each entry’s stated tolerance, with a default relative tolerance of 1e-7.',
  '',
  '| Function | Required | Implementation | Example test | Automated coverage | Compatibility limitations | External dependencies |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...records.map(
    (r) =>
      `| ${r.name} | ${r.required ? 'Yes' : 'Workflow'} | ${r.implementationStatus} | ${r.exampleTest}${r.mismatch ? `: ${escape(r.mismatch)}` : ''} | ${r.testReferences.map(escape).join('; ')} | ${r.compatibility.map(escape).join('; ')} | ${r.externalDependencies.map(escape).join('; ') || 'None'} |`,
  ),
  '',
];
await mkdir(`${root}docs`, { recursive: true });
await writeFile(
  `${root}docs/function-coverage.json`,
  `${JSON.stringify({ summary, functions: records }, null, 2)}\n`,
);
await writeFile(`${root}docs/FUNCTION_COVERAGE.md`, lines.join('\n'));
console.log(JSON.stringify(summary, null, 2));
if (failed.length) {
  console.error(
    'Missing or failing entries:',
    failed.map((f) => `${f.name}: ${f.mismatch}`).join('\n'),
  );
  process.exitCode = 1;
}
