import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

test('large imports page the grid while calculations retain every row', async ({ page }) => {
  const data =
    'Account ID,Amount\n' +
    Array.from({ length: 205 }, (_, i) => `${String(i + 1).padStart(4, '0')},${i + 1}`).join('\n');
  const preview = await uploadCSV(page, 'large.csv', data);
  await preview.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(page.locator('.data-grid tbody tr')).toHaveCount(100);
  await page.getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(page.locator('.data-grid tbody tr').first()).toContainText('0101');
  await page.getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(page.locator('.data-grid tbody tr')).toHaveCount(5);
  await expect(page.locator('.data-grid tbody tr').last()).toContainText('0205');
  await task(page, 'SUM');
  await column(page, 'data', 'Amount');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('21,115');
});

const result = (page: Page) => page.getByRole('region', { name: 'Calculation result' });
async function task(page: Page, name: string) {
  await page.getByRole('button', { name: 'Explore all tasks' }).click();
  const modal = page.getByRole('dialog', { name: 'Choose a calculation' });
  await modal.getByRole('textbox', { name: 'Search functions and tasks' }).fill(name);
  await modal
    .locator('.function-tag')
    .filter({
      hasText: new RegExp(`^${name.replace('WF.', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    })
    .locator('../..')
    .click();
  await expect(modal).toBeHidden();
}
async function sample(page: Page, name: string) {
  await page.getByRole('button', { name: 'Sample data', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Sample datasets' })
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .click();
  await expect(page.locator('.sheet-heading h2')).toContainText(name);
}
async function column(page: Page, key: string, name: string) {
  const select = page.locator(`#field-${key}`);
  const value = await select
    .locator('option')
    .evaluateAll(
      (options, label) =>
        (
          options.find((o) => o.textContent?.startsWith(`${label} · `)) as
            HTMLOptionElement | undefined
        )?.value,
      name,
    );
  expect(value, `Column ${name} is available for ${key}`).toBeTruthy();
  await select.selectOption(value!);
}
async function literal(page: Page, key: string, value: string) {
  const field = page.locator('.field').filter({ has: page.locator(`label[for="field-${key}"]`) });
  await field.getByRole('button', { name: 'Values', exact: true }).click();
  await page.locator(`#field-${key}`).fill(value);
}
async function calculate(page: Page) {
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator('.result-error-content')).toHaveCount(0);
}
async function uploadCSV(page: Page, name: string, content: string) {
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content) });
  const dialog = page.getByRole('dialog', { name: 'Let’s bring in your data' });
  await expect(dialog.locator('.import-preview')).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as Page & { appErrors?: string[] }).appErrors = errors;
  const html = process.env.SHEETPILOT_STANDALONE_HTML;
  // The managed cloud browser forbids file:// navigation. Supply the exact HTML
  // through an intercepted loopback document, with the browser otherwise offline.
  // No server is started and any request for another asset fails this test.
  const portableURL = 'http://127.0.0.1/sheetpilot-standalone.html';
  if (html) {
    const body = await readFile(html, 'utf8');
    await page.route(portableURL, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body }),
    );
    page.on('request', (request) => {
      if (/^https?:/i.test(request.url()) && request.url() !== portableURL)
        errors.push(`External request from standalone HTML: ${request.url()}`);
    });
  }
  await page.goto(html ? portableURL : '/');
  await expect(
    page.getByRole('heading', { name: 'Good data. Great possibilities.' }),
  ).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { appErrors?: string[] }).appErrors).toEqual([]);
});

test('pasted student marks produce totals, percentages, explicit grades and ranks', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const table = page.getByRole('table', { name: 'Untitled sheet editable worksheet' });
  await table.locator('tbody tr').first().locator('td').first().click();
  await table.evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', '75\t85\t90\n60\t70\t80');
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData }));
  });
  await task(page, 'WF.MARKS');
  const field = page.locator('.field').filter({ has: page.locator('label[for="field-data"]') });
  await field.getByRole('button', { name: 'Range', exact: true }).click();
  await page.locator('#field-data').fill('A2:C3');
  await calculate(page);
  await expect(result(page).getByRole('cell', { name: '250', exact: true })).toBeVisible();
  await expect(result(page).getByRole('cell', { name: '210', exact: true })).toBeVisible();
  await task(page, 'WF.PERCENTAGE');
  await literal(page, 'data', '250,210');
  await page.locator('#field-maximum').fill('300');
  await calculate(page);
  await expect(result(page).getByRole('cell', { name: '70', exact: true })).toBeVisible();
  await task(page, 'WF.GRADES');
  await literal(page, 'data', '85,70,39');
  await literal(page, 'bands', '[[0,"F"],[40,"Pass"],[80,"Distinction"]]');
  await calculate(page);
  await expect(result(page).getByRole('cell', { name: 'Distinction', exact: true })).toBeVisible();
  await task(page, 'WF.RANKINGS');
  await literal(page, 'data', '80,90,90,70');
  await calculate(page);
  await expect(result(page).getByRole('row').nth(1)).toHaveText('1803');
});

test('attendance upload previews dates and working days exclude a selected holiday', async ({
  page,
}) => {
  const modal = await uploadCSV(
    page,
    'attendance.csv',
    'Employee ID,Date,Status\n0001,03/04/2026,Present\n0002,04/04/2026,Absent',
  );
  await expect(modal.getByRole('button', { name: 'Import data', exact: true })).toBeDisabled();
  await modal.getByRole('combobox', { name: 'Date order' }).selectOption('dmy');
  await expect(modal.locator('.import-preview')).toContainText('2026-04-03');
  await modal.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(page.locator('.data-grid')).toContainText('0001');
  await task(page, 'WF.WORKING_DAYS');
  await page.locator('#field-start').fill('2024-01-01');
  await page.locator('#field-end').fill('2024-01-07');
  await page.locator('#field-weekend').fill('0000011');
  await literal(page, 'holidays', '2024-01-01');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('4');
});

test('employee identifier lookup uses a second dataset without losing leading zeros', async ({
  page,
}) => {
  await sample(page, 'Employee directory');
  await task(page, 'WF.EMPLOYEE_LOOKUP');
  await column(page, 'data', 'Employee ID');
  await column(page, 'values', 'Name');
  await page.locator('#field-search').fill('0001');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('Ayesha Khan');
  const valuesField = page
    .locator('.field')
    .filter({ has: page.locator('label[for="field-values"]') });
  await valuesField
    .getByRole('combobox', { name: 'Return values dataset', exact: true })
    .selectOption({ label: 'Employee lookup records' });
  await column(page, 'values', 'Email');
  const dataField = page.locator('.field').filter({ has: page.locator('label[for="field-data"]') });
  await dataField
    .getByRole('combobox', { name: 'Employee identifiers dataset', exact: true })
    .selectOption({ label: 'Employee lookup records' });
  await column(page, 'data', 'Employee ID');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('ayesha@example.test');
});

test('sales totals apply two AND conditions through the form', async ({ page }) => {
  await task(page, 'SUMIFS');
  await column(page, 'data', 'Revenue');
  await page.getByRole('button', { name: 'Add condition', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Condition 1 column', exact: true })
    .selectOption({ label: 'Region' });
  await page.getByRole('textbox', { name: 'Condition 1 criteria', exact: true }).fill('North');
  await page.getByRole('button', { name: 'Add condition', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Condition 2 column', exact: true })
    .selectOption({ label: 'Status' });
  await page.getByRole('textbox', { name: 'Condition 2 criteria', exact: true }).fill('Paid');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('10,960');
});

test('text cleaning and splitting run from user values and an explicit example', async ({
  page,
}) => {
  await task(page, 'TRIM');
  await page.locator('#field-text').fill('  Amina   Khan  ');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('Amina Khan');
  await task(page, 'TEXTSPLIT');
  await page.getByRole('button', { name: 'Try with example values' }).click();
  await calculate(page);
  await expect(result(page).getByRole('table')).toBeVisible();
  await expect(result(page).getByRole('cell')).not.toHaveCount(0);
});

test('loan installments accept annual rate, frequency, term and timing', async ({ page }) => {
  await task(page, 'WF.LOAN');
  await page.locator('#field-principal').fill('1200');
  await page.locator('#field-annualRate').fill('0');
  await page.locator('#field-frequency').fill('12');
  await page.locator('#field-payments').fill('12');
  await calculate(page);
  await expect(result(page).getByRole('row').nth(1)).toHaveText('10012000');
});

test('regression summary reports independently established coefficients', async ({ page }) => {
  await task(page, 'WF.REGRESSION');
  await literal(page, 'x', '1,2,3,4');
  await literal(page, 'y', '3,5,7,9');
  await calculate(page);
  await expect(result(page).getByRole('row').filter({ hasText: 'Slope' })).toHaveText('Slope2');
  await expect(result(page).getByRole('row').filter({ hasText: 'Intercept' })).toHaveText(
    'Intercept1',
  );
  await expect(result(page).getByRole('row').filter({ hasText: 'R²' })).toHaveText('R²1');
});

test('inventory balances and reorder thresholds use supplied columns', async ({ page }) => {
  await sample(page, 'Inventory tracker');
  await task(page, 'WF.STOCK');
  await column(page, 'data', 'SKU');
  await column(page, 'opening', 'Opening stock');
  await column(page, 'receipts', 'Receipts');
  await column(page, 'issues', 'Issues');
  await calculate(page);
  await expect(result(page).getByRole('row').nth(1)).toHaveText('000101330Available');
  await task(page, 'WF.REORDER');
  await column(page, 'data', 'SKU');
  await column(page, 'stock', 'Opening stock');
  await column(page, 'thresholds', 'Reorder level');
  await calculate(page);
  await expect(result(page).getByRole('table')).toContainText('Sufficient');
});

test('editing inputs recalculates dependent results and supports undo and redo', async ({
  page,
}) => {
  await column(page, 'data', 'Revenue');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('33,040');
  await page.locator('label.auto-toggle').click();
  await expect(page.getByRole('checkbox', { name: 'Recalculate when data changes' })).toBeChecked();
  const cell = page.locator('.data-grid tbody tr').first().locator('td').nth(6);
  await cell.dblclick();
  await page.getByRole('textbox', { name: 'Edit Revenue row 2' }).fill('3400');
  await page.getByRole('textbox', { name: 'Edit Revenue row 2' }).press('Enter');
  await expect(result(page).locator('.scalar-result')).toContainText('34,040');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(result(page).locator('.scalar-result')).toContainText('33,040');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(result(page).locator('.scalar-result')).toContainText('34,040');
});

test('XLSX import, safe exports, project download/reopen and explicit browser save retain types', async ({
  page,
}) => {
  const excel = new ExcelJS.Workbook();
  const ws = excel.addWorksheet('Imported IDs');
  ws.addRow(['Employee ID', 'Amount', 'Active', 'Text']);
  ws.addRow(['0001', 0, true, '=1+1']);
  ws.addRow(['9007199254740993', 15, false, 'safe']);
  const bytes = await excel.xlsx.writeBuffer();
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'identifiers.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(bytes),
    });
  const modal = page.getByRole('dialog', { name: 'Let’s bring in your data' });
  await expect(modal.locator('.import-preview')).toContainText('9007199254740993');
  await modal.getByRole('button', { name: 'Import data', exact: true }).click();
  await page.locator('.sheet-toolbar').getByRole('button', { name: 'Export', exact: true }).click();
  const csvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Current sheet as CSV' }).click();
  const csv = await csvEvent;
  expect(await readFile((await csv.path())!, 'utf8')).toContain('"\'=1+1"');
  await page.locator('.sheet-toolbar').getByRole('button', { name: 'Export', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full SheetPilot project' }).click();
  const download = await downloadEvent;
  const saved = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(saved.workbook.sheets.at(-1).rows).toEqual([
    ['0001', 0, true, '=1+1'],
    ['9007199254740993', 15, false, 'safe'],
  ]);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await page
    .locator('input[type=file]')
    .nth(1)
    .setInputFiles({
      name: 'reopened.sheetpilot.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(saved)),
    });
  await expect(page.locator('.sheet-heading h2')).toContainText('Imported IDs');
  await expect(page.locator('.data-grid')).toContainText('0001');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.reload();
  await expect(page.locator('.sheet-heading h2')).toContainText('Imported IDs');
  await expect(page.locator('.data-grid')).toContainText('9007199254740993');
});

test('responsive navigation, Roman Urdu search and mobile calculation stay usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Function library' }).click();
  await page.getByRole('textbox', { name: 'Search functions and tasks' }).fill('jama');
  await expect(page.locator('.function-cards')).toContainText('SUM');
  await page.locator('.function-tag').filter({ hasText: /^SUM$/ }).locator('../..').click();
  await literal(page, 'data', '1,2,3');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('6');
  await page.screenshot({ path: '/tmp/sheetpilot-mobile.png', fullPage: true });
});

test('desktop workspace loads without page errors and has a usable empty result state', async ({
  page,
}) => {
  await expect(page.locator('.results-empty')).toContainText('No formulas required');
  await expect(page.locator('.data-grid tbody tr')).toHaveCount(12);
  await page.screenshot({ path: '/tmp/sheetpilot-desktop.png', fullPage: true });
});

test('IF compares a selected column with an explicit threshold for each row', async ({ page }) => {
  await task(page, 'IF');
  await page.getByRole('button', { name: 'Compare a column with a value' }).click();
  await page
    .getByRole('combobox', { name: 'Compare column', exact: true })
    .selectOption({ label: 'Revenue' });
  await page.getByRole('combobox', { name: 'Comparison operator' }).selectOption('>=');
  await page.getByRole('textbox', { name: 'Comparison value' }).fill('3000');
  await page.locator('#field-ifTrue').fill('High');
  await page.locator('#field-ifFalse').fill('Low');
  await calculate(page);
  await expect(result(page).getByRole('cell', { name: 'High', exact: true })).toHaveCount(5);
  await expect(result(page).getByRole('cell', { name: 'Low', exact: true })).toHaveCount(7);
});

test('LET visual editor changes named values and operations without writing formulas', async ({
  page,
}) => {
  await task(page, 'LET');
  await page.getByRole('textbox', { name: 'Intermediate value 1 name' }).fill('base');
  await page
    .locator('.named-bindings')
    .getByRole('textbox', { name: 'Constant value', exact: true })
    .fill('200');
  const operation = page
    .locator('.field')
    .filter({ has: page.locator('label[for="field-operations"]') });
  await operation.getByRole('textbox', { name: 'Input name', exact: true }).fill('base');
  await operation.getByRole('textbox', { name: 'Constant value', exact: true }).fill('1.2');
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toContainText('240');
});

test('saved operations form an ordered pipeline and reject circular dependencies', async ({
  page,
}) => {
  await literal(page, 'data', '1,2,3');
  await calculate(page);
  await result(page).getByRole('button', { name: 'Save operation', exact: true }).click();
  await task(page, 'AVERAGE');
  await literal(page, 'data', '10,20');
  await calculate(page);
  await result(page).getByRole('button', { name: 'Save operation', exact: true }).click();
  await page.getByRole('button', { name: /^Saved operations/ }).click();
  const cards = page.locator('.operation-card');
  await expect(cards).toHaveCount(2);
  await cards.nth(0).getByRole('textbox', { name: 'Operation name' }).fill('Source total');
  await cards.nth(1).getByRole('textbox', { name: 'Operation name' }).fill('Derived average');
  await cards
    .nth(1)
    .getByRole('combobox', { name: 'Dependency for Derived average', exact: true })
    .selectOption({ label: 'Source total' });
  await page.getByRole('button', { name: 'Run pipeline', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('2 pipeline steps completed');
  await page.getByRole('button', { name: 'Calculation history', exact: true }).click();
  await expect(result(page).locator('.scalar-result')).toContainText('6');
  await page.getByRole('button', { name: /^Saved operations/ }).click();
  await cards
    .nth(0)
    .getByRole('combobox', { name: 'Dependency for Source total', exact: true })
    .selectOption({ label: 'Derived average' });
  await page.getByRole('button', { name: 'Run pipeline', exact: true }).click();
  await expect(page.locator('.inline-error')).toContainText('Circular calculation dependency');
});

test('AVERAGE beginner guide teaches and loads column, row and block selections', async ({
  page,
}) => {
  await task(page, 'AVERAGE');
  for (const item of [
    { label: 'A whole column', range: 'B2:B3', answer: '55' },
    { label: 'One row', range: 'B2:D2', answer: '80' },
    { label: 'A block of cells', range: 'B2:D3', answer: '75' },
  ]) {
    await page.getByRole('button', { name: 'Step-by-step guide for AVERAGE' }).click();
    const guide = page.getByRole('dialog', { name: 'How to use AVERAGE', exact: true });
    await expect(
      guide.getByRole('heading', { name: 'How to choose rows and columns' }),
    ).toBeVisible();
    await guide.getByRole('button', { name: item.label, exact: true }).click();
    await expect(guide.locator('.lesson-answer')).toContainText(
      `${item.range} → Average ${item.answer}`,
    );
    await guide.getByRole('button', { name: 'Load this selection example' }).click();
    await expect(guide).toBeHidden();
    await expect(page.locator('#field-data')).toHaveValue(item.range);
    await calculate(page);
    await expect(result(page).locator('.scalar-result')).toHaveText(`${item.answer}Result`);
  }
  await expect(page.locator('.worksheet-tabs')).toContainText('AVERAGE practice (3)');
  await expect(page.locator('.worksheet-tabs')).toContainText('Sales overview');
});

test('lookup and loan guides explain inputs and load the actual worked example', async ({
  page,
}) => {
  await task(page, 'XLOOKUP');
  await page.getByRole('button', { name: 'Step-by-step guide for XLOOKUP' }).click();
  const lookup = page.getByRole('dialog', { name: 'How to use XLOOKUP', exact: true });
  await expect(lookup).toContainText('same reference records');
  await expect(lookup).toContainText('Duplicate policy');
  await lookup.getByRole('button', { name: 'Load worked example', exact: true }).click();
  await calculate(page);
  await expect(result(page)).toContainText('Bilal');
  await expect(result(page)).toContainText('180');
  await task(page, 'WF.LOAN');
  await page
    .locator('.input-instructions')
    .filter({ hasText: 'How to fill in Total number of payments' })
    .locator('summary')
    .click();
  await expect(page.locator('.input-instructions[open]')).toContainText('60, not 5');
  await page.getByRole('button', { name: 'Step-by-step guide for LOAN' }).click();
  const loan = page.getByRole('dialog', { name: 'How to use LOAN', exact: true });
  await expect(loan).toContainText('12 for 12%');
  await expect(loan).toContainText('payments per year');
  await page.keyboard.press('Escape');
  await expect(loan).toBeHidden();
});

test('a cell-check column follows its beginner instructions for one result per cell', async ({
  page,
}) => {
  const preview = await uploadCSV(page, 'blank-check.csv', 'ID,Value\nA,10\nB,\nC,0');
  await preview.getByRole('button', { name: 'Import data', exact: true }).click();
  await task(page, 'ISBLANK');
  await column(page, 'value', 'Value');
  await calculate(page);
  await expect(result(page).getByRole('cell', { name: 'TRUE', exact: true })).toHaveCount(1);
  await expect(result(page).getByRole('cell', { name: 'FALSE', exact: true })).toHaveCount(2);
});

test('beginner guide remains readable and usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await task(page, 'AVERAGE');
  await page.getByRole('button', { name: 'Step-by-step guide for AVERAGE' }).click();
  const guide = page.getByRole('dialog', { name: 'How to use AVERAGE', exact: true });
  const box = await guide.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await guide.getByRole('button', { name: 'One row', exact: true }).click();
  await expect(guide.locator('.lesson-table td.lesson-selected')).toHaveCount(3);
  await guide.getByRole('button', { name: 'Load this selection example' }).click();
  await calculate(page);
  await expect(result(page).locator('.scalar-result')).toHaveText('80Result');
});
