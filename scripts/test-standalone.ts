import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { accessSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = resolve(process.argv[2] || resolve(root, '../SheetPilot.html'));
accessSync(html);
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const result = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(3)], {
  cwd: root,
  env: { ...process.env, SHEETPILOT_STANDALONE_HTML: html },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
