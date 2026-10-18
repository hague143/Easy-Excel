# SheetPilot dummy data and expected results

All records, names, rules, contact addresses, amounts, and holidays here are synthetic. Amounts have no assumed currency. Grade bands and grade points are illustrative test policies, not an institution's rules.

- [Download Excel workbook — 14 worksheets](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/test-data/SheetPilot-Test-Data.xlsx)
- [Download all CSVs, Excel workbook, and this guide](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/SheetPilot-Test-Data.zip)
- [Quick sales CSV](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/test-data/sales.csv)

## Import and first calculation

Open SheetPilot, click **Import data**, and select the XLSX workbook. Keep **Row 1** as headers; dates are ISO/year-month-day. Import all worksheets. Select the imported **Sales overview** worksheet (it may be named **Sales overview (2)** alongside the app's initial sample), choose **Add up a column (SUM)**, confirm that worksheet's **Revenue** column, and click **Calculate**. You should get **33,040**.

For CSVs, use UTF-8 and comma delimiter. The app preserves ID columns and leading zeros; use the Excel workbook to preserve all native types. If you switch worksheets, review the task's dataset/column dropdowns before calculating.

## Tests to try

| File or worksheet | Task and settings | Expected result |
| --- | --- | --- |
| sales.csv / Sales overview | SUM Revenue | **33,040** |
| Sales overview | AVERAGE Revenue | **2,753.333333…** |
| Sales overview | SUM Cost | **20,450** |
| Sales overview | SUMIFS Revenue; Region equals North **AND** Status equals Paid | **10,960** |
| employees.csv / Employee directory | SUM Salary | **700,000** |
| Employee directory + Employee lookup records | Employee record lookup; search text **0001** from the directory; select both lookup IDs and return Email from **Employee lookup records** | **ayesha@example.test** |
| students.csv / Student marks | SUM Mathematics | **577** |
| Student marks | Pass or fail; Mathematics; threshold **40** | **7 Pass, 1 Fail** |
| Student marks | Total and average marks; range **C2:E9** | Amina total **275**, Noor total **289** |
| Student marks + Grade bands | Grades; Mathematics; bands table without headers | Amina **A**, Zain **B**, Hira **B**, Usman **D**, Noor **A**, Daniyal **C**, Iqra **B**, Saad **F** |
| GPA courses + Grade points | GPA / CGPA; Grade, Credit hours, mapping table without headers | **3.7**, from **37** quality points / **10** credits |
| attendance.csv / Attendance register | SUM Hours | **55** |
| Attendance register | Attendance summary; present statuses **Present**; eligible statuses **Present, Absent** | **87.5%** (Leave excluded explicitly) |
| holidays.csv / Holiday list | Working days; **2026-01-01** to **2026-01-16**, inclusive; weekend mask **0000011**; holidays from Date column | **10** working days |
| inventory.csv / Inventory tracker | Inventory stock balance; SKU, Opening stock, Receipts, Issues | Closing stock **330, 70, 1600, 240, 5500, 25, 46, 720** in row order |
| Inventory tracker | Reorder alerts; SKU, Closing stock, Reorder level | **000102 Safety gloves** and **000106 Motor units** need reorder |
| research.csv / Research observations | SLOPE; Y = Test score, X = Study hours | **5.2424242424…** |
| Research observations | INTERCEPT; Y = Test score, X = Study hours | **47.2666666667…** |
| text-cleaning.csv / Text cleaning | TRIM; select Name through the column-source control | **Amina Khan**, **BILAL AHMED**, **Amina Khan**, **Noor** |
| Text cleaning | Duplicate detection; Record ID | **001** appears **twice** |
| loan-settings.csv / Loan settings | Loan installments; principal **100000**, annual percent **12**, payments/year **12**, total payments **12**, timing **end** | **8,884.8788678…** per payment |

Use the **Column** source mode to pick a vector and **Table** to pick the grade-band or grade-point mapping, with **Include column headers** unchecked. For a text function such as TRIM, click the small column icon beside its text input to choose the Name column. No Excel formulas are needed.

The supplied Closing stock column is an independently stated reference to compare with the stock-balance workflow. The remaining inventory columns are original inputs. No tax, overtime, or grading policy is inferred.

## Import edge cases

`import-checks.csv` / **Import checks** deliberately contains:

- IDs **00001** and **9007199254740993** that must remain exact text.
- A numeric **0**, a genuine blank amount, a text amount **not-a-number**, and **12.5**.
- TRUE/FALSE values and an empty-text note.

The mixed Amount column should raise a mixed-type warning, not turn invalid data into zero. To test strict validation, import **import-checks.csv**, explicitly set Amount to **number** in the preview, and confirm the invalid text becomes a visible error. The Excel workbook preserves its native zero, blank, text, and Boolean cells; CSV has no native cell-type schema.

Regenerate these files with `npm run samples:export`. The generator re-imports the workbook, checks IDs/date types/blank-versus-zero values and CSV structure, verifies 17 independently stated expected results, and checks the ZIP contents byte-for-byte.
