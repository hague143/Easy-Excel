import type { FunctionDef, InputDef } from '../engine/types';
import { functionTopics } from './catalogue';
import { workflowTopics } from './workflows';

export const topics = { ...functionTopics, ...workflowTopics };
const cellFunctions = new Set([
  'IFERROR',
  'IFNA',
  'T',
  'ISBLANK',
  'ISNUMBER',
  'ISTEXT',
  'ISERROR',
  'ISNA',
  'ISLOGICAL',
  'ERROR.TYPE',
]);
export const isCellInput = (def: FunctionDef, input: InputDef) =>
  !['data', 'matrix', 'conditions', 'operations'].includes(input.type) ||
  (input.key === 'value' && cellFunctions.has(def.name));

export const sourceHelp: Record<string, string> = {
  column:
    'Column reads all data cells down one named column. First choose the dataset, then the column; the header is excluded automatically.',
  range:
    'Range reads only the cells you specify. Click the first cell and Shift-click the last cell in the grid, then choose “Use selected cells”, or type an address such as B2:B10. B2:D2 is one row; B2:D10 is a block.',
  table:
    'Table reads the entire selected dataset. Include headers only when this input asks for them; otherwise names can be mistaken for data.',
  literal:
    'Values lets you type or paste without selecting cells. Separate a list with commas; paste a table using tabs and new lines. Use JSON for mixed types or precise blanks: [10, null, 20].',
  result:
    'Result uses the output of an earlier calculation. Calculate that task first, then choose its result here. Check that its shape and units suit this input.',
};
export const selectionHelp = [
  'A column runs vertically: use it for one field across many records, such as everyone’s Mathematics marks. Choose Column and then the named field.',
  'A row runs horizontally: use it for several fields belonging to one record, such as one student’s subject marks. Choose Range and select B2:D2, for example.',
  'A block covers multiple rows and columns, such as B2:D10. Include only the fields needed for this task. Row 1 contains headers; actual records begin at row 2.',
  'Selecting cells highlights them; connect that selection to an input by choosing Range → Use selected cells. Each input can use its own dataset and selection.',
];

const keyed: Record<string, string> = {
  text: 'Type the original text, or choose its column using the source button for one result per record. The function reads the text as supplied; spaces, letter case and leading zeros may matter.',
  delimiter:
    'Enter the exact character or text separating the pieces, such as a comma, space or hyphen. A space is a real separator; do not add quotation marks unless they are part of your data.',
  columnDelimiter:
    'Enter the separator that should start a new column, such as a comma. For A,B,C, a comma creates three output columns.',
  rowDelimiter:
    'Optionally enter a separator that should start a new output row. Leave empty if you only want to split into columns.',
  newText:
    'Enter the replacement text exactly as you want it to appear. Use empty text to remove the matching text or selected character span.',
  oldText:
    'Enter the exact text to replace. This function matches letter case, so a different capitalization may remain unchanged.',
  findText:
    'Enter the text to locate inside the source. FIND matches case; SEARCH ignores case and supports wildcards. The answer counts character positions starting at 1.',
  format:
    'Enter a supported display pattern: #,##0.00 for grouped numbers with two decimals, 0% for a fraction displayed as a percentage, or yyyy-mm-dd for a date serial. The output is text rather than a new numeric value.',
  decimals:
    'Enter decimal places for the formatted number: 2 means two digits after the decimal point. The FIXED result is text for display, so keep the original number for arithmetic.',
  decimalSeparator:
    'Enter the character used for the decimal fraction in the source text. For 1.234,56 this is a comma. It must differ from the grouping separator.',
  groupSeparator:
    'Enter the character grouping thousands in the source text. For 1.234,56 this is a period. Do not guess it from the computer’s locale.',
  sortIndex:
    'Enter the sort field position within the selected block, starting at 1. Normally this is a column; if sorting columns instead of rows, it is a row position.',
  step: 'Enter the difference between successive numbers. A start of 10 with a step of 5 produces 10, 15, 20. Use a negative step to count downward.',
  sortOrder:
    'Choose ascending for small-to-large numbers or A-to-Z text, and descending for the reverse. Sort whole records together to preserve their relationships.',
  quart:
    'Choose 0 for the minimum, 1 for the lower quartile, 2 for the median, 3 for the upper quartile or 4 for the maximum.',
  percent:
    'Enter the total fraction to trim, between 0 and 1. For example, 0.2 removes roughly 20% overall, split equally between the lowest and highest observations, subject to whole-pair rounding.',
  size: 'Enter the number of independent observations in the sample, not the number of fields or columns. The t-based confidence calculation needs at least two observations.',
  trials:
    'Enter the total number of trials as a nonnegative whole number. The binomial model assumes independent trials with the same success probability.',
  successes:
    'Enter a whole-number success count from zero through the total trials. With cumulative enabled, the answer includes that count and smaller counts.',
  chosen:
    'Enter how many items to select from the total, as a nonnegative whole number no larger than the available count.',
  power:
    'Enter the exponent: 2 squares the base, 3 cubes it, and 0.5 takes a square root when a real result exists.',
  multiple:
    'Enter the step size to round to, for example 0.05 for five-cent increments or 10 for multiples of ten. Check the function’s sign rules for negative inputs.',
  ifEmpty:
    'Optionally enter a message or value to return if no records match. Leaving this blank keeps the documented empty-result error.',
  arguments:
    'Supply one argument value for each named parameter, in the same order as the comma-separated parameter names. Use Values for a short list.',

  digits:
    'Enter the number of decimal places: 2 for cents, 0 for whole numbers, or -1 for tens. This changes the calculated value, not just its display.',
  divisor:
    'Enter the number you are dividing by. For 17 divided by 5, enter 5 here. It must not be zero.',
  criteria:
    'Choose a comparison such as “greater than or equal to” and enter its value, or enter an Excel condition such as >=50. Text such as Sales matches that label. A question mark matches one character and an asterisk matches several; prefix a literal wildcard with ~.',
  sumRange:
    'Select the amounts to add, in the same row order and length as the condition values. Leave this optional input empty to summarize the condition values themselves.',
  averageRange:
    'Select the numeric values to average, aligned row for row with the condition values. Leave this optional input empty to average the condition values themselves.',
  range:
    'Select the values to test against your condition. For example, choose Department here and Salary in the amounts input to summarize only one department.',
  lookup:
    'Select the lookup key row or column in the reference dataset, such as employee IDs. Exclude the header. Keep the return range aligned with it; choose sorted keys only when the match or search setting requires sorting.',
  returns:
    'Select the values to retrieve from the same reference records as the lookup keys, in the same order. For example, choose Email when the lookup keys are Employee ID. This is the reference dataset, not the list of IDs you are searching for.',
  index:
    'Enter a position counted from 1 within your selected data, not the worksheet column letter. In a vertical lookup table, 1 means its first selected column; in a horizontal lookup table, 1 means its first selected row.',
  reference:
    'Type a worksheet address such as B2:D5. This is an address, not the value inside the cell. Choose the correct worksheet; use a sheet name in the reference when supported.',
  address:
    'Select the cell in the worksheet and use the cell-reference picker, or type its address such as B2. Imported Excel formula information is needed to inspect an original formula; typing ordinary values does not create one.',
  field:
    'Type the exact header name of the field to summarize, such as Sales, or its position starting at 1 within the selected database. This identifies a column, not a criterion value.',
  startRow:
    'Enter the worksheet row number of the first selected data cell. Row 1 is the header, so a column beginning with the first record normally starts at 2. This lets hidden and filtered row metadata line up correctly.',
  ifTrue:
    'Enter the value or label to return when the condition passes, for example Pass. Select the appropriate value type if you need a number rather than text.',
  ifFalse:
    'Enter the value or label to return when the condition fails, for example Fail. This is an output, not a second condition.',
  fallback:
    'Enter the replacement value or explanatory message for the error this task handles. A valid input is kept as it is.',
  holidays:
    'Select or enter actual holiday dates, preferably YYYY-MM-DD, without headers or blanks. Supply only dates you want excluded; holidays are not guessed. Leave the optional list empty if there are none.',
  weekend:
    'For a seven-character mask, write Monday through Sunday in order: 1 means nonworking and 0 means working. 0000011 excludes Saturday and Sunday. Excel INTL functions also accept supported numeric weekend codes.',
  dates:
    'Select the date corresponding to each cash flow, in exactly the same order and length. Use real dates such as 2026-01-31, not month labels.',
  bands:
    'Select a two-column block without headers: minimum score in the first column, grade label in the second. Each minimum starts a band. Define all required bands explicitly; the app does not assume your grading policy.',
  mapping:
    'Select a two-column block without headers: grade text in the first column and its numeric grade points in the second. Include every grade used in your course list.',
  bins: 'Select numeric bucket upper limits in ascending order, such as 10, 20, 30. The output has one extra bucket for observations above the last limit.',
  credits:
    'Choose the credit hours corresponding to each course grade in exactly the same order. Use only included courses; zero-credit and invalid-grade policies follow the task’s validation.',
  presentStatuses:
    'Enter every status that should count as present, such as Present and Late. Use Values for a short list. Spelling must match your attendance data.',
  eligibleStatuses:
    'Enter every status included in the denominator, including absences if they should reduce attendance. Keep present statuses within this eligible list; excluded statuses do not count as possible attendance.',
  thresholds:
    'Select one reorder level for each item in the same order as the item identifiers and stock values. These are your business rules, not levels inferred from past demand.',
  limits:
    'Enter positive ascending aging limits in days, for example 30, 60, 90. Choose the reporting date separately; dates after that date are not overdue.',
  parameters:
    'Enter the variable names the visual operation will use, separated by commas when more than one is required. The worked example shows the correct names and order for this task.',
  initial:
    'Enter the starting accumulated value before the first item is processed. Use 0 for a running sum or 1 for a running product.',
  probability:
    'Enter a fraction between 0 and 1, for example 0.25 for 25%. For an inverse distribution this is the desired cumulative probability; for binomial trials it is the success probability per trial.',
  alpha:
    'Enter the significance fraction: 0.05 corresponds to a 95% confidence interval, because confidence = 1 − alpha. Do not enter 95 here.',
  confidence:
    'Enter a confidence percentage, such as 95 for 95%. This workflow expects a percentage rather than 0.95 or a significance level.',
  cumulative:
    'Turn on for the probability of a value at or below the stated limit. Turn off for a single-event probability in a discrete distribution or a density in a continuous distribution; a density is not the probability of one exact value.',
  sd: 'Enter a positive standard deviation in the same units as the observations. This describes spread, not the mean or variance.',
  standardDeviation:
    'Enter a positive population standard deviation in the same units as the value and mean.',
  sigma:
    'Enter the known population standard deviation if available. Leave this optional input empty to use the sample estimate supported by this task.',
  mean: 'Enter the mean (average) assumed by your model, in the same units as the value being tested.',
  maximum:
    'Enter the total possible marks or amount for each selected record. For a score out of 100, enter 100; it must be positive.',
  packSize:
    'Enter how many units fit in one complete pack. Use a positive whole number, such as 12 units per box.',
  multiplier:
    'Enter the overtime pay multiple, for example 1.5 for time-and-a-half. It is a multiple, not a percentage.',
  annualRate:
    'Enter the nominal annual interest percentage, such as 12 for 12%. This workflow converts it using your payments-per-year setting.',
  nper: 'Enter the total number of periods, not the number of years unless payments are yearly. Five years with monthly payments means 60 periods. Keep the rate and payment on that same period basis.',
  payments:
    'Enter the total number of payments. Five years paid monthly means 60, not 5. Set payments per year separately.',
  pv: 'Enter the present value or principal. Cash received and cash paid use opposite signs: for example, a positive loan principal usually produces negative payments.',
  pmt: 'Enter the payment each period using the cash-flow sign convention. Money paid out is normally negative when the principal received is positive.',
  fv: 'Enter the desired ending balance, often 0 when a loan is fully repaid. Its sign must follow the same cash-flow convention as the other amounts.',
  guess:
    'Enter a reasonable starting rate estimate as a decimal, such as 0.1 for 10%. This helps the numerical search; it is not a promised return or a guarantee of a unique solution.',
  financeRate:
    'Enter the financing rate per cash-flow period as a decimal, such as 0.08 for 8%. Keep the period consistent with your cash-flow list.',
  reinvestRate:
    'Enter the reinvestment rate per cash-flow period as a decimal, such as 0.06 for 6%. Keep the period consistent with your cash-flow list.',
  nominalRate:
    'Enter the nominal annual rate as a decimal, such as 0.12 for 12%. Choose the compounding frequency separately.',
  effectiveRate:
    'Enter the effective annual rate as a decimal, such as 0.1268 for 12.68%. Choose the compounding frequency separately.',
  npery:
    'Enter the number of compounding periods per year, such as 12 for monthly or 4 for quarterly.',
  yld: 'Enter the annual bond yield as a decimal, such as 0.06 for 6%. It is separate from the coupon rate.',
  cost: 'Enter the original asset cost or the included total cost requested by this task. Keep every money amount in the same currency.',
  salvage:
    'Enter the expected asset value at the end of its useful life. Use 0 if no value remains; it should not exceed the asset cost.',
  life: 'Enter the useful life in periods. If you calculate yearly depreciation, use years; if monthly, use months consistently.',
  per: 'Enter the period number to inspect, starting at 1. It must fall within the loan or asset life described by your other settings.',
  factor:
    'Enter the declining-balance multiple. 2 means double declining balance, not a 2% depreciation rate.',
  from: 'Enter a supported, case-sensitive unit code such as m, km, kg or lbm. Choose a destination in the same measurement family. Open the worked example for a supported pair.',
  to: 'Enter the supported destination unit code. It must represent the same kind of measurement as the source unit; length cannot be converted into mass.',
  include:
    'Select one TRUE/FALSE or 1/0 flag per row to keep or remove, or a matching horizontal flag row for columns. Keep the flags aligned with the source range.',
  by: 'Select the first sort-key row or column aligned with the source records. A key can be outside the displayed source range, but must describe the same records.',
  by2: 'Optionally select a second aligned sort key to break ties in the first key. Leave empty for a single-key sort.',
  indices:
    'Enter positions within the selected range, starting at 1; negative positions count from its end. For example, 1, 3 chooses its first and third rows or columns. Repeated positions repeat the corresponding output.',
  wrapCount:
    'Enter a positive whole number of items in each new row or column. An incomplete final group is filled with the padding value.',
  pad: 'Enter the value used to fill new or incomplete cells. This is an output filler, not another source range.',
  connection:
    'Use demo for the bundled local analytical model. A production connection requires a configured provider; a connection name alone does not connect to a server.',
  measure:
    'Enter a measure available in the chosen provider. The demo model supports Sales and Units; it does not read your currently selected worksheet.',
  dimension: 'Enter the provider dimension name, such as Region or Product for the demo model.',
  member:
    'Enter an existing member of the chosen dimension, or leave blank to list available members. This refers to the analytical model, not a worksheet cell.',
};

function specific(def: FunctionDef, input: InputDef): string | undefined {
  const { name } = def,
    k = input.key;
  if (k === 'start' && ['MID', 'REPLACE', 'FIND', 'SEARCH'].includes(name))
    return 'Enter the starting character position, counting from 1 at the left of the text. A position of 2 starts at the second character; it is not a worksheet row number.';
  if (k === 'start' && name === 'SEQUENCE')
    return 'Enter the first number to generate. The Step input determines the difference between successive entries; this is not a worksheet row number.';
  if (k === 'count')
    return 'Enter how many characters to extract or replace, as a nonnegative whole number. Spaces count as characters. The starting position is a separate input when the function provides one.';
  if (k === 'times')
    return 'Enter the nonnegative whole-number count of repetitions. For example, repeating ab three times produces ababab.';
  if (k === 'instance')
    return name === 'SUBSTITUTE'
      ? 'Enter 1 to replace the first occurrence, 2 for the second, or 0 to replace all occurrences. This counts matches of the text to find, not character positions.'
      : 'Enter 1 for the first occurrence of the separator or 2 for the second. A negative number counts from the end, so -1 selects the last separator.';
  if (k === 'matchMode' && input.type === 'number')
    return 'Enter 0 for a case-sensitive separator match or 1 to ignore letter case. This controls how the separator is recognized, not the case of the output text.';
  if (['rows', 'columns'].includes(k) && ['TAKE', 'DROP'].includes(name))
    return 'Enter a count relative to the selected block. Positive counts start at the top (rows) or left (columns); negative counts start at the bottom or right. Optional blank columns keeps the full width. TAKE keeps these cells; DROP removes them from the output copy.';
  if (['rows', 'columns'].includes(k) && name === 'OFFSET')
    return 'Enter the shift from the original reference: positive moves down for rows or right for columns, negative moves up or left. Zero keeps that direction unchanged. The result must stay within the worksheet.';
  if (['row', 'column'].includes(k) && name === 'INDEX')
    return 'Enter a position within the selected block, starting at 1, not the absolute worksheet row or column. Zero returns the whole selected row or column according to the other position.';
  if (['rows', 'columns'].includes(k))
    return 'Enter the whole-number size of the result in this direction. Rows are vertical records and columns are horizontal fields. This controls output dimensions, not a cell address.';
  if (k === 'actual' && name === 'CHISQ.TEST')
    return 'Select the rectangular block of observed counts, without headers. Each cell must represent the same category as the corresponding cell in the expected-counts block.';
  if (k === 'expected' && name === 'CHISQ.TEST')
    return 'Select positive expected counts calculated under your model, with exactly the same dimensions and category order as observed counts. Use counts rather than percentages.';
  if (k === 'table')
    return name === 'HLOOKUP'
      ? 'Choose a block whose first row contains the search keys and whose later rows contain return values. Exclude unrelated headings. The return row number starts at 1 inside this block.'
      : 'Choose a block whose first column contains the search keys and whose later columns contain return values. Exclude headers. The return column number starts at 1 inside this block.';
  if (k === 'database')
    return 'Choose Table and enable “Include column headers”, or select a range starting on row 1. Each column needs a distinct header and each subsequent row must be one record.';
  if (k === 'criteria' && input.type === 'matrix')
    return 'Select a criteria table including its header row. Headers must match database fields. Conditions on one criteria row are AND; separate criteria rows are OR. Example: headers Region and Sales, followed by North and >100.';
  if (k === 'value' && /LOOKUP|MATCH/.test(name))
    return 'Type the key to find, such as an employee ID, or use the source button to search one key per row from another column. Keep ID data types consistent; text 001 is different from numeric 1.';
  if (k === 'rate')
    return name === 'XNPV'
      ? 'Enter the annual discount rate as a decimal: 0.1 means 10% per year. The dated cash flows determine the time intervals.'
      : name.startsWith('WF.')
        ? 'Enter a percentage, such as 5 for 5%. Keep its period consistent with the amounts or cash flows described by this task.'
        : /Annual coupon/.test(input.label)
          ? 'Enter the annual coupon rate as a decimal, such as 0.05 for 5%. This is the bond’s coupon, not its market yield.'
          : 'Enter the rate per period as a decimal. For 12% annual interest with monthly periods, enter 0.12 / 12 = 0.01. Use the same period basis for payments and period count.';
  if (k === 'frequency')
    return name === 'WF.LOAN'
      ? 'Enter payments per year: 12 for monthly, 4 for quarterly, or 1 for yearly. This converts the annual interest rate; total payments is a separate setting.'
      : 'Choose the number of bond coupon payments per year. Use the bond’s actual schedule, commonly annual, semiannual or quarterly.';
  if (k === 'k')
    return /PERCENTILE/.test(name)
      ? 'Enter a fraction from 0 to 1: 0.25 means the 25th percentile, 0.5 the median. Do not enter 25 for 25%.'
      : name === 'AGGREGATE'
        ? 'For LARGE/SMALL enter a rank starting at 1; for percentiles use a fraction from 0 to 1; for quartiles use the supported quartile number. Other summaries ignore this setting.'
        : 'Enter the rank starting at 1: 1 means the largest or smallest value, 2 the next one. It cannot exceed the number of numeric observations.';
  if (k === 'threshold')
    return name === 'WF.OVERTIME'
      ? 'Enter the regular-hours allowance for the same period as your hours column, such as 40 for a week. Only hours above it qualify for overtime.'
      : 'Enter your minimum score or sales threshold, in the same units as the selected values. Check the result description for the boundary rule.';
  if (k === 'condition')
    return 'For one decision, set True or False. For one decision per record, choose “Compare a column with a value”, select the score or other column, choose a comparison and enter the threshold.';
  if (k === 'conditions' || k === 'cases' || k === 'filters') {
    if (name === 'IFS')
      return 'Add conditions and outcomes in the order to check them. Each condition must be true or false. Put a final true condition last if you want an explicit fallback outcome.';
    if (name === 'SWITCH')
      return 'Add one match value and its output per choice. Match values are exact choices, not expressions such as >=50. The first exact match wins.';
    if (/CUBE/.test(name))
      return 'Add a dimension column name and member value per filter, for example Region and North. Use names from the selected analytical provider; all filters apply together.';
    if (name === 'GETPIVOTDATA')
      return 'Add a source column name, comparison operator and comparison value per filter. All filters apply together to the source table before summarizing the selected field.';
    return 'Add a rule for each condition: choose its column or range, comparison and value. Every condition must line up with the same records as the values input. All rules must pass for a row to be included.';
  }
  if (input.type === 'operations')
    return k === 'bindings'
      ? 'Add a name and a value or visual operation for each named input. Later names may use earlier ones. Use those names in the final operation; the example illustrates a complete setup.'
      : `Build the calculation using the operation dropdown and its inputs. Choose Variable to refer to the supplied parameter names${['BYROW', 'BYCOL'].includes(name) ? ' (the default values variable contains the current row or column)' : ['REDUCE', 'SCAN'].includes(name) ? ' (the defaults are accumulator and value)' : name === 'MAKEARRAY' ? ' (the defaults row and column are positions starting at 1)' : ''}. Choose Value for a fixed number. Nested operations are edited with the same controls; no Excel formula typing is required.`;
  if (k === 'values' || (k === 'data' && name === 'WF.INVESTMENT')) {
    if (['NPV', 'XNPV', 'IRR', 'XIRR', 'MIRR', 'WF.INVESTMENT'].includes(name))
      return `Select cash flows in chronological order, with money paid out negative and money received positive. ${name === 'NPV' ? 'The first value is at the end of period 1; handle a time-zero investment separately.' : 'Include the initial time-zero investment first when applicable.'} Keep all amounts in one currency.`;
  }
  if (k === 'x' || k === 'y' || k === 'array1' || k === 'array2' || k === 'newX') {
    if (input.type === 'data' || input.type === 'matrix')
      return ['T.TEST', 'F.TEST', 'WF.STATISTICAL_TEST'].includes(name)
        ? 'Select the numeric observations in this sample, without headers. Independent samples may have different sizes. A paired test requires matched observations in the same order and equal lengths; choose assumptions that fit your study.'
        : name === 'SUMPRODUCT'
          ? 'Select one numeric range. Both ranges must have the same shape and matching positions: quantity for a row must correspond to the price for that row.'
          : k === 'newX'
            ? 'Optionally select new predictor values to predict outcomes for. Use the same predictor column layout and units as the known X input; leave blank to fit the original observations.'
            : 'Select the observations for this variable. X is the predictor and Y is the outcome. Keep corresponding observations on matching rows; do not sort one range independently. Exclude headers and unrelated totals.';
  }
  if (k === 'matrix1')
    return 'Select a rectangular numeric block without headers. Its number of columns must equal the number of rows in the right matrix.';
  if (k === 'matrix2')
    return 'Select a rectangular numeric block without headers. Its number of rows must equal the number of columns in the left matrix. Matrix multiplication is not cell-by-cell multiplication.';
  if (k === 'matrix')
    return 'Select a square block of numbers, with the same number of rows and columns, excluding headers. An inverse also requires a nonsingular matrix; dependent rows cannot be inverted.';
  if (k === 'data' && name === 'WF.MARKS')
    return 'Choose Range and select only the subject-score columns for all students, such as B2:D20. Each row is one student. Exclude names, IDs, headers, and an existing Total column so it is not counted twice.';
  if (k === 'data' && cellFunctions.has(name))
    return 'Use Values for one value, or select a column/range to check each cell separately. The output gives one result per selected cell rather than a single summary. Use a single column or row when applying this to a list.';
  if (
    input.type === 'data' &&
    name.startsWith('WF.') &&
    [
      'rates',
      'amounts',
      'groups',
      'billed',
      'paid',
      'opening',
      'receipts',
      'issues',
      'stock',
      'extras',
      'attended',
      'eligible',
      'defects',
      'inspected',
      'actual',
      'targets',
      'quantities',
    ].includes(k)
  )
    return `Select the ${input.label.toLowerCase()} column without its header. Keep each value on the same row as its corresponding record in the other inputs; never sort just this column. Use the same units and reporting period throughout.`;
  return keyed[k];
}

export function inputGuidance(def: FunctionDef, input: InputDef): string {
  const text =
    specific(def, input) ??
    (input.type === 'data'
      ? `Choose the ${input.label.toLowerCase()} column for all records, or Range for only certain cells. Exclude headers, existing totals and unrelated fields. Use Values to type a short list instead.`
      : input.type === 'matrix'
        ? `Choose Range and select the rectangular ${input.label.toLowerCase()} block. Keep its row and column order intact. Exclude headers unless this input explicitly requests them; use Table only if all its columns belong in the calculation.`
        : input.type === 'date'
          ? `Enter ${input.label.toLowerCase()} as YYYY-MM-DD, such as 2026-01-31. For one date per record, use the source button to select a date column. Unambiguous dates prevent day/month confusion.`
          : input.type === 'select'
            ? `Choose the ${input.label.toLowerCase()} policy that answers your question. The choices below describe the supported modes. Review this choice before calculating because it changes how values are interpreted.`
            : input.type === 'boolean'
              ? `Turn this option on for Yes/True, or off for No/False. For this task it controls “${input.label}”; the worked example shows a valid starting choice.`
              : input.type === 'sheet'
                ? 'Choose the worksheet containing the reference. The same cell address can refer to different values on different worksheets.'
                : input.type === 'number'
                  ? `Enter ${input.label.toLowerCase()} as a number without a currency symbol. Use the source button to choose a column if you want one calculation per record; keep related input columns aligned.`
                  : `Enter ${input.label.toLowerCase()} directly. To use a different value for every record, choose the source button and select its column. Keep text identifiers as text when leading zeros matter.`);
  const options = input.options
    ?.map((o) => (typeof o === 'string' ? o : `${o.label} (${o.value})`))
    .join('; ');
  return `${text}${input.description ? ` ${input.description}` : ''}${options ? ` Available choices: ${options}.` : ''}${input.required ? ' This input is required.' : ' You may keep the supplied default or leave this input empty only where the task allows it.'}`;
}

export function functionGuide(def: FunctionDef) {
  const topic = topics[def.name];
  if (!topic) throw new Error(`Missing beginner guide: ${def.name}`);
  const hasSources = def.inputs.some(
    (i) =>
      ['data', 'matrix'].includes(i.type) ||
      (isCellInput(def, i) && ['text', 'number', 'date'].includes(i.type)),
  );
  return {
    ...topic,
    exampleAnswer:
      def.name === 'RAND'
        ? 'A random decimal from 0 (included) to 1 (excluded). Your answer changes; 0.5 is only an illustration.'
        : def.name === 'TODAY'
          ? 'The Excel date serial for the current UTC calendar date. Your answer depends on the day you calculate.'
          : def.name === 'NOW'
            ? 'The Excel date-time serial for the current UTC time. Its whole part is the date and its fractional part is time of day; your answer changes when you calculate.'
            : def.example.expected,
    steps: [
      `Decide what you want to find: ${topic.purpose}`,
      def.inputs.length
        ? `Fill in the inputs below, starting with “${def.inputs[0].label}”. Each input has its own instructions and worked-example value.`
        : 'This task needs no input cells. You can calculate it immediately.',
      ...(hasSources
        ? [
            'Choose the correct dataset for each source. Use Column for a field across records, or Range to connect a particular row or block of cells. Check that headers, IDs and existing totals are included only when requested.',
          ]
        : []),
      'Check the units and settings, then press Calculate. Read the result using the explanation below. If an error appears, check the message and your input selections.',
    ],
    inputs: def.inputs.map((input) => ({
      input,
      instructions: inputGuidance(def, input),
      example: def.example.args[input.key],
    })),
    selection: hasSources ? selectionHelp : [],
    cautions: [
      ...(def.name === 'AVERAGE'
        ? [
            'A zero is a real score and affects the average. Blank cells and text in ranges are ignored; a list without numeric values cannot produce an average. Average only comparable quantities, such as marks with the same maximum.',
          ]
        : []),
      ...(/\.S$|^STDEV$|^VAR$/.test(def.name)
        ? [
            'Sample statistics estimate a wider population; use the population version only when your selected data is the whole population. Sample variance and standard deviation need at least two numeric observations.',
          ]
        : []),
      ...def.compatibility,
      ...(def.external
        ? [
            'This task uses an analytical provider. The bundled demo model is separate from your worksheet data.',
          ]
        : []),
    ],
  };
}

export function operationText(value: any): string {
  if (value === null || value === undefined) return 'Blank';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'object' && value.op) {
    if (value.op === 'variable') return value.name;
    if (value.op === 'value') return operationText(value.value);
    return `${value.op}(${(value.args ?? []).map(operationText).join(', ')})`;
  }
  if (typeof value === 'object' && !Array.isArray(value))
    return Object.entries(value)
      .map(([key, v]) => `${key}: ${operationText(v)}`)
      .join('; ');
  if (Array.isArray(value)) return value.map(operationText).join(' | ');
  return String(value);
}
