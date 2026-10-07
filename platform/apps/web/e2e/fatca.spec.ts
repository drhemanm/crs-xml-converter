import { test, expect } from "@playwright/test";

const FATCA_CSV = [
  "account_number,account_number_type,holder_kind,first_name,last_name,holder_name,holder_tin,holder_residence_country,account_holder_type,account_balance,currency,payment_type,payment_amount,payment_currency,doc_ref_id,corr_message_ref_id,corr_doc_ref_id",
  "ACC-001,OECD605,individual,Jane,Doe,,123456789,US,,1000.00,USD,FATCA502,25.00,USD,TEST-GIIN-DOC-001,,",
].join("\n");

async function openFatca(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "FATCA", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FATCA reporting" })).toBeVisible();
  await page.getByLabel("GIIN").fill("ABCDEF.00000.ME.480");
  await page.getByLabel("Institution name").fill("Example Mauritius FI");
}

test("generates a Mauritius FATCA v2.0.1 account report locally", async ({ page }) => {
  await openFatca(page);
  await page.setInputFiles('input[type="file"][accept*="csv"]', {
    name: "fatca.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(FATCA_CSV),
  });
  await expect(page.getByText(/1 row\(s\) loaded/)).toBeVisible();

  await page.getByRole("button", { name: "Generate FATCA XML" }).click();

  const xml = page.locator("pre.xml");
  await expect(xml).toBeVisible();
  await expect(xml).toContainText("<ftc:FATCA_OECD");
  await expect(xml).toContainText('version="2.0.1"');
  await expect(xml).toContainText("<sfa:TransmittingCountry>MU</sfa:TransmittingCountry>");
  await expect(xml).toContainText("<sfa:ReceivingCountry>US</sfa:ReceivingCountry>");
  await expect(xml).toContainText("<ftc:FilerCategory>FATCA602</ftc:FilerCategory>");
  await expect(xml).toContainText("<ftc:DocTypeIndic>FATCA1</ftc:DocTypeIndic>");
  await expect(xml).toContainText("<ftc:AccountNumber AcctNumberType=\"OECD605\">ACC-001</ftc:AccountNumber>");
});

test("generates a Mauritius FATCA nil report without account data", async ({ page }) => {
  await openFatca(page);
  await page.getByRole("button", { name: "Nil", exact: true }).click();
  await page.getByRole("button", { name: "Generate FATCA XML" }).click();

  const xml = page.locator("pre.xml");
  await expect(xml).toContainText("<ftc:NilReport>");
  await expect(xml).toContainText("<ftc:NoAccountToReport>yes</ftc:NoAccountToReport>");
  await expect(xml).not.toContainText("<ftc:AccountReport>");
});

test("refuses MRA-discouraged character sequences before generating FATCA XML", async ({ page }) => {
  await openFatca(page);
  await page.getByLabel("Institution name").fill("Example & Mauritius FI");
  await page.getByRole("button", { name: "Nil", exact: true }).click();
  await page.getByRole("button", { name: "Generate FATCA XML" }).click();

  await expect(page.locator(".diagnostic.error")).toContainText(/MRA advises filers not to use/);
  await expect(page.locator("pre.xml")).toHaveCount(0);
});
