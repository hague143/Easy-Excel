export interface HelpTopic {
  purpose: string;
  result: string;
}

// Every entry is deliberately written for this operation. Input-specific steps,
// examples and compatibility notes are added from the same live function schema.
const entries = `
SUM|Adds selected numbers together, such as all sales amounts or one student's marks across subjects.|The answer is the combined total, in the same unit as your numbers. It does not count how many entries you have.
AVERAGE|Finds the usual value by adding the selected numbers and dividing by how many numeric entries there are.|The answer is the arithmetic mean. A column answers a question about everyone in that column; a row answers a question about one record across columns.
MIN|Finds the smallest number in the selected cells, such as the lowest mark or cheapest quote.|The answer is the lowest value, not the row or person's name. Use a lookup task if you also need the corresponding record.
MAX|Finds the largest number in the selected cells, such as the highest mark or biggest sale.|The answer is the highest value, not the row or person's name. Use a lookup task to retrieve the corresponding record.
COUNT|Counts cells that contain numbers, such as the number of recorded scores.|The answer is a count of numeric cells. Text IDs and names are not counted, even when they look like identifiers you want to count.
COUNTA|Counts cells that have a value, including text, numbers, logical values and errors.|The answer is the number of nonblank entries. Empty text can count as an entry; a genuinely blank cell does not.
COUNTBLANK|Counts cells that are blank or contain empty text, helping you find missing entries.|The answer is a count of missing or empty entries. Numeric zero is a value and must not be counted as a blank.
PRODUCT|Multiplies all selected numeric values, for example length, width and height.|The answer is a single product. For quantity times price on each invoice row, use a row operation or SUMPRODUCT instead of multiplying an entire column together.
ABS|Removes a number's minus sign so you can see its size without its direction.|Each answer is nonnegative. For example, -15 becomes 15 and 15 remains 15; this is not an addition or total.
ROUND|Rounds a number to the number of decimal places you choose.|The result is a new rounded value. Two places means cents; zero means whole numbers; a negative place count rounds to tens or hundreds.
ROUNDUP|Rounds away from zero to the decimal precision you choose.|The size never becomes smaller through rounding: 2.31 rounds up to 2.4 at one decimal place, and a negative value moves farther below zero.
ROUNDDOWN|Removes digits toward zero at the precision you choose.|The size never becomes larger through rounding. Negative numbers move toward zero, which differs from rounding toward negative infinity.
INT|Moves a number down to the next whole number, including for negative values.|The result is an integer no greater than the input. For example, -2.3 becomes -3; use TRUNC if you want -2 instead.
MOD|Finds what is left over after dividing one number by another.|The answer is the remainder, not the quotient. A zero divisor is an error; the sign follows the divisor under Excel's convention.
QUOTIENT|Finds the whole-number portion of a division, discarding the fractional portion.|The answer tells you how many whole groups fit. It does not include a remainder; use MOD to obtain that separately.
SUBTOTAL|Summarizes a selected list while respecting filtered rows and your chosen hidden-row policy.|The answer depends on the chosen summary type. Verify the first worksheet row and reference column so row visibility and nested summaries correspond to your selected values.
AGGREGATE|Performs a selected summary such as total, average, rank or percentile with explicit rules for hidden rows and errors.|The answer uses the summary number and ignore options you choose. Some summaries also require a rank, quartile or percentile setting.
IF|Chooses one result when a condition is true and another result when it is false.|The answer is the true or false outcome you supplied. For pass/fail, compare a score column with your threshold and enter the two labels.
IFS|Checks a list of conditions in order and returns the outcome of the first true condition.|Order matters: later conditions are not used after a match. A missing true condition produces an error rather than an invented default.
AND|Checks whether every supplied condition is true.|TRUE means all conditions passed; FALSE means at least one did not. It does not add the matching amounts.
OR|Checks whether at least one supplied condition is true.|TRUE means one or more conditions passed. FALSE means none passed; it does not by itself calculate a conditional total.
NOT|Reverses a true or false condition, so you can test whether a rule does not apply.|TRUE becomes FALSE and FALSE becomes TRUE. This is useful when you want records that do not meet an existing condition.
SWITCH|Matches a value against a list of named choices, such as a department code and its label.|The result is the outcome beside the matching choice, or your explicit default. This is not a numeric range or grade-band comparison.
IFERROR|Replaces a calculation error with a value or message you choose.|Valid inputs stay unchanged. Replacement values are your policy; choosing zero would hide an error, so use a clear message when appropriate.
IFNA|Replaces only the missing-match error with your chosen message or value.|Only #N/A is replaced. Other errors remain visible so invalid arithmetic or references are not silently hidden.
SUMIF|Adds amounts only for rows meeting one condition, such as sales for one region.|The answer is the total of matching amounts. The condition column and amount column must describe the same rows in the same order.
SUMIFS|Adds amounts only for rows meeting every condition you add.|Conditions are combined with AND. For example, Region equals North AND Status equals Paid includes only rows satisfying both rules.
COUNTIF|Counts entries that meet one condition, such as marks at least 40.|The answer is the number of matching entries, not their sum. Choose the comparison and value that express your rule.
COUNTIFS|Counts rows that meet every condition you add.|The answer is the number of rows satisfying all rules together. All condition ranges need matching row positions and lengths.
AVERAGEIF|Finds the average amount or score among rows meeting one condition.|Only matching numeric values contribute to the mean. No matching numeric values produces an error, not an average of zero.
AVERAGEIFS|Finds the average of numeric values among rows meeting every condition.|The result is the mean for the intersection of your rules. Conditions use AND and their rows must align with the value column.
MAXIFS|Finds the largest numeric value among rows meeting all your conditions.|The answer is the maximum matching value. Check the conditions and the no-match convention described in compatibility notes.
MINIFS|Finds the smallest numeric value among rows meeting all your conditions.|The answer is the minimum matching value. It is not the matching person's name or complete record.
XLOOKUP|Finds a value such as an employee ID in one list and returns related information from the matching row or column.|The answer comes from the return range. The lookup keys and return values belong to the same lookup table; matching rules, duplicate handling and missing-result behavior are explicit.
VLOOKUP|Finds a value in the leftmost column of a table and returns a value from another column in that table.|The return column is counted from the left of the selected table starting at 1. Exact matching is safest for IDs; approximate matching requires sorted keys.
HLOOKUP|Finds a value in the top row of a table and returns a value from a lower row in that table.|The return row is counted from the top of the selected table starting at 1. Choose a horizontal layout and confirm exact versus sorted approximate matching.
LOOKUP|Finds an exact or approximate position in a sorted row or column and returns the corresponding value.|This is a vector lookup. Review sorting and approximation rules; use XLOOKUP for explicit duplicate and missing-value controls.
INDEX|Returns the value at a row and column position inside the selected block.|Positions start at 1 within your selected block. They are not necessarily the worksheet's printed row and column numbers.
MATCH|Finds the position of a search value inside one selected row or column.|The answer is a position starting at 1, not the matching value. Approximate modes require the documented sorting order.
XMATCH|Finds a search value's position with explicit matching and search-order controls.|The result is a position within the selected list. Exact, wildcard, next-smaller and next-larger choices answer different questions.
CHOOSE|Selects one item from a list using the item number you provide.|Item 1 means the first choice, item 2 the second. The answer is the selected value, not a worksheet coordinate.
INDIRECT|Reads a cell or block chosen through the workbook's visual reference selector.|The result is the referenced content. The reference must exist in this local workbook; no external workbook is fetched.
ADDRESS|Builds a worksheet address from row and column numbers and your reference-style settings.|The answer is address text, not the value inside that cell. Column 1 is A, and worksheet row 1 contains the column headers.
ROW|Reports the worksheet row number of a chosen cell or range.|The result identifies worksheet position. In this app, row 1 is the header row and row 2 is the first data row.
COLUMN|Reports the worksheet column number of a chosen cell or range.|The result identifies worksheet position: A is 1, B is 2, and so on. It is not the count of filled cells.
ROWS|Counts how many rows are present in a selected rectangular block.|The answer is the block's height, including any blank cells inside it. It does not count only populated records.
COLUMNS|Counts how many columns are present in a selected rectangular block.|The answer is the block's width, including blank cells inside it. Select only the columns whose size you want to measure.
OFFSET|Moves from a chosen starting reference by a number of rows and columns, then reads the resulting block.|Positive row offsets move down and positive column offsets move right. The result uses the height and width you specify without changing the source cells.
LEFT|Takes characters from the beginning of text, for example the first letters of a product code.|The result is text. Choose a character count; selecting a source column produces a separate answer for each row.
RIGHT|Takes characters from the end of text, for example the last digits of a reference.|The result is text and retains the characters' order. Choose the number of ending characters you need.
MID|Takes a chosen number of characters starting at a position inside text.|Character positions start at 1. Spaces count as characters, so clean unwanted spaces first if necessary.
LEN|Counts the characters in text, including spaces, so you can check the length of a name or identifier.|The answer includes spaces. It measures text length, not the number of words or the size of a selected range.
TRIM|Removes leading and trailing ordinary spaces and reduces repeated ordinary spaces between words.|The result is cleaned text while the source remains intact. It does not change letter case and may not remove special nonbreaking spaces.
CLEAN|Removes the supported invisible control characters from imported text.|The answer is cleaned text. It is not a complete removal of every possible Unicode spacing or control character.
UPPER|Changes letters to uppercase, for example turning department names into consistent capital letters.|Each answer preserves the words and spacing while changing letter case, such as Amina becoming AMINA.
LOWER|Changes letters to lowercase, for example standardizing the letter case of email addresses.|Each answer preserves the words and spacing while changing letter case, such as AMINA becoming amina.
PROPER|Capitalizes words using the function's word-boundary rules.|The result is title-style text. Review personal names, abbreviations and special spellings before using it as an official record.
CONCAT|Joins selected text values together without a separator.|The result is one text value. Existing spaces are kept; add them explicitly or choose TEXTJOIN if you need a consistent separator.
CONCATENATE|Joins a list of text parts in order without automatically adding spaces.|The answer is combined text. For readable full names, supply spaces between the parts or use TEXTJOIN with a space separator.
TEXTJOIN|Combines text values with a separator you choose, such as a comma or space.|The answer is one joined string. The ignore-empty setting controls whether empty pieces contribute separators.
TEXT|Displays a number or date serial using a supported format, such as two decimals or a calendar date.|The answer is formatted text. It is no longer a numeric value for arithmetic; the original numeric data remains unchanged.
VALUE|Converts supported numeric text into a number.|The answer can be used in arithmetic. Do not convert identifiers or account numbers that need leading zeros or more than the supported numeric precision.
SUBSTITUTE|Replaces matching text wherever it occurs, or at the occurrence number you choose.|The result changes matching words or characters without using a character position. Review case sensitivity and occurrence settings.
REPLACE|Replaces a specified number of characters beginning at a specified position.|Positions start at 1. This differs from SUBSTITUTE, which searches for matching text rather than a fixed location.
FIND|Finds the position of text inside another text value using case-sensitive matching.|The answer is a character position starting at 1. Missing text is an error; use SEARCH when letter case should not matter.
SEARCH|Finds the position of text using case-insensitive search and supported wildcards.|The answer is a character position, not the matching word. The starting position controls where the search begins.
EXACT|Compares two text values and checks that their letters and case are identical.|TRUE means an exact text match, including case; FALSE means they differ. This is useful for strict code or label checks.
TEXTSPLIT|Breaks text into pieces using column and optional row separators.|The result is a table of pieces. Choose separators actually present in your text and decide how empty pieces and uneven rows should be handled.
TEXTBEFORE|Returns the text before a selected occurrence of a separator.|The result excludes the separator. An occurrence counted from the end lets you select a later part without manually counting characters.
TEXTAFTER|Returns the text after a selected occurrence of a separator.|The result excludes the separator. Configure what should happen if the selected separator is missing.
REPT|Repeats a piece of text the number of times you choose.|The answer is repeated text. Large counts can exceed spreadsheet text-length limits.
CHAR|Converts a supported Windows character code into a character.|The result is one character using the Windows-1252 convention. Use UNICHAR for a Unicode code point.
CODE|Finds the Windows character code of the first character in text.|Only the first character is examined. Use UNICODE for a Unicode code point rather than a Windows legacy code.
UNICHAR|Converts a Unicode code point into its character.|The answer is the character represented by that number. Invalid code points are reported as errors.
UNICODE|Finds the Unicode code point of the first character in text.|The answer is a numeric character identifier. It does not count characters or inspect every character in the input.
NUMBERVALUE|Converts numeric text after you explicitly choose decimal and thousands separators.|The result is a number. Confirm whether a comma means a decimal point or grouping separator before converting international data.
FIXED|Rounds a number and displays it as text with a chosen number of decimals and grouping preference.|The answer is text for presentation. Keep the original number for further calculations.
T|Returns a value only when it is text, otherwise returns empty text.|This is a type filter for individual values. It does not convert numbers to text; use TEXT or another explicit formatting task for conversion.
HYPERLINK|Creates a safe web or email link with a readable label.|The result is a link you can open explicitly. Creating the link does not fetch or upload your spreadsheet data.
TODAY|Gets the current calendar day from the calculation clock.|The result is an Excel date serial. It changes when you calculate again, not on unrelated screen renders; this app uses a UTC calculation clock.
NOW|Gets the current date and time from the calculation clock.|The result is an Excel date-time serial: the whole part is days and the fractional part is time. It updates only through your recalculation policy.
DATE|Builds a calendar date from separate year, month and day numbers.|The answer is an Excel date serial. Review calendar rollover and the 1900 date-system notes when using unusual month or day values.
TIME|Builds a time of day from separate hours, minutes and seconds.|The answer is the fraction of a day represented by that time, for example noon is 0.5. This is not a duration in hours.
DAY|Extracts the day of the month from a date.|The answer is the calendar day number, usually 1 through 31. It does not measure elapsed days between two dates.
MONTH|Extracts the month number from a date.|The answer is 1 for January through 12 for December. Use a text-format task if you want a month name.
YEAR|Extracts the calendar year from a date.|The answer is the year number, such as 2026, without changing the original date.
HOUR|Extracts the hour of a time or date-time.|The answer is the hour within the day, from 0 through 23. It is not the total hours in a multi-day duration.
MINUTE|Extracts the minute part of a time or date-time.|The answer is the minute within the hour, from 0 through 59, not the total elapsed minutes.
SECOND|Extracts the second part of a time or date-time.|The answer is the second within the minute, not a total duration in seconds.
DAYS|Measures the signed number of calendar days between two dates.|The answer is positive when the end is after the start and negative when it is before. Weekends are included.
DATEDIF|Measures completed years, months or days between dates using the unit you select.|The answer depends on the unit: completed months differ from a decimal year fraction. The selected unit must match the service or age question you intend.
YEARFRAC|Measures the fraction of a year between two dates under a chosen day-count convention.|The result is years expressed as a decimal. Different financial bases can produce different answers for the same dates.
WEEKDAY|Converts a date into the day-of-week number under your chosen numbering scheme.|Check which number represents Monday or Sunday. The result is a weekday code, not a count of working days.
WEEKNUM|Finds a date's week number using the selected starting-day and week-numbering convention.|Different conventions can assign different week numbers near year boundaries. Choose ISOWEEKNUM when ISO week numbering is required.
EDATE|Moves a date forward or backward by a chosen number of calendar months.|The result is another date serial. Month-end adjustments keep the result valid when the destination month is shorter.
EOMONTH|Finds the last calendar day of a month a chosen number of months away.|Zero months means the end of the starting month. The result is a date serial rather than the number of days in that month.
NETWORKDAYS|Counts working days between dates, including working start and end days, with Saturday and Sunday excluded.|The answer is a day count after excluding the optional holiday list. Use NETWORKDAYS.INTL for a different weekend pattern.
NETWORKDAYS.INTL|Counts working days using your chosen weekend pattern and optional holidays.|The answer includes qualifying start and end days. Confirm the Monday-to-Sunday weekend mask before using the result for attendance or pay.
WORKDAY|Finds the date reached after moving a number of working days, excluding Saturday, Sunday and holidays.|The starting date is the reference point, not working day number one of the move. The answer is a date serial.
WORKDAY.INTL|Finds a date a chosen number of working days away using your weekend and holiday rules.|Positive moves forward and negative moves backward. The resulting date depends on the exact weekend mask and holiday list supplied.
DATEVALUE|Converts supported ISO calendar-date text into an Excel date serial.|Use year-month-day text to avoid guessing ambiguous dates. The result is a date value, not a day difference.
TIMEVALUE|Converts a supported clock-time text into a fraction of a day.|The answer represents time of day. For example, 12:00 is 0.5; it is not twelve elapsed hours as a standalone number.
DAYS360|Measures the interval between two dates using a financial 360-day-year convention.|The result differs from actual calendar days. Choose the US or European method required by your agreement.
ISOWEEKNUM|Finds the ISO week number of a date.|ISO weeks start on Monday and use a specific first-week rule. Near New Year the ISO week-year can differ from the calendar year.
MEDIAN|Finds the middle value after sorting your numbers.|Half the observations lie on either side of the middle. With an even number of observations it averages the two central values.
MODE.SNGL|Finds a most frequently occurring numeric value.|The answer is a repeated value, not its repetition count. When no numeric value repeats, there is no mode and an error is shown.
MODE.MULT|Finds all numeric values tied for the highest frequency.|The result can contain several values. A list with no repetition has no mode; blank and text handling follows the function notes.
LARGE|Finds the first, second or another ranked largest numeric value.|Choose rank 1 for the largest, rank 2 for the second largest. The answer is a value, not a person's rank or row number.
SMALL|Finds the first, second or another ranked smallest numeric value.|Choose rank 1 for the minimum and rank 2 for the second smallest. The rank must fit the number of numeric observations.
RANK.EQ|Finds where a number ranks among a list, giving tied values the same competition rank.|Choose whether the highest or lowest should rank first. Ties can leave gaps in the following rank numbers.
RANK.AVG|Ranks a number and gives tied values the average of the positions they occupy.|A tie can produce a fractional rank. Select the direction that matches whether a high or low value is best.
PERCENTILE.INC|Finds the value at a chosen proportion of a sorted list, including its endpoints.|Enter 0.9 for the 90th percentile. The result may be interpolated between observations; it is a data value, not 90 percent itself.
QUARTILE.INC|Finds a minimum, lower quartile, median, upper quartile or maximum.|Quartiles divide sorted data into four portions. Select 0 through 4 according to which boundary you want.
STDEV.S|Measures how spread out a sample's numeric observations are around their mean.|The answer uses the same units as the data and estimates population spread from a sample. At least two observations are required.
STDEV.P|Measures the spread of an entire population of numeric observations.|Use it only when the selected records represent the whole population you are describing, rather than a sample used for inference.
VAR.S|Estimates sample variance, a measure of spread based on squared deviations from the mean.|The answer is in squared units. Use STDEV.S if you need a spread measure in the original units.
VAR.P|Measures variance for the complete population supplied.|The answer is in squared units and uses the population divisor. It differs from a sample-variance estimate.
CORREL|Measures the strength and direction of a straight-line association between paired observations.|The answer runs from -1 to 1. Rows must be genuine pairs; association does not prove that one variable causes the other.
FREQUENCY|Counts numeric observations falling within your ascending bin limits.|The result includes an extra final bin for values above the highest boundary. Bin limits and observations are separate inputs.
SUMPRODUCT|Multiplies matching positions in numeric ranges and adds the products, such as quantity times price across invoices.|The answer is one combined sum of products. Matching positions must refer to the same records and have equal dimensions.
FORECAST.LINEAR|Predicts a response for a new X value using a straight line fitted to known paired X and Y observations.|The answer is a predicted Y value. Predictions outside the observed range are extrapolations and may not be reliable.
TREND|Predicts responses for new predictor rows using a fitted linear relationship.|Each output corresponds to a new predictor row. New predictor columns must match the training columns in number and order.
LINEST|Fits a straight-line regression, possibly using several predictors, and can return regression statistics.|Coefficients describe predicted response changes, not proof of causation. Returned coefficients are in reverse predictor order followed by the intercept.
T.TEST|Compares sample means under an explicitly selected paired, equal-variance or unequal-variance t-test.|The result is a p-value, not the difference in means. Tail choice and pairing assumptions must match the research question chosen before inspecting the result.
CHISQ.TEST|Compares observed counts with expected counts under a chi-square model.|The answer is a p-value. Inputs are counts in matching cells, not percentages or arbitrary measurements; check the model's expected-count assumptions.
GEOMEAN|Finds the geometric mean of positive values, useful for multiplicative factors.|The answer is a central multiplicative value. Convert growth percentages to positive factors first when that is the appropriate model.
HARMEAN|Finds the harmonic mean of positive values, useful for some rate problems with equal weighting conditions.|The answer can differ substantially from the arithmetic average. Confirm the problem really requires a harmonic mean and that all values are positive.
TRIMMEAN|Finds a mean after removing an explicitly chosen proportion of the lowest and highest observations.|The trimming proportion is shared between the two tails. The result depends on how many observations can be removed evenly.
PERCENTRANK.INC|Finds a number's relative position inside a selected numeric distribution.|The result is a proportion from 0 to 1. It is a relative rank in this dataset, not a score percentage or probability of success.
COVARIANCE.S|Estimates how two sampled variables vary together from paired observations.|The sign describes the direction of joint variation; the size depends on both units. Use correlation for a unitless comparison.
COVARIANCE.P|Measures covariance for the full population of paired observations supplied.|Use population rather than sample conventions only when appropriate. Keep every X observation aligned with its corresponding Y.
SLOPE|Finds the slope of the fitted straight line relating predictor X to response Y.|The answer is the predicted change in Y for a one-unit increase in X. Swapping X and Y changes the question and result.
INTERCEPT|Finds the predicted Y value where the fitted straight line reaches X equal to zero.|The intercept can be outside the observed data range and may lack a practical interpretation if zero X is not meaningful.
RSQ|Measures the squared straight-line correlation between paired X and Y values.|The result is a proportion of variation associated with the fitted linear relationship. It does not establish causation or guarantee good predictions.
STEYX|Measures the typical residual prediction error around a fitted simple regression line.|The answer is in Y units. It needs enough paired observations to estimate residual variation.
STANDARDIZE|Expresses a value as its distance from a supplied mean in standard-deviation units.|The answer is a z-score: zero is at the mean and a positive value is above it. Use the mean and positive standard deviation appropriate to your comparison.
NORM.DIST|Calculates a normal-distribution cumulative probability or density for a value.|Cumulative output is the probability at or below X. Density is a curve height and must not be interpreted as the probability of one exact continuous value.
NORM.INV|Finds the value corresponding to a chosen cumulative normal probability.|A probability of 0.95 means the value with 95 percent of the model distribution at or below it. Supply the model's mean and positive standard deviation.
BINOM.DIST|Models the probability of a number of successes in a fixed number of independent trials with the same success probability.|Choose exact or cumulative probability explicitly. Trial count, success count and success probability are different inputs.
POISSON.DIST|Models counts of events for a specified average count over a fixed interval.|The exact mode returns the chance of the chosen count; cumulative mode includes all counts up to it. Keep the interval consistent with the mean.
CONFIDENCE.T|Finds the margin to place on either side of a sample mean for a Student t confidence interval.|The answer is a margin, not the interval's endpoints. Use mean minus margin and mean plus margin; choose a valid significance level and sample size.
F.TEST|Compares the variances of two samples using a two-sided F test.|The answer is a p-value. It is not a comparison of means; normality and sampling assumptions still matter.
Z.TEST|Tests a sample mean against a specified population mean using a z-test convention.|The answer is a one-tailed p-value under the documented convention. Confirm the population-standard-deviation assumption and tail direction before interpreting it.
SKEW|Measures sample asymmetry around the mean.|Positive and negative values indicate different tail directions. A small sample or zero spread may not support a valid skewness estimate.
KURT|Measures sample excess kurtosis, describing tail shape relative to a normal reference.|The normal-reference excess is zero. Do not confuse it with ordinary kurtosis, whose normal reference is three.
GROWTH|Fits an exponential relationship and predicts responses for new predictor rows.|All responses used for the logarithmic fit must be positive. Outputs describe an exponential model and are not guaranteed future growth.
LOGEST|Fits an exponential regression and returns multiplicative coefficients, with optional statistics.|Coefficients are factors for an exponential relationship rather than ordinary linear slopes. Match predictor columns and review fit assumptions.
PMT|Finds the equal periodic payment for a loan or savings schedule using a rate per payment period.|A negative payment means money paid out when the principal is positive. For an easier annual-rate form, choose the Loan installments workflow.
IPMT|Finds the interest part of the payment in a specified loan period.|The result is only that period's interest cash flow. Use PPMT for its principal part and keep rate, term and period units consistent.
PPMT|Finds the principal-repayment part of a payment in a specified loan period.|The result excludes interest. Together, principal and interest components use the payment schedule and cash-flow sign convention.
PV|Finds today's equivalent value of a future amount or periodic cash-flow schedule.|The result follows cash-flow signs. The rate and payment count must use the same period, such as months for monthly payments.
FV|Finds the future equivalent balance of a present amount and periodic payments.|The answer is a future cash-flow value, with its sign determined by inflows and outflows. It assumes the rate and payment schedule you supplied.
RATE|Finds the per-period interest rate that balances a payment schedule.|The result is a decimal rate per period, not automatically an annual percentage. A schedule can have multiple roots or fail to converge.
NPER|Finds how many periods a fixed payment schedule takes under a specified rate.|The answer is periods, not automatically years. Divide by payments per year only when the schedule uses that frequency consistently.
NPV|Discounts future cash flows occurring at the end of successive equal periods.|The answer is present value under this timing convention. An immediate initial outlay belongs outside the future-flow series; see the Investment workflow for its time-zero convention.
XNPV|Discounts dated cash flows with irregular spacing using an annual-rate date model.|Each cash flow needs its matching actual date. The result depends on the base date and the documented actual-day convention.
IRR|Finds a per-period discount rate that makes an evenly spaced cash-flow series balance.|Include negative outflows and positive inflows in time order. The returned root is not a guarantee of a unique rate or a sound investment.
XIRR|Finds an annualized balancing rate for cash flows on actual, unevenly spaced dates.|Every amount needs its matching date. Multiple roots, impossible schedules and non-convergence must be considered when interpreting the result.
SLN|Allocates the depreciable cost of an asset evenly across its useful life.|The answer is depreciation per life period. Cost minus salvage value is spread evenly; no tax or local accounting rule is assumed.
DB|Calculates depreciation for a chosen period using a fixed declining-balance method.|Early and later periods can have different depreciation. Review life units and the first-year month setting before comparing with an accounting policy.
DDB|Calculates declining-balance depreciation using an explicit factor.|The answer is depreciation for one selected period. A factor of two describes double-declining balance, not a universal accounting requirement.
CUMIPMT|Totals loan-interest payments across a specified inclusive range of payment periods.|The answer covers only the selected periods and follows the cash-flow sign convention. Period numbers must lie within the schedule.
CUMPRINC|Totals the principal portion of payments across a specified inclusive range.|The answer is principal repaid over those periods, not total installments. Use the same rate, timing and sign conventions as the loan schedule.
MIRR|Calculates a modified return using separate financing and reinvestment assumptions.|The answer is a per-period return under those chosen rates. It differs from IRR because its treatment of positive and negative cash flows is explicit.
RRI|Finds a constant per-period growth rate from a starting value to an ending value.|The result is a decimal growth rate. Period count and the values must form a valid positive-value growth problem.
EFFECT|Converts a nominal annual rate and compounding frequency to an effective annual rate.|The result includes the effect of compounding. It is a decimal rate, so 0.12 represents 12 percent.
NOMINAL|Converts an effective annual rate to a nominal annual rate for a chosen compounding frequency.|The nominal rate depends on compounding periods per year. Do not compare it with another frequency without conversion.
PDURATION|Finds how many periods a present amount needs to reach a future amount at a constant rate.|The answer is time in rate periods. It is not automatically months or years unless the rate uses that unit.
SYD|Calculates depreciation for one period using the sum-of-years-digits method.|The answer is a period's depreciation under this explicit schedule. It is not a local tax allowance.
VDB|Calculates depreciation across an interval using a variable declining-balance method and an optional switch to straight-line.|The result covers the selected start-to-end interval. Factor and switching settings can materially change the answer.
PRICE|Calculates a coupon-paying bond's price per 100 face value from dates, yield and coupon terms.|The answer is a quoted bond price under the selected coupon and day-count conventions. Supply contractual terms rather than guessing them.
YIELD|Finds a coupon-paying bond's yield from its quoted price and payment terms.|The result is an annual decimal yield under the chosen model. Dates, redemption amount, frequency and day-count basis must match the security.
DURATION|Measures a coupon bond's cash-flow-weighted time to payment.|The answer is Macaulay duration in years under the selected conventions. It is a timing measure, not the bond's maturity date.
MDURATION|Calculates modified duration, an approximation to bond-price sensitivity to yield.|The result is a sensitivity measure under the bond's payment and compounding conventions, not a guaranteed future price change.
ACCRINT|Calculates coupon interest accrued between the relevant security dates.|The result depends on issue date, coupon schedule, face value, rate and day-count basis. Confirm whether accrual starts from issue under the selected method.
DISC|Finds a discount security's annual discount rate from its price and redemption amount.|The answer is a decimal discount rate using the selected day-count convention. It is not the same as an investment return on purchase price.
INTRATE|Finds a security's simple annualized return from investment and redemption amounts.|The answer uses the chosen date basis and investment amount. It differs from coupon-bond yield and discount-rate conventions.
TBILLPRICE|Calculates a Treasury-bill price per 100 face value using its discount rate and dates.|The answer uses the actual/360 bill-pricing convention. The dates must satisfy the function's supported short-term maturity range.
TBILLYIELD|Calculates a Treasury-bill yield from its price per 100 face value and dates.|The answer is an annual decimal yield under the bill convention. It is not automatically the quoted bank discount rate.
CEILING.MATH|Rounds a number upward to a chosen multiple under the selected negative-number rule.|The multiple defines the step size, such as batches of 5. Review how negative values are treated rather than assuming ordinary decimal rounding.
FLOOR.MATH|Rounds a number downward to a chosen multiple under the selected negative-number rule.|The answer is a multiple of your step size. Negative-number direction is controlled explicitly.
MROUND|Rounds a number to the nearest chosen multiple.|Use it for increments such as 0.05 or packs of 10. Check sign rules and midpoint behavior for the selected values.
CONVERT|Converts a numeric measurement between supported compatible units.|The answer uses the target unit. Units must describe the same kind of measurement; converting kilograms to meters is invalid.
SQRT|Finds the nonnegative square root of a number.|The answer multiplied by itself gives the input, subject to numeric precision. Negative inputs do not have a real-valued square root here.
POWER|Raises a number to an exponent, such as squaring a measurement.|The answer is a power, not a multiplication by the exponent. Some negative-base and fractional-exponent combinations have no real result.
EXP|Raises the mathematical constant e to a chosen power.|The result is exponential growth or decay on the natural-logarithm scale. Very large powers can exceed the numeric range.
LN|Finds a positive number's natural logarithm, using base e.|This is the inverse of EXP. Zero and negative numbers do not have a real natural logarithm.
LOG|Finds a positive number's logarithm in the base you choose.|The base must be valid and different from one. The result answers which power of that base produces the input.
SIN|Finds the sine of an angle expressed in radians.|The answer is a trigonometric ratio. Convert degrees to radians first when your angle is recorded in degrees.
COS|Finds the cosine of an angle expressed in radians.|The answer is a trigonometric ratio; supplying degrees directly changes the meaning of the input.
TAN|Finds the tangent of an angle expressed in radians.|The answer can become very large near an undefined tangent angle. Use radians rather than degrees.
TRUNC|Removes digits beyond a selected precision, moving toward zero.|At zero decimal places, -2.9 becomes -2. This differs from INT, which moves down to -3.
SIGN|Reports whether a number is positive, zero or negative.|The answer is 1 for positive, 0 for zero and -1 for negative. It does not report the number's size.
GCD|Finds the greatest common divisor of supplied integers.|The result is the largest whole number dividing all inputs without a remainder. Review integer and nonnegative-input requirements.
LCM|Finds the least common multiple of supplied integers.|The answer is the smallest nonnegative common multiple. Large integer problems can exceed reliable numeric precision.
FACT|Multiplies the whole numbers from one through a chosen nonnegative integer.|The result is a factorial. It grows very quickly and is not the same as multiplying your selected data values.
COMBIN|Counts how many groups of a chosen size can be selected when order does not matter.|Selecting A then B is the same group as B then A. Use PERMUT if order matters.
PERMUT|Counts selections of a chosen size when order matters.|A then B and B then A count separately. The number selected cannot exceed the available population for this task.
SUMSQ|Squares the selected numeric values and adds the squares.|The answer is in squared units. It is not the square of the total, and it is not a variance unless additional steps define one.
RAND|Generates a random decimal at least zero and less than one.|The result is a random sample, not a prediction. It remains stored until you explicitly calculate or enable automatic recalculation.
RANDBETWEEN|Generates a random whole number between inclusive lower and upper bounds.|Both endpoints are possible. Recalculating creates a new sample; do not use it as a secure or permanent identifier generator.
RANDARRAY|Generates a rectangular block of random numbers with dimensions and bounds you choose.|The result is an array. Whole-number and decimal choices have different boundary conventions; values change through the explicit recalculation policy.
MMULT|Multiplies two numeric matrices using row-by-column multiplication.|The left matrix's column count must equal the right matrix's row count. The result has the left height and right width.
MINVERSE|Finds the inverse of a square numeric matrix.|The inverse can undo the matrix multiplication mathematically. A singular matrix has no inverse and is reported as an error.
MDETERM|Finds the determinant of a square numeric matrix.|The answer is one number. A zero determinant indicates singularity; very small values require care about numerical precision.
COMPLEX|Builds a complex number from real and imaginary components.|The result is complex-number text using the chosen imaginary suffix. It is not a two-column table.
IMSUM|Adds complex numbers supplied in supported complex-number notation.|The result is a complex-number value in text form. It is different from adding only the real components.
IMPRODUCT|Multiplies complex numbers supplied in supported notation.|The answer includes both real and imaginary effects. Ordinary text concatenation is not complex multiplication.
DEC2BIN|Converts an integer from decimal notation to Excel-style binary text.|The result is text containing binary digits. Review signed-number bit-width and padding limits before using negative values.
BIN2DEC|Converts supported Excel-style binary text into a decimal integer.|The answer is numeric and follows the documented signed-bit convention. Keep leading bits in text until conversion.
DEC2HEX|Converts a decimal integer to Excel-style hexadecimal text.|The answer is base-16 text. Padding and negative signed-number conventions have specific limits.
HEX2DEC|Converts supported hexadecimal text into a decimal integer.|The answer is a number. Letters A through F are hexadecimal digits rather than spreadsheet column references.
FILTER|Keeps rows or columns where a corresponding include flag is true.|The result is a smaller table. Flags must align with the selected data; configure what happens when nothing qualifies.
SORT|Sorts a selected table by a chosen column or row and direction.|The result is a sorted copy. Sort the whole related table so names, IDs and amounts stay together.
SORTBY|Sorts a table using one or more separate key ranges.|Each sort key must align with the records being sorted. Secondary keys decide the order when primary keys tie.
UNIQUE|Finds distinct rows or columns, with an option for entries that occur exactly once.|The result is a deduplicated list or table. Exactly-once filtering differs from keeping one copy of every distinct value.
SEQUENCE|Creates a block of regularly spaced numbers using a start value and step.|The output dimensions determine the number of entries. A negative step creates a descending sequence.
TRANSPOSE|Turns rows into columns and columns into rows.|The result has swapped height and width. Values retain their relative order; this is a layout change, not a numeric calculation.
TAKE|Keeps a chosen number of rows or columns from the beginning or end of a table.|Positive and negative counts choose different ends. Select counts that make sense for the source dimensions.
DROP|Removes a chosen number of rows or columns from the beginning or end of a table.|The result is the remaining block. This creates an output copy and does not delete the source rows.
CHOOSECOLS|Builds a table from selected column positions.|Positions are relative to the selected table, starting at 1, rather than the worksheet's absolute column numbers.
CHOOSEROWS|Builds a table from selected row positions.|Positions are relative to the selected table. Choose the rows in the order you want them to appear.
VSTACK|Places tables one below another, such as appending one month’s sales records below another month’s records.|The output grows downward. Different widths can introduce padding errors, so align the intended columns first.
HSTACK|Places tables next to one another, such as adding another group of fields beside the original records.|The output grows sideways. Different heights may require padding, and rows are paired by position rather than by an ID lookup.
TOCOL|Reads a table into one output column.|Your scan direction and ignore options control the order and whether blanks or errors remain. This is not a summary total.
TOROW|Reads a table into one output row, making a horizontal list from a block of cells.|Your scan direction and ignore options control the sequence. Related records are flattened rather than joined by a key.
EXPAND|Pads a table to a larger number of rows or columns.|Existing values stay in the upper-left area. New positions receive your chosen padding value or the documented default error.
WRAPROWS|Wraps a list into rows with a chosen number of entries per row.|The final row can need a padding value. The result changes the layout without aggregating the entries.
WRAPCOLS|Wraps a list into columns with a chosen number of entries per column.|The last column may need padding. Input order is preserved according to the wrapping direction.
LET|Names intermediate values and uses them in a final calculation built from operation controls.|The answer is the final operation's result. Named values are available to later bindings and the final step, without writing a formula.
LAMBDA|Defines named inputs and a reusable calculation through the visual operation builder.|The result comes from applying your operation to the supplied argument values. Saving the operation lets you reuse the setup later.
MAP|Applies a visual operation separately to each entry in one or two arrays.|The output has one result per processed entry. A bad entry is shown as a row-level error while valid outputs remain available.
BYROW|Applies a visual operation once to each row in a table.|Each answer summarizes or transforms that row. Choose the named row input in the operation builder and return one value per row.
BYCOL|Applies a visual operation once to each column in a table.|Each answer corresponds to one source column. The operation must return one value per processed column.
REDUCE|Processes a list in order, carrying an accumulated value from one step to the next.|The result is the final accumulated value. Your initial value and the meaning of the accumulator are part of the calculation's rules.
SCAN|Processes a list while returning every intermediate accumulated value.|The output shows the running results, such as a running total. Entry order and the initial value matter.
MAKEARRAY|Creates a table by applying a visual operation to each row and column position.|The operation receives row and column numbers. It must produce one value for each position in the requested dimensions.
ISBLANK|Checks whether an individual cell is genuinely blank.|TRUE means no cell value. Empty text is different and returns FALSE; a numeric zero is also not blank.
ISNUMBER|Checks whether a value is stored as a number.|TRUE means numeric type, not simply text that looks numeric. Employee IDs stored as text correctly return FALSE.
ISTEXT|Checks whether a value is stored as text, such as a name or an identifier with leading zeros.|TRUE includes empty text but not a genuinely blank cell. It does not check whether the text contains letters rather than digits.
ISERROR|Checks whether a value is any supported calculation error.|TRUE flags an error for review. It does not repair the error or replace the source data.
ISNA|Checks specifically for the missing-value or missing-match error.|TRUE means #N/A. Other error types return FALSE; use ISERROR if you need to flag every error.
ISLOGICAL|Checks whether a value is a stored TRUE or FALSE value.|Text spelling TRUE is not the same as a Boolean in all input contexts. Confirm the imported type before interpreting the answer.
ISFORMULA|Checks whether a selected cell has retained imported formula metadata.|TRUE refers to original workbook metadata. Plain imported values do not become formulas merely because they look like one.
ISEVEN|Checks whether a number, under the documented integer treatment, is even.|TRUE means divisible by two without a remainder after the function's integer treatment. It is not a check for positive values.
ISODD|Checks whether a number, under the documented integer treatment, is odd.|TRUE indicates odd parity. Review how fractional and negative inputs are treated in the compatibility notes.
ERROR.TYPE|Identifies the supported spreadsheet error category of an input.|The result is an error-type code. A valid ordinary value is not an error and does not receive an invented error classification.
FORMULATEXT|Displays the original formula text retained for a selected imported cell.|The answer is metadata for inspection, not a recalculation. A cell without retained formula metadata produces a missing-formula error.
DSUM|Adds a named numeric field for records matching a separate database criteria table.|The result is a total of qualifying records. Criteria on one row use AND; different criteria rows are alternatives joined with OR.
DAVERAGE|Averages a numeric field for database records matching your criteria table.|The answer uses only qualifying numeric field values. Both the database and criteria tables need their header rows.
DCOUNT|Counts numeric field values among records matching a database criteria table.|The answer is a count of qualifying numeric cells. Use DCOUNTA if populated text fields should also count.
DCOUNTA|Counts populated field values among records matching a database criteria table.|The answer can include qualifying text and other nonblank values. The selected field and criteria headers must identify real database columns.
DMAX|Finds the highest numeric field value among qualifying database records.|The answer is one maximum, not the whole record containing it. Check criteria table headers and matching behavior.
DMIN|Finds the lowest numeric field value among qualifying database records.|The answer is one minimum. The criteria table decides which records participate before the minimum is taken.
DGET|Retrieves a field from exactly one database record matching your criteria.|A missing match or several matches is an error. Add enough criteria to identify the single record you intend.
DPRODUCT|Multiplies numeric field values from all qualifying database records.|The answer is one product, not a sum or per-row multiplication. Include only the records that belong in this multiplication.
DSTDEV|Estimates sample standard deviation of a field for qualifying database records.|The result is in the field's units and needs enough matching numeric observations. It does not use population-standard-deviation conventions.
DVAR|Estimates sample variance of a field for qualifying database records.|The result is in squared units. Criteria select the sample before variance is calculated.
GETPIVOTDATA|Summarizes a selected local table by an explicit field, aggregation and optional field filters.|The answer is the requested filtered summary. This local pivot-style workflow does not read arbitrary Excel PivotTable caches.
CUBEVALUE|Reads an aggregate measure from a configured analytical data provider with optional member filters.|The answer comes from that provider. The included demo uses synthetic sales data and is not a live Excel or SSAS connection.
CUBEMEMBER|Checks or lists dimension members from a configured analytical data provider.|The result is a valid member or list supplied by the provider. Missing connections and unknown members produce errors rather than invented values.
`;

export const functionTopics: Record<string, HelpTopic> = Object.fromEntries(
  entries
    .trim()
    .split('\n')
    .map((line) => {
      const [name, purpose, result] = line.split('|');
      if (!name || !purpose || !result) throw new Error(`Incomplete help topic: ${name}`);
      return [name, { purpose, result }];
    }),
);
