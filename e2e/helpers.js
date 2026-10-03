// Shared steps for the browser tests. Fixtures are built from the app's own
// downloadable template, so the tests track the template rather than a copy.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');
const { expect } = require('@playwright/test');

const XSD = path.join(__dirname, '..', 'schemas', 'oecd-crs-v3.0', 'CrsXML_v3.0.xsd');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crs-e2e-'));

async function fillInstitution(page, { year } = {}) {
  await page.getByPlaceholder('Your institution').fill('Banque Exemple Ltd');
  await page.getByPlaceholder('XXXXXX.XXXXX.XX.XXX').fill('ABC123.00000.MU.480');
  await page.getByPlaceholder('Port Louis').fill('Port Louis');
  await page.getByPlaceholder('Registered office address').fill('1 Royal Road');
  if (year) await page.locator('label:has-text("Reporting year") select').selectOption(String(year));
}

/** The template as the app serves it, parsed into rows. */
async function templateRows(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download the template/ }).click(),
  ]);
  const file = path.join(tmp, 'template.csv');
  await download.saveAs(file);
  const sheet = XLSX.read(fs.readFileSync(file, 'utf8'), { type: 'string', raw: true }).Sheets.Sheet1;
  return { file, rows: XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) };
}

function writeCsv(name, rows) {
  const file = path.join(tmp, `${name}.csv`);
  fs.writeFileSync(file, XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) })));
  return file;
}

/** An .xlsx file; `format` maps a column name to an Excel number format. */
function writeXlsx(name, rows, format = {}) {
  const headers = Object.keys(rows[0]);
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  for (const [column, fmt] of Object.entries(format)) {
    const col = XLSX.utils.encode_col(headers.indexOf(column));
    for (let r = 1; r <= rows.length; r++) {
      const cell = ws[`${col}${r + 1}`];
      if (cell && typeof cell.v === 'number') cell.z = fmt;
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
  const file = path.join(tmp, `${name}.xlsx`);
  XLSX.writeFile(wb, file);
  return file;
}

async function upload(page, file) {
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText(/Ready to generate|Fix these before generating/).first()).toBeVisible({ timeout: 60_000 });
}

/** Generate and download. Returns the XML, or null if no file was produced. */
async function generate(page) {
  await page.getByRole('button', { name: /^Generate/ }).click();
  const download = page.getByRole('button', { name: /Download XML/ });
  // Whichever comes first: the file, or the refusal that replaces it.
  const refused = page.getByText(/Conversion failed|Please fix/).first();
  await download.or(refused).first().waitFor({ timeout: 60_000 });
  if (!(await download.isVisible())) return null;
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const out = path.join(tmp, `filing-${Date.now()}.xml`);
  await file.saveAs(out);
  return { xml: fs.readFileSync(out, 'utf8'), path: out };
}

/** Validates against the official v3.0 XSD. Throws with xmllint's message. */
function expectSchemaValid(file) {
  try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, file], { stdio: 'pipe' });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('xmllint is not installed (apt-get install libxml2-utils).');
    throw new Error(String(e.stderr));
  }
}

const count = (xml, tag) => (xml.match(new RegExp(`<${tag}>`, 'g')) || []).length;

module.exports = { fillInstitution, templateRows, writeCsv, writeXlsx, upload, generate, expectSchemaValid, count };
