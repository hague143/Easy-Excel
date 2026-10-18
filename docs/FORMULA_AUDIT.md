# Formula audit — 18 October 2026

The audit covers all **261 required formulas and 40 workflows**. Each task has a passing expected-result example, accepts frozen source inputs without modifying them, and is exercised through the application's task picker, example loader, form, calculation worker and result panel.

## Independent reference checks

The automated suite contains **4,044 passing checks across 12 suites**, including **1,920 independent numerical references for 33 functions**. The references cover statistical summaries, normal/binomial/Poisson distributions and extreme tails, t-tests, covariance, percentiles, matrix operations, decimal rounding, annuities, payment components and investment returns.

The committed [reference fixture](../tests/fixtures/audit-reference.json) records its Python, NumPy and SciPy provenance. It uses Python statistics/decimal/math and NumPy/SciPy calculations; it does not call SheetPilot or Formula.js to generate expected answers. A fixed random seed makes the data reproducible. Absolute and relative tolerances are recorded per case; very small probabilities use a zero absolute tolerance so an incorrect zero cannot pass.

[generate-audit-reference.py](../scripts/generate-audit-reference.py) regenerates the fixture with optional Python/NumPy/SciPy tooling. Ordinary `npm test` runs read the committed JSON and do not need Python packages. Regeneration was checked to reproduce the fixture byte for byte.

## Defects corrected

| Area                       | Previous behavior                                                                                                                                                  | Corrected behavior                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty-data summaries       | SUMSQ and FREQUENCY rejected valid empty numeric lists.                                                                                                            | SUMSQ returns zero; FREQUENCY returns zero counts for empty observations and a single overflow count when there are no bins.                                                                                           |
| Visible summaries          | SUBTOTAL and AGGREGATE treated each cell in a multi-column selection as a different worksheet row.                                                                 | Every selected cell in a hidden/filtered row is excluded together; nested summaries are matched against the correct column address.                                                                                    |
| Statistical boundaries     | Empty MEDIAN/MODE inputs produced the wrong error; Z.TEST always required two observations.                                                                        | MEDIAN returns #NUM! and MODE returns #N/A for empty data. Z.TEST allows one observation when population sigma is supplied; sample-estimated sigma still requires two.                                                 |
| Combinations/permutations  | Negative fractional counts could truncate to zero and incorrectly return 1.                                                                                        | Negative counts return #NUM! before truncation.                                                                                                                                                                        |
| Source error propagation   | Numeric, matrix, regression and some date/configuration inputs replaced upstream errors with generic errors.                                                       | Original spreadsheet error codes and messages are preserved; valid per-row calculations remain available.                                                                                                              |
| Visual reusable operations | Decimal midpoint rounding differed from ROUND; IFERROR missed errors supplied as values; conditional/logical nodes used JavaScript truthiness.                     | MAP/LET/LAMBDA and related operations share decimal ROUND behavior, handle value errors in IFERROR, propagate invalid conditions and interpret Boolean values consistently. Unselected IF branches remain unevaluated. |
| TEXT format literals       | Quoted percent signs affected numeric scaling, quoted digits could be replaced, quoted semicolons split format sections, and scientific masks lost their prefixes. | Literal and escaped characters are protected during formatting. Numeric sections and scientific notation retain their intended text; malformed quotes/escapes report an error.                                         |
| Small normal probabilities | The probability workflow could return zero for a small but representable cumulative probability.                                                                   | It uses the accurate tail calculation shared with NORM.DIST; for example, standard-normal CDF(-10) is approximately 7.61985302416047e-24.                                                                              |
| Result display and copying | Eight-decimal display rounding could show a small nonzero result as zero; Copy used the rounded display.                                                           | Small/large results use scientific notation, hovering reveals the full numeric value, and Copy retains the full numeric value.                                                                                         |
| Date validation            | DATEVALUE accepted a time-only string as day zero, and financial functions accepted out-of-range numeric dates.                                                    | DATEVALUE requires calendar-date text; financial date serials must lie within the supported Excel date range.                                                                                                          |

## Browser and portable-file checks

The **27 distinct browser acceptance checks**, covered by complete catalogue runs and targeted final-release regression runs, include all 301 task examples, existing import/export/persistence/mobile/pipeline workflows, the beginner guides, and an end-to-end regression for probability precision, clipboard data, TEXT literals and visual rounding. The final offline rebuild was rechecked with the precision/copying/formatting regression and the multi-column visibility regression. The same suite runs against the standalone HTML with networking disabled and rejects additional asset requests. See [standalone testing details](STANDALONE.md) for the cloud browser's local-file navigation restriction.

## Reproduce

```bash
npm test
npm run coverage:report
npm run build
npm run test:e2e
npm run build:standalone
npm run test:standalone
```

These checks validate the stated examples, boundary conditions and independent reference data. They do not establish exhaustive compatibility with every Excel version or every possible input. Analytical-provider tasks are checked against the explicitly labeled local demonstration provider. See [compatibility limits](COMPATIBILITY.md).
