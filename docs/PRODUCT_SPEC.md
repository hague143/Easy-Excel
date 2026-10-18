Build a complete, working application called **SheetPilot — Automatic Excel Calculator**.

Act as a senior full-stack engineer, spreadsheet calculation specialist, and product designer. Implement the application, run it, test its calculations, and deliver a usable product. Do not stop at a plan, mockup, or interface with nonfunctional buttons.

## 1. Product objective

Create a spreadsheet automation app for offices, universities, schools, factories, HR departments, accounts teams, researchers, and large organizations.

The primary experience must be:

**Enter or upload data → Search or select a task → Confirm relevant columns/settings → Click Calculate → See accurate results.**

Users must never need to write Excel formulas, understand formula syntax, or manually create cell references.

“One click” means one calculation click after required inputs are available. Do not guess missing business rules or silently select ambiguous columns.

The core app must work without an AI API key, paid AI service, or Microsoft Excel installation.

## 2. Implementation approach

First inspect the existing project and follow its conventions. If no project exists, choose a maintainable modern stack suitable for a polished web application.

Preferred starting stack:
- React and TypeScript for the frontend.
- A suitable backend only where needed.
- An editable spreadsheet grid.
- A deterministic calculation engine.
- Web Workers for expensive local calculations.
- Local project persistence with an explicit save option.

Evaluate calculation libraries for function coverage, numerical correctness, licensing, and browser/server compatibility before adopting one.

Do not assume one spreadsheet library implements every required function.

Use:
- A formula-engine adapter where a library provides correct support.
- Tested custom implementations or established numerical libraries for gaps.
- Explicit external-data adapters for functions requiring a data model.

Never use AI-generated answers as the numerical calculation engine.

Do not introduce a paid dependency, paid API, or restrictive license without explaining it first.

## 3. Data entry and import

Support:
- Typing and editing data in a spreadsheet-style table.
- Pasting tab-separated data from Excel or Google Sheets.
- CSV and XLSX upload.
- Multiple worksheets and multiple datasets.
- Adding, renaming, deleting, and rearranging columns.
- Adding and deleting rows.
- Selecting cells, ranges, columns, and tables.
- Undo and redo.
- Sample datasets for immediate testing.

Provide an import preview with:
- Header-row selection.
- Data-type detection.
- Encoding and delimiter selection for CSV.
- Date-format confirmation where ambiguous.
- Identification of mixed data types, blanks, and invalid values.

Preserve:
- Employee IDs, student IDs, account numbers, and leading zeros.
- The distinction between blank, zero, text, and an error.
- Original data unless the user explicitly applies a transformation.

Support numbers, text, booleans, dates, times, percentages, and currencies.

Explain precision limitations for very large numeric identifiers and preserve those identifiers as text.

## 4. Main interface

Create a professional, responsive interface with:

1. Dataset and worksheet sidebar.
2. Editable data grid.
3. Searchable function and task catalogue.
4. A task configuration panel.
5. A Calculate button.
6. A results panel.
7. Calculation history.
8. Export and project-save actions.

Use readable typography, keyboard-accessible controls, clear loading states, and helpful empty states.

The default view must be simple enough for a nontechnical office user. Put specialized research and engineering options under advanced settings.

## 5. Search

Search must support:
- Exact function names.
- Partial function names.
- Categories.
- Plain-English task descriptions.
- Roman Urdu keywords and synonyms.

Examples:
- “total”, “jama”, “sum”
- “average”, “ausat”
- “sab se bara”, “highest”
- “sab se chota”, “lowest”
- “pass fail”
- “student grade”
- “salary”, “tankhwa”
- “attendance”, “hazri”
- “working days”, “chutti”
- “duplicate”, “repeat”
- “loan installment”, “qist”
- “search employee”
- “GPA”, “CGPA”
- “profit”, “munafa”
- “stock”, “inventory”
- “extra spaces”
- “date difference”

Use deterministic keyword mapping and fuzzy search for the core experience. No AI API should be required.

Each search result should display:
- Friendly task name.
- Corresponding Excel function.
- Short purpose.
- Category.
- Required input types.
- A small example.
- Whether the function requires an external data connection.

## 6. Formula-free configuration

Generate a suitable input form for every function.

Examples:

SUM:
- Select the numeric column.
- Click Calculate.
- Display the total.

SUMIFS:
- Select the amount column.
- Add one or more conditions through dropdowns.
- Select AND/OR behavior only where the operation actually supports it; offer a separate workflow for other combinations.
- Click Calculate.

XLOOKUP:
- Select the search value or input column.
- Select the lookup dataset and lookup column.
- Select the return column.
- Expose match mode, duplicate policy, and missing-value behavior.

IF:
- Choose a column.
- Choose a comparison operator.
- Enter or select a comparison value.
- Choose the result when true and when false.

PMT:
- Enter principal, interest rate, payment frequency, and term.
- Clearly distinguish annual and per-period rates.
- Expose payment timing.
- Display a friendly installment result and explain cash-flow sign conventions.

NETWORKDAYS:
- Select start date, end date, and optional holiday list.
- Show the applicable weekend convention.

Text functions:
- Select the source column.
- Supply relevant separator, character count, position, or replacement text.

Statistical tests:
- Select datasets.
- Configure required assumptions, tails, and test types.
- Explain the result without claiming statistical significance proves causation.

Matrix functions:
- Select valid rectangular numeric ranges.
- Validate dimensions before calculating.

Allow values, columns, ranges, and previous calculation outputs to be used as inputs.

For simple tasks, preselect a column only when the mapping is unambiguous, and visibly show the selection.

## 7. Required function catalogue

Implement every unique function below. Do not create catalogue entries that only display descriptions without working calculations.

### A. Basic mathematics and aggregation

SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN, INT, MOD, QUOTIENT, SUBTOTAL, AGGREGATE.

### B. Logic and conditional calculations

IF, IFS, AND, OR, NOT, SWITCH, IFERROR, IFNA, SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, AVERAGEIFS, MAXIFS, MINIFS.

### C. Lookup and references

XLOOKUP, VLOOKUP, HLOOKUP, LOOKUP, INDEX, MATCH, XMATCH, CHOOSE, INDIRECT, ADDRESS, ROW, COLUMN, ROWS, COLUMNS, OFFSET.

### D. Text and cleaning

LEFT, RIGHT, MID, LEN, TRIM, CLEAN, UPPER, LOWER, PROPER, CONCAT, CONCATENATE, TEXTJOIN, TEXT, VALUE, SUBSTITUTE, REPLACE, FIND, SEARCH, EXACT, TEXTSPLIT, TEXTBEFORE, TEXTAFTER, REPT, CHAR, CODE, UNICHAR, UNICODE, NUMBERVALUE, FIXED, T, HYPERLINK.

### E. Dates and times

TODAY, NOW, DATE, TIME, DAY, MONTH, YEAR, HOUR, MINUTE, SECOND, DAYS, DATEDIF, YEARFRAC, WEEKDAY, WEEKNUM, EDATE, EOMONTH, NETWORKDAYS, NETWORKDAYS.INTL, WORKDAY, WORKDAY.INTL, DATEVALUE, TIMEVALUE, DAYS360, ISOWEEKNUM.

### F. Statistics, university results, and research

MEDIAN, MODE.SNGL, MODE.MULT, LARGE, SMALL, RANK.EQ, RANK.AVG, PERCENTILE.INC, QUARTILE.INC, STDEV.S, STDEV.P, VAR.S, VAR.P, CORREL, FREQUENCY, SUMPRODUCT, FORECAST.LINEAR, TREND, LINEST, T.TEST, CHISQ.TEST, GEOMEAN, HARMEAN, TRIMMEAN, PERCENTRANK.INC, COVARIANCE.S, COVARIANCE.P, SLOPE, INTERCEPT, RSQ, STEYX, STANDARDIZE, NORM.DIST, NORM.INV, BINOM.DIST, POISSON.DIST, CONFIDENCE.T, F.TEST, Z.TEST, SKEW, KURT, GROWTH, LOGEST.

### G. Finance and accounting

PMT, IPMT, PPMT, PV, FV, RATE, NPER, NPV, XNPV, IRR, XIRR, SLN, DB, DDB, CUMIPMT, CUMPRINC, MIRR, RRI, EFFECT, NOMINAL, PDURATION, SYD, VDB, PRICE, YIELD, DURATION, MDURATION, ACCRINT, DISC, INTRATE, TBILLPRICE, TBILLYIELD.

### H. Engineering and advanced mathematics

CEILING.MATH, FLOOR.MATH, MROUND, CONVERT, SQRT, POWER, EXP, LN, LOG, SIN, COS, TAN, TRUNC, SIGN, GCD, LCM, FACT, COMBIN, PERMUT, SUMSQ, RAND, RANDBETWEEN, RANDARRAY, MMULT, MINVERSE, MDETERM, COMPLEX, IMSUM, IMPRODUCT, DEC2BIN, BIN2DEC, DEC2HEX, HEX2DEC.

### I. Dynamic arrays and reusable calculations

FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, TRANSPOSE, TAKE, DROP, CHOOSECOLS, CHOOSEROWS, VSTACK, HSTACK, TOCOL, TOROW, EXPAND, WRAPROWS, WRAPCOLS, LET, LAMBDA, MAP, BYROW, BYCOL, REDUCE, SCAN, MAKEARRAY.

### J. Validation and error information

ISBLANK, ISNUMBER, ISTEXT, ISERROR, ISNA, ISLOGICAL, ISFORMULA, ISEVEN, ISODD, ERROR.TYPE, FORMULATEXT.

### K. Database calculations

DSUM, DAVERAGE, DCOUNT, DCOUNTA, DMAX, DMIN, DGET, DPRODUCT, DSTDEV, DVAR.

### L. Pivot and analytical data models

GETPIVOTDATA, CUBEVALUE, CUBEMEMBER.

Deduplicate shared functions such as SUMPRODUCT while allowing multiple category tags.

## 8. Advanced-function requirements

Do not simplify specialized functions into incorrect substitutes.

For LET, LAMBDA, MAP, BYROW, BYCOL, REDUCE, SCAN, and MAKEARRAY:
- Provide a visual operation builder.
- Let users choose operations, name intermediate values, define reusable calculations, and configure row/column processing without typing formulas.
- Use a safe expression representation internally.
- Do not evaluate arbitrary JavaScript.

For INDIRECT, OFFSET, ADDRESS, ROW, and COLUMN:
- Maintain a real workbook address model.
- Provide visual reference selectors.

For ISFORMULA and FORMULATEXT:
- Preserve formula metadata where available.
- Do not pretend plain imported values contain formulas.

For GETPIVOTDATA:
- Provide a functioning pivot-style summary with fields and aggregations.

For CUBEVALUE and CUBEMEMBER:
- These depend on a suitable analytical model/connection.
- Implement a real provider interface and connection configuration.
- Include a clearly labeled demonstration provider to test the workflow.
- A demo provider must not be presented as full Excel cube compatibility.
- Never invent results when a connection is missing.
- Clearly report any production connector still requiring credentials or infrastructure.

## 9. Ready-made automated workflows

Provide workflows that combine the functions above.

### Office and HR
- Attendance summary.
- Working days between dates.
- Years/months of service.
- Salary totals.
- Overtime using user-provided rules.
- Department-wise payroll.
- Duplicate employee detection.
- Employee record lookup.

### Schools and universities
- Total and average marks.
- Percentage.
- Pass/fail using a configurable threshold.
- Grades using user-defined grade bands.
- Student rankings.
- Subject-wise summaries.
- Attendance percentage.
- GPA/CGPA using explicit grade-point mappings and credit hours.
- Fee paid/outstanding summaries.

### Accounts and sales
- Income and expense totals.
- Profit and profit margin with clearly defined inputs.
- Customer balance.
- Invoice aging.
- Monthly sales summaries.
- Commission using user-provided rules.
- Loan installments.
- Depreciation.
- Investment cash-flow analysis.

### Industry and inventory
- Opening stock plus receipts minus issues.
- Reorder alerts using user-provided thresholds.
- Material and production costs.
- Defect percentage.
- Production efficiency using defined targets.
- Unit conversion.
- Batch and packing calculations.
- Supplier comparisons.

### Research
- Descriptive statistics.
- Correlation.
- Regression.
- Probability calculations.
- Confidence intervals.
- Statistical tests.

Never hard-code tax laws, institutional grading policies, overtime rules, or business assumptions without letting the user configure them.

## 10. Results and automation

Support:
- Single-value results.
- New calculated columns.
- Summary tables.
- Dynamic array outputs.
- Matrix outputs.
- Charts where appropriate.
- Row-specific errors without hiding valid results.

Each result must show:
- Task name.
- Input dataset and columns.
- Selected settings.
- Result and units where applicable.
- Any skipped or invalid rows.
- Calculation timestamp.

Provide:
- Copy result.
- Add result to worksheet.
- Export result.
- Save as reusable operation.
- Reapply an operation to another compatible dataset.
- Optional automatic recalculation when inputs change.
- Multi-step pipelines, such as clean names → match IDs → calculate totals → summarize by department.

Track dependencies between calculations. Detect circular dependencies.

Do not repeatedly change random-number results on unrelated UI renders. Recalculate volatile functions through an explicit calculation policy.

Formula details may be available in an optional advanced panel, but formula entry must never be required.

## 11. Numerical correctness and Excel compatibility

Follow documented Excel behavior for each function as closely as practical.

Explicitly handle:
- Blank cells versus empty strings.
- Text and numeric coercion.
- Error propagation.
- Case-sensitive versus case-insensitive matching.
- Criteria operators and wildcard escaping.
- Exact versus approximate lookups.
- Sorting requirements for approximate lookups.
- Sample versus population statistics.
- Invalid probability inputs.
- Rate units and cash-flow signs.
- Financial day-count conventions.
- Leap years, month-end behavior, and Excel date systems.
- Rounding of negative numbers and midpoint values.
- Dynamic array dimensions and spill conflicts.
- Hidden/filtered rows in SUBTOTAL and AGGREGATE.
- Singular matrices.
- Non-converging RATE, IRR, or XIRR calculations.
- Statistical degrees of freedom and insufficient data.

Do not substitute zero for calculation errors.

Keep full internal precision where feasible and round only when requested or needed for display.

If exact Excel compatibility is not possible for a behavior, document the difference in the function’s help and compatibility report.

## 12. Architecture

Use a centralized typed function registry.

Every function entry must include:
- Canonical Excel name.
- Friendly name.
- Category tags.
- English and Roman Urdu search aliases.
- Description.
- Input schema.
- Validation rules.
- Output type.
- Calculation implementation or adapter.
- Default settings.
- Example data.
- Compatibility notes.
- Test coverage references.

Render forms from this registry where practical.

Keep:
- UI components.
- Import/export.
- Workbook state.
- Calculation engine.
- Numerical routines.
- Search.
- Workflow definitions.
- Persistence.

Separate these concerns so the app remains maintainable.

## 13. Export, saving, and privacy

Support:
- CSV export.
- XLSX export of results and worksheets.
- Saving and reopening app projects with datasets, settings, and calculation history.

Results-only export is the baseline. Export executable Excel formulas only where translation is verified.

Protect exports against spreadsheet formula injection from untrusted text while preserving legitimate numeric values.

For uploaded workbooks:
- Never run macros or embedded scripts.
- Never fetch external workbook links automatically.
- Do not imply unsupported imported formulas were recalculated successfully.
- Clearly distinguish cached values from newly calculated values.

Process locally where practical. Do not upload datasets to third parties without an explicit user action and clear explanation.

Validate file size and structure. Keep the interface responsive during large imports.

## 14. Testing and acceptance criteria

Build meaningful automated tests because numerical correctness is essential.

For every required function:
- Include at least one independently established expected-result test.
- Add edge cases appropriate to the function.
- Cover invalid inputs and error behavior.
- Use tolerances appropriate to numerical algorithms.
- Do not use the implementation itself to generate expected answers.

Test representative end-to-end workflows:
1. Paste marks and calculate totals, percentages, grades, and ranks.
2. Upload attendance and calculate working days with holidays.
3. Match employee IDs across two datasets.
4. Calculate sales totals under multiple conditions.
5. Split and clean imported text.
6. Calculate loan installments.
7. Produce a regression summary.
8. Calculate inventory balances and reorder alerts.
9. Edit inputs and confirm dependent results update.
10. Export and reopen results without losing identifiers or data types.

Generate a function coverage report with:
- Function name.
- Implementation status.
- Test status.
- Compatibility limitations.
- External dependencies.

Do not claim full completion if any required function is a stub, mock calculation, or unsupported placeholder.

If a genuine external dependency blocks a function, isolate and disclose that specific limitation while completing all other work.

## 15. Execution and final handoff

Work in milestones, but continue through implementation rather than stopping after planning:

1. Inspect project and select architecture.
2. Build workbook, grid, import, and state.
3. Implement the registry, search, and input forms.
4. Implement all calculation categories.
5. Build automated workflows.
6. Add exports, persistence, and pipelines.
7. Run numerical and end-to-end tests.
8. Fix discovered problems.
9. Deliver the running application.

Use reasonable defaults and avoid unnecessary clarification. Ask only when a missing decision prevents correct implementation.

Provide at the end:
- Working preview or local run instructions.
- Source code.
- Sample datasets.
- Test results.
- Function coverage report.
- Clearly stated remaining limitations, if any.

The essential product promise is:

**The user supplies data and chooses the required task. The app configures and executes the calculation without requiring the user to write an Excel formula.**