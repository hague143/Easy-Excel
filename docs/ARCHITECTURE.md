# Architecture and calculation choices

SheetPilot is a static React/TypeScript application. A backend is unnecessary for its local workflows. The browser owns the workbook and explicit project saves; workers isolate calculations and file parsing from the interface.

## Components

- `src/App.tsx`: workspace composition, undo/redo, calculation history, saved operations, pipelines, explicit saving.
- `src/components/`: editable grid, registry-driven inputs, safe visual operation builder, comparisons, import preview, and results/charts.
- `src/engine/types.ts`: typed workbook, function metadata, result, and provider contracts.
- `src/engine/registry.ts`: centralized, deduplicated registry; deterministic search and fuzzy matching; validation, row execution, and errors.
- `src/engine/base.ts`: arithmetic, conditions, text, dates, validation; Excel serial/date and criteria helpers.
- `src/engine/numeric.ts`, `finance.ts`, and numerical helpers: statistics, finance, engineering, robust distributions, regression, matrices, complex numbers.
- `src/engine/advanced.ts` and helpers: exact/approximate lookup, real worksheet addresses, dynamic arrays, safe operation trees, database summaries, local pivot and analytical providers.
- `src/engine/bindings.ts`: scalar/column/range/table/result resolution and dependency ordering/cycle detection.
- `src/engine/calculation.worker.ts`: calculation execution. No arbitrary JavaScript evaluation.
- `src/workbook/`: CSV/XLSX import/export, import worker, strict project validation, explicit local storage, synthetic samples.
- `src/workflows/`: explicit business-rule workflows composed from deterministic calculations.
- `tests/` and `scripts/coverage.ts`: independent expected results, edge/error tests, browser acceptance, and an executable function-coverage report.

## Dependency evaluation

| Component | Choice | Why and limits |
| --- | --- | --- |
| Spreadsheet calculations | FormulaJS 4.6.1, MIT, plus custom adapters | Browser-compatible and permissive. Its exported functions do not cover the entire required catalogue. Missing functions, coercion differences, temperature conversion, financial securities, regression, criteria, and other gaps have explicit implementations and tests. |
| Statistics | jStat 1.9.6, MIT, plus stable numerical routines | Supplies distributions and numerical primitives. Stable normal tails/inverses, log-space binomial/Poisson probabilities, and upper-tail calculations replace inaccurate/underflowing branches found in tests. |
| Workbook files | ExcelJS 4.4.0, MIT | XLSX parsing/writing, multiple worksheets, cached formula metadata and typed values. It is not a formula evaluator. Loaded lazily in both worker and export paths. |
| CSV | Papa Parse 5.7.0, MIT | Delimiter handling, quoted fields, robust parsing and output. Custom empty-field metadata preserves quoted empty strings versus blank cells. |
| Grid | Native accessible HTML table with typed editors | No restrictive spreadsheet dependency. Works with selection, paste, undo, row/column operations, and controlled workbook state. Large files require smaller datasets because the grid uses 100-row pages and is not fully virtualized across columns. |
| Formula engines not selected | HyperFormula and other full-workbook engines | A restrictive/commercial licensing requirement was unnecessary for this application's formula-free calculation contract. No assumption is made that one engine covers all Excel functions. |
| Fonts/icons | Locally bundled DM Sans and Manrope (OFL); Lucide (ISC) | No third-party font requests or paid design assets. |

## Values and references

Cells store typed numbers, strings, booleans, null blanks, or explicit error objects. Empty text differs from null; numbers retain IEEE-754 precision. Dates and times import as ISO/clock strings, with Excel serial conversion at the calculation boundary. ID-like columns, leading zeros, and large identifiers stay text. Errors are propagated or exposed per row rather than replaced by zero.

Every worksheet uses Excel-style coordinates: row 1 contains headers, and row 2 contains the first stored data row. Formula metadata uses those same addresses. Imported cached formulas are not executable formulas in SheetPilot. Editing a formula cell clears its stale formula metadata.

Inputs bind to values, columns, ranges, full tables, and previous results. Scalar functions can run row by row over a single row/column. Matrices validate dimensions. Outputs are independent from the source until the user explicitly adds a worksheet or appends columns, avoiding an implicit destructive spill into existing data.

The visual operation tree has an enumerated instruction set, depth/size bounds, named parameters, and scoped bindings. LET/LAMBDA/MAP/BYROW/BYCOL/REDUCE/SCAN/MAKEARRAY never evaluate user JavaScript. Saved operations retain typed bindings. Pipeline execution topologically orders explicit dependencies and rejects cycles.

## Analytical models

`ModelProvider` exposes members and aggregated measures. The bundled `demo` provider reads local synthetic sales facts and is visibly labeled as a demonstration. Unknown providers, members, measures, and missing connections fail explicitly. A production provider must be integrated with the actual model protocol and authentication; no fabricated production values are returned.

## Limits and verification

The compatibility report is part of the product contract. Each registry entry contains its input form schema, defaults, aliases, calculation, validation behavior, example, test references, and compatibility notes. The generated coverage report verifies exact required-name membership and every example at runtime. Browser tests exercise the same worker path used by users.
