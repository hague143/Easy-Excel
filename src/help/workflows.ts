import type { HelpTopic } from './catalogue';

const entries = `
ATTENDANCE|Summarizes attendance statuses and calculates a percentage using your explicit present and eligible status lists.|The percentage is present entries divided by eligible entries. Decide explicitly whether leave or other statuses belong in the denominator.
WORKING_DAYS|Counts working days between two dates using your weekend pattern and holiday list.|The result includes qualifying start and end days. A holiday is excluded only when you supply its date.
SERVICE|Finds completed years and additional completed months of service between two dates.|The result is completed calendar service, not a rounded age or decimal year fraction. Supply a clear as-of date.
SALARY_TOTAL|Adds the salary amounts you select, for example to calculate gross payroll for one pay period.|The result is a gross total of supplied amounts. No tax, deductions, exchange rates or pay-period conversions are inferred.
OVERTIME|Calculates overtime hours and pay from hours worked, hourly rates, a regular-hours threshold and a multiplier.|Each employee receives a result under your supplied rules. Hours and thresholds must describe the same pay period.
DEPARTMENT_PAYROLL|Groups salary amounts by department and adds each department's total.|The output is one summary row per department. Each department label must align with the corresponding employee's salary.
DUPLICATE_EMPLOYEES|Finds employee or other identifiers that appear more than once.|The output identifies repeated IDs, their counts and positions. Leading zeros remain significant when IDs are stored as text.
EMPLOYEE_LOOKUP|Looks up an employee ID and returns a chosen field such as email or department.|Choose both lookup IDs and return values from the lookup dataset in matching row order. The searched ID may come from another dataset.
MARKS|Calculates a total and average across the selected subject marks for each student.|Each row must be one student and each selected column a subject score. Exclude student IDs, credit hours and fee columns from the marks block.
PERCENTAGE|Expresses each achieved amount as a percentage of a maximum you provide.|The answer is achieved divided by maximum times 100. A maximum of 300 and score of 240 gives 80 percent; do not assume every assessment is out of 100.
PASS_FAIL|Labels each score as passing or failing using your explicit minimum passing score.|Scores equal to the threshold pass. Use the same units for scores and threshold, such as marks out of 100 or percentage points.
GRADES|Assigns grade labels using the lower score boundaries and labels you supply.|The result uses the highest qualifying lower boundary. Grade bands are your policy and are not silently taken from any school or university.
RANKINGS|Ranks students using your chosen direction and tie policy.|Competition, average and dense ties produce different rank sequences. Choose whether a higher or lower score should be best.
SUBJECT_SUMMARY|Groups marks by subject and returns counts, totals, means, minima and maxima.|The subject and mark columns must describe matching observations. This expects subject labels paired with marks, rather than a wide block of unrelated subject columns.
ATTENDANCE_PERCENTAGE|Calculates attended sessions as a percentage of eligible sessions for each record.|Supply both numerator and denominator counts. Attended sessions cannot exceed eligible sessions, and a zero denominator is invalid.
GPA|Calculates a credit-weighted GPA or CGPA using your explicit grade-to-point mapping.|The answer is total quality points divided by included credits. Decide which courses, repeats and exclusions belong before calculating.
FEES|Summarizes billed, paid and outstanding fees for the selected student records.|Each student's billed and paid amounts must align with that student's ID. Negative balances can indicate overpayment rather than unpaid debt.
INCOME_EXPENSE|Totals income and expenses separately and calculates their difference.|The output reports the supplied income less supplied expenses. Keep currencies and accounting periods consistent.
PROFIT|Calculates profit and profit margin from revenue and explicitly included total costs.|Profit is revenue minus cost; margin divides profit by revenue, not by cost. Include all costs required by your own accounting definition.
CUSTOMER_BALANCE|Groups signed ledger entries by customer and adds each customer's balance.|Define charges and payments with opposite signs consistently. The result is a balance under that sign convention, not automatically an overdue amount.
INVOICE_AGING|Groups outstanding invoice balances by overdue days relative to an as-of date and your bucket boundaries.|The result separates not-overdue and increasingly overdue balances. Use due dates rather than invoice creation dates unless your policy explicitly says otherwise.
MONTHLY_SALES|Groups dated sales amounts by calendar year and month.|Each transaction date must align with its amount. The result combines matching months while keeping different years separate.
COMMISSION|Calculates commissions using your rate, threshold and chosen threshold basis.|Applying a rate to the whole qualifying sale differs from applying it only to the amount above the threshold. Choose the policy explicitly.
LOAN|Calculates equal installments from the amount borrowed, nominal annual percentage, payment frequency, payment count and timing.|The workflow displays a positive outgoing installment and total interest. Use total payments, such as 36 for three years of monthly payments.
DEPRECIATION|Calculates asset depreciation using your chosen method, useful life, cost, salvage value and period.|Life and period numbers must use the same time unit. The result is a model calculation, not a jurisdiction-specific tax allowance.
INVESTMENT|Analyzes an evenly spaced cash-flow schedule with the initial outlay at time zero.|Amounts paid out are negative and receipts are positive. This workflow's initial-flow timing differs from the low-level NPV function; use dated functions for irregular timing.
STOCK|Calculates closing stock as opening stock plus receipts minus issues for each item.|The output keeps item order and flags negative balances. Quantities must use compatible units for each item.
REORDER|Flags items whose supplied stock is at or below their supplied reorder level.|The threshold belongs to each item and is your business rule. Select current or independently calculated closing stock, rather than an unrelated quantity column.
PRODUCTION_COST|Adds materials, labor and overhead and calculates cost per good output unit.|Each material quantity must align with its unit rate. Include costs explicitly and use good output units for the unit-cost denominator.
DEFECT_PERCENTAGE|Calculates defective units as a percentage of inspected units.|Defective counts cannot exceed inspected counts. Use counts for the same batch or period, not unrelated totals.
EFFICIENCY|Compares actual good output with a defined target for each record.|The percentage is actual divided by target times 100. A result above 100 means output exceeds that supplied target, not necessarily that every resource was used efficiently.
UNIT_CONVERSION|Converts a column of measurements between supported unit codes.|The source and target units must measure the same physical quantity. The result uses the target unit without changing the original data.
PACKING|Calculates whole packs and leftover units from batch quantities and an explicit pack size.|The result separates complete packs and remainder. It does not assume partial packs can be sold or silently round the batch up.
SUPPLIERS|Compares suppliers using unit quotes, required quantity and explicit additional costs.|The output compares total quoted costs for the same required quantity. It does not invent delivery, quality, tax or currency-conversion assumptions.
DESCRIPTIVE|Summarizes observations with count, mean, median, extremes, variance and standard deviation.|Choose sample or population spread explicitly. Different units or measurement meanings should not be combined into one observation list.
CORRELATION|Measures the straight-line association between matched X and Y observations.|Values near 1 or -1 indicate stronger linear association. Pair rows correctly; correlation does not establish causation.
REGRESSION|Fits a simple straight-line model from predictor X and response Y and reports model statistics.|The slope describes predicted change in Y per X unit. Fit statistics do not guarantee good predictions or prove causation.
PROBABILITY|Calculates normal-model cumulative probability or density using your supplied mean and standard deviation.|Cumulative probability and density have different meanings. A density is not the probability of one exact continuous outcome.
CONFIDENCE_INTERVAL|Estimates a two-sided confidence interval for a population mean from sampled observations.|The output includes the mean, lower and upper bounds, confidence percentage and degrees of freedom under the stated t-model assumptions.
STATISTICAL_TEST|Runs your selected paired or independent-sample t-test with an explicit alternative hypothesis.|The output includes a test statistic, degrees of freedom and p-value. Choose pairing, variance assumptions and direction before interpreting the result.
`;
export const workflowTopics: Record<string, HelpTopic> = Object.fromEntries(
  entries
    .trim()
    .split('\n')
    .map((line) => {
      const [name, purpose, result] = line.split('|');
      if (!name || !purpose || !result) throw new Error(`Incomplete workflow help: ${name}`);
      return [`WF.${name}`, { purpose, result }];
    }),
);
