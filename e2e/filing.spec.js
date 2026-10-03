// What a filer does, end to end in a real browser: download the template, fill
// it, upload, generate, download. Every v3.0 file produced here is validated
// against the official OECD schema.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.pageErrors = errors;
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  expect(page.pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('the template downloads with worked examples', async ({ page }) => {
  const { rows } = await h.templateRows(page);
  expect(rows).toHaveLength(2);
  expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['account_number', 'account_balance', 'currency_code']));
});

test('a 2025 return is generated in v2.0 with every account', async ({ page }) => {
  const { file } = await h.templateRows(page);
  await h.fillInstitution(page, { year: 2025 });
  await h.upload(page, file);
  const out = await h.generate(page);
  expect(out.xml).toContain('urn:oecd:ties:crs:v2');
  expect(h.count(out.xml, 'AccountReport')).toBe(2);
});

test('a 2026 return is generated in v3.0 and passes the official schema', async ({ page }) => {
  const { file } = await h.templateRows(page);
  await h.fillInstitution(page, { year: 2026 });
  await h.upload(page, file);
  const out = await h.generate(page);
  expect(out.xml).toContain('urn:oecd:ties:crs:v3');
  expect(h.count(out.xml, 'AccountReport')).toBe(2);
  h.expectSchemaValid(out.path);
});

// Regression: cells are read as displayed text, and a balance formatted
// #,##0.00 was filed as 1.00.
test('an Excel balance formatted with thousands separators is filed at full value', async ({ page }) => {
  const { rows } = await h.templateRows(page);
  const file = h.writeXlsx('formatted', rows.map((r, i) => ({ ...r, account_balance: [1234567.89, 980000][i] })),
    { account_balance: '#,##0.00' });
  await h.fillInstitution(page, { year: 2026 });
  await h.upload(page, file);
  const out = await h.generate(page);
  const balances = [...out.xml.matchAll(/<AccountBalance[^>]*>([^<]*)</g)].map((m) => m[1]);
  expect(balances).toEqual(['1234567.89', '980000.00']);
  h.expectSchemaValid(out.path);
});

test('a row with characters MRA refuses is rejected and explained; the rest is filed', async ({ page }) => {
  const { rows } = await h.templateRows(page);
  const file = h.writeCsv('mra', [rows[0], { ...rows[0], account_number: 'MU0099887766', last_name: "D'Unienville" }]);
  await h.fillInstitution(page, { year: 2026 });
  await h.upload(page, file);
  const out = await h.generate(page);
  expect(h.count(out.xml, 'AccountReport')).toBe(1);
  await expect(page.getByText(/MRA does not accept/).first()).toBeVisible();
  h.expectSchemaValid(out.path);
});

test('a 2026 row without an account type is refused rather than sentinelled', async ({ page }) => {
  const { rows } = await h.templateRows(page);
  const file = h.writeCsv('no-account-type', [{ ...rows[0], account_type: '' }]);
  await h.fillInstitution(page, { year: 2026 });
  await h.upload(page, file);
  expect(await h.generate(page)).toBeNull();
  await expect(page.getByText(/account_type is required/).first()).toBeVisible();
});

test('a file that is not a spreadsheet is refused with a message', async ({ page }) => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const file = path.join(os.tmpdir(), 'notes.txt');
  fs.writeFileSync(file, 'hello');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText(/Failed to process file/)).toBeVisible();
});

test('choosing a schema version other than the recommended one warns', async ({ page }) => {
  await h.fillInstitution(page, { year: 2025 });
  await page.locator('label:has-text("Schema version") select').selectOption('3.0');
  await expect(page.locator('label:has-text("Schema version") .text-critical')).toBeVisible();
});

test('corrections, voids and nil returns need sign-in; a new return does not', async ({ page }) => {
  for (const mode of ['Nil return', 'Correction', 'Void records']) {
    await expect(page.locator('button', { hasText: mode }).first()).toBeDisabled();
  }
  await expect(page.locator('button', { hasText: 'New return' }).first()).toBeEnabled();
});

test('markup in uploaded data is shown as text, never executed', async ({ page }) => {
  const { rows } = await h.templateRows(page);
  const file = h.writeCsv('xss', [{ ...rows[0], city: '<img src=x onerror="window.__xss=1">', account_number: 'MU<script>window.__xss=2</script>' }]);
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await h.upload(page, file);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(dialog).toBe(false);
});
