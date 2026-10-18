# Validation results

Validated in the supplied cloud workspace with Node.js 24.19.0, npm 11.9.0, and Chromium 154.0.8037.57.

| Check | Result |
| --- | --- |
| Frozen installation (`npm ci --cache /workspace/.npm --no-audit --no-fund`) | Passed |
| Strict TypeScript and production build (`npm run build`) | Passed |
| Production preview smoke: worker calculation and XLSX import/export | Passed; no browser errors |
| Numerical, workbook, search, registry, input, and dependency tests (`npm test`) | 1,252 passed across 9 suites |
| Chromium browser acceptance (`npm run test:e2e`) | 16 passed; no page or browser console errors |
| Portable HTML (`npm run test:standalone`) | 16 passed offline using the exact HTML contents; no external asset requests. Direct file navigation is blocked by cloud browser policy; see [standalone details](STANDALONE.md). |
| Required-function expected-result examples (`npm run coverage:report`) | 261/261 passed |
| Ready-made workflows | 40 implemented; expected examples and business-rule/error tests passed |

Browser acceptance covers:

1. A paginated 205-row import with calculation over every row.
2. Pasted marks: totals, percentages, user-defined grades, and ranks.
3. Attendance CSV preview and working days excluding a supplied holiday.
4. Employee ID lookup between two datasets, preserving leading zeros.
5. Sales totals under two conditions.
6. Text cleaning and splitting.
7. Loan installments with annual rate, frequency, term, and timing.
8. Regression coefficients against independent expected results.
9. Inventory balances and explicit reorder thresholds.
10. Edited inputs, automatic recalculation, undo, and redo.
11. XLSX import, injection-safe exports, project download/reopen, and browser save.
12. Responsive mobile navigation and Roman Urdu search/calculation.
13. Default desktop workbook and helpful initial result state.
14. Formula-free IF column comparison.
15. Visual LET named values and operations.
16. Saved-operation pipelines and circular-dependency rejection.

The numerical suites include error propagation, blank versus empty text, identifiers, negative/midpoint rounding, criteria/wildcard escaping, exact/approximate lookup, date serials/leap/month-end rules, holidays, hidden/filtered rows, sample/population statistics, distribution tails, singular matrices, cash-flow signs, financial day-count bases, and invalid/non-convergent schedules. Expected values are stated independently; the implementation does not generate its own expectations.

The production bundle emits a size advisory for the formula catalogue and XLSX library. The XLSX module is loaded lazily; imports and calculations use workers. This advisory does not fail the build. The editable grid uses 100-row pages; extremely wide datasets remain a practical performance limit.

These results establish the exercised behavior, not exhaustive parity with every Excel version or numerical input. See [COMPATIBILITY.md](COMPATIBILITY.md) and the generated [function report](FUNCTION_COVERAGE.md) for limitations and external analytical-provider requirements.
