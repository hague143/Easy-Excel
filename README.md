# SheetPilot — Automatic Excel Calculator

A private, formula-free spreadsheet workspace built with React, TypeScript, and Vite. Enter or import data, choose a task, confirm the inputs, and calculate. No AI service, API key, backend, or Microsoft Excel installation is required.

**Download the ready-to-open app:** [SheetPilot HTML](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/SheetPilot.html) · [HTML ZIP](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/SheetPilot-HTML.zip). Extract the ZIP and open `SheetPilot.html` in Chrome or Edge. See [download instructions](downloads/README.md).

## Run

Use Node.js 22 or newer (validated with Node 24).

```bash
cd /workspace/Easy-Excel
npm ci --cache /workspace/.npm
npm run dev
```

The development server listens on port 5173. For a production build, use `npm run build` and `npm run preview`. Deploy the generated `dist/` directory to any static host that supports ES module workers. The regular multi-file build requires HTTP/HTTPS; use the portable edition below for a downloadable HTML file.

### Portable HTML edition

`npm run build:standalone` creates `SheetPilot.html` in the checkout's parent directory. Download that single file and open it in a current Chrome or Edge browser. Application code, fonts, styles, XLSX support, and workers are embedded; no development server, installation, or network connection is needed. Browser or organization policies may restrict opening local HTML files. Save a downloaded project for portable backups because browser-local storage can depend on the file's location.

Run `npm run test:standalone` to exercise the same 16 acceptance workflows with networking disabled. The managed cloud browser blocks `file://` navigation, so this test supplies the exact file contents as one intercepted loopback document; it starts no server and rejects requests for additional assets. This verifies the self-contained edition without claiming a direct `file://` browser test succeeded. See [standalone build details](docs/STANDALONE.md).

## Use

1. Start with **Sales overview**, choose **Sample data**, import a CSV/XLSX file, or add a blank worksheet. Double-click cells to edit; paste tab-separated rows directly from Excel or Google Sheets.
2. Search **Function library** using a function, category, English description, or Roman Urdu term such as *jama*, *ausat*, *hazri*, *tankhwa*, or *qist*.
3. Select columns, ranges, values, tables, or previous results. Confirm every business rule. **Try with example values** loads explicit synthetic inputs; it never silently supplies an institutional grading or overtime policy.
4. Click **Calculate**. View the result, source, settings, errors, timing, and compatibility notes. Copy or export the result, create a new worksheet, or append calculated columns in result row order.
5. **Save project** explicitly saves to this browser. **Export → Full SheetPilot project** downloads a portable `.sheetpilot.json` containing worksheets, types, settings, history, and operations. Use **Open a saved project** to restore it.

Columns can be added, renamed, rearranged, retyped, and deleted from their header menus. Select a cell, Shift-click or drag a range, or click row/column headers. The corner selects the whole table. Undo/redo applies to workbook changes; Ctrl/Cmd+S saves. Clearing a text cell preserves empty text; Delete clears to a blank.

Saved operations can be reapplied to another worksheet with matching column names. Review the mapping before calculating. Link operations through **Input from** to create a dependency pipeline. Circular or missing dependencies produce explicit errors. With automatic recalculation enabled, worksheet edits rerun the selected task or the saved pipeline. Random functions recalculate only on Calculate or this explicitly enabled policy.

## Validation

```bash
npm test                  # Numerical, workbook, registry, search, and dependency tests
npm run test:e2e          # Chromium browser acceptance workflows
npm run coverage:report   # Regenerate Markdown and JSON function reports
npm run build            # Strict TypeScript check + production bundles
```

Playwright uses `/usr/bin/chromium` when available. Otherwise install its browser with `npx playwright install chromium`. Browser downloads may require the standard Playwright download destinations to be allowed by your environment.

All **261 unique functions** from the supplied specification are registered, with **40 ready-made workflows**. Each required function has an explicitly stated expected-result example and test references. See [function coverage](docs/FUNCTION_COVERAGE.md), [compatibility limits](docs/COMPATIBILITY.md), and the [architecture](docs/ARCHITECTURE.md). Passing examples and edge tests establish the tested behavior; they do not certify every behavior of Microsoft Excel.

The [validation report](docs/VALIDATION.md) records 1,252 passing automated checks and 16 passing browser acceptance tests.

The browser suite covers the ten requested acceptance workflows, responsive navigation, clean startup, IF comparison configuration, visual LET editing, and pipeline dependencies/cycles. Numerical expected values include published financial examples and independently established statistical values; implementations are never used to manufacture their own expected answers.

## Samples

Six synthetic datasets are bundled in `src/workbook/samples.ts`: sales, employees with a separate lookup table, student marks, attendance, inventory, and research observations. Every function and workflow also supplies a small executable example.

## Privacy and file handling

Datasets stay in the browser. Calculation and import run in Web Workers. Fonts and application assets are bundled locally. Imported macros and scripts never run; external workbook links are never fetched. Imported formulas retain formula metadata and cached values and are **not recalculated**. CSV/XLSX exports contain results and literal values, with protection against spreadsheet formula injection. Numeric negative values remain numeric.

Imports are limited to 20 MB and 250,000 cells; XLSX ZIP structures are checked before loading. Portable projects allow up to 20 MB and one million validated cells. Large imports should be split into smaller workbooks for grid performance. Leading-zero and large numeric IDs stay text. Use XLSX or a SheetPilot project for typed interchange: CSV itself has no type schema, and another spreadsheet program may infer different types.

Currency columns do not specify or convert a currency. Use explicit column names/units; XLSX uses the generic `¤` currency marker rather than assuming US dollars. See the per-function help for rates, cash-flow signs, date bases, and statistical assumptions.

Production analytical models require a suitable provider, connection infrastructure, and credentials. The included **local demonstration sales model** tests CUBEVALUE/CUBEMEMBER; it is explicitly not full Excel/SSAS compatibility.

## Dependencies

Calculation, statistical, parsing, workbook, UI, and build dependencies use permissive licenses. FormulaJS, jStat, ExcelJS, Papa Parse, React, and Vite are MIT; Lucide is ISC; bundled fonts use SIL OFL. See [architecture and dependency evaluation](docs/ARCHITECTURE.md). There is no paid dependency or external calculation service.
