import { build } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.local/standalone');
const destination = resolve(process.argv[2] || resolve(root, '../SheetPilot.html'));

// Only the portable edition uses embedded classic workers. The regular application
// keeps its existing module-worker and lazy-loading behavior.
const portableWorkers: Plugin = {
  name: 'sheetpilot-portable-workers',
  enforce: 'pre',
  transform(source, id) {
    const path = id.split('?')[0].replaceAll('\\', '/');
    if (
      !path.endsWith('/src/engine/client.ts') &&
      !path.endsWith('/src/components/ImportModal.tsx')
    )
      return;
    const constructor =
      /new Worker\(\s*new URL\((['"])([^'"]+\.worker\.ts)\1,\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"],?\s*\},?\s*\)/g;
    const matches = [...source.matchAll(constructor)];
    if (matches.length !== 1)
      throw new Error(
        `Expected exactly one worker constructor in ${path}; update the portable adapter.`,
      );
    return {
      code: `import SheetPilotEmbeddedWorker from ${JSON.stringify(`${matches[0][2]}?worker&inline`)};\n${source.replace(constructor, 'new SheetPilotEmbeddedWorker()')}`,
      map: null,
    };
  },
};

await build({
  configFile: false,
  root,
  base: './',
  plugins: [portableWorkers, react()],
  worker: {
    format: 'iife',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  build: {
    outDir: output,
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: { inlineDynamicImports: true, entryFileNames: 'sheetpilot.js' },
    },
  },
});

async function asset(url: string): Promise<string> {
  const target = resolve(output, url.replace(/^\.\//, '').replace(/^\//, ''));
  const path = relative(output, target);
  if (isAbsolute(path) || path.startsWith('..'))
    throw new Error('Portable asset escaped its output directory.');
  return readFile(target, 'utf8');
}

let html = await readFile(resolve(output, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)];
if (scripts.length !== 1) throw new Error('Expected one application entry in the portable build.');
for (const match of scripts) {
  const javascript = (await asset(match[1])).replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () => `<script type="module">${javascript}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
  const href = /\bhref=["']([^"']+)["']/i.exec(match[0])?.[1];
  const rel = /\brel=["']([^"']+)["']/i.exec(match[0])?.[1];
  if (rel === 'stylesheet' && href) {
    const css = (await asset(href)).replace(/<\/style/gi, '<\\/style');
    html = html.replace(match[0], () => `<style>${css}</style>`);
  } else if (rel === 'icon') {
    const svg = await readFile(resolve(root, 'public/favicon.svg'), 'utf8');
    html = html.replace(
      match[0],
      () => `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`,
    );
  }
}
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel=["']stylesheet["']/i.test(html))
  throw new Error('The portable HTML still depends on an external script or stylesheet.');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html);
console.log(
  `Standalone HTML saved to ${destination} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB).`,
);
