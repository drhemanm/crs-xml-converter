import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const CSV = fileURLToPath(new URL("../../../examples/accounts.csv", import.meta.url));

const FI = {
  name: "Banque des Mascareignes Ltd",
  id: "MU10203040",
  city: "Port Louis",
};

async function fillInstitution(page: Page, jurisdiction = "MU"): Promise<void> {
  await page.getByLabel("Filing jurisdiction").selectOption(jurisdiction);
  await page.getByLabel("Institution name").fill(FI.name);
  await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill(FI.id);
  await page.getByLabel("Institution city").fill(FI.city);
}

async function generate(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Generate return" }).click();
  // The libxml2 WASM chunk is fetched on first generate.
  await expect(page.locator("pre.xml, .diagnostic.error")).toBeVisible({ timeout: 20_000 });
}

/** Start every test from an empty filing history. */
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("files a new return and records it to filing history", async ({ page }) => {
  await fillInstitution(page);
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText("3 record(s) mapped")).toBeVisible();

  // Mauritius takes v2.0 for a 2025 period filed in 2026.
  await expect(page.getByText("crs-v2.0", { exact: true })).toBeVisible();

  await generate(page);
  await expect(page.locator("pre.xml")).toContainText("<MessageTypeIndic>CRS701</MessageTypeIndic>");
  await expect(page.locator("pre.xml")).toContainText('version="2.0"');
  // The legacy generator put an XSD authoring attribute on the instance root.
  await expect(page.locator("pre.xml")).not.toContainText("targetNamespace");

  await page.getByRole("button", { name: "Record as submitted" }).click();
  await expect(page.getByRole("tab", { name: /Filing history \(4\)/ })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4); // 1 ReportingFI + 3 accounts
  await expect(page.locator(".state.pending").first()).toBeVisible();
});

test("filing history survives a page reload", async ({ page }) => {
  await fillInstitution(page);
  await page.setInputFiles('input[type="file"]', CSV);
  await generate(page);
  await page.getByRole("button", { name: "Record as submitted" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);

  await page.reload();
  await page.getByRole("tab", { name: /Filing history/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("applies an authority status message and marks records live or rejected", async ({ page }) => {
  await fillInstitution(page);
  await page.setInputFiles('input[type="file"]', CSV);
  await generate(page);

  const messageRefId = (await page.getByTestId("message-ref-id").innerText()).trim();
  await page.getByRole("button", { name: "Record as submitted" }).click();

  const rejected = (await page.locator("tbody tr:last-child td:last-child").innerText()).trim();
  const status = `<?xml version="1.0" encoding="UTF-8"?>
<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0">
  <MessageSpec><MessageRefId>StatusMU</MessageRefId></MessageSpec>
  <CrsStatusMessage>
    <OriginalMessage><OriginalMessageRefID>${messageRefId}</OriginalMessageRefID></OriginalMessage>
    <ValidationErrors>
      <RecordError><Code>70000</Code><Details>Missing mandatory TIN</Details>
        <DocRefIDInError>${rejected}</DocRefIDInError></RecordError>
    </ValidationErrors>
    <ValidationResult><Status>Accepted</Status><ValidatedBy>MRA</ValidatedBy></ValidationResult>
  </CrsStatusMessage>
</CRSStatusMessage_OECD>`;

  await page.setInputFiles('input[type="file"][accept*="xml"]', {
    name: "status.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(status),
  });

  await expect(page.locator(".state.live")).toHaveCount(3);
  await expect(page.locator(".state.rejected")).toHaveCount(1);
  // The authority's own error text is surfaced, with the recovery path.
  await expect(page.getByText(/Missing mandatory TIN/)).toBeVisible();
  await expect(page.getByText(/Resubmit it as new data \(OECD1\)/)).toBeVisible();
});

test("derives CorrDocRefId from filing history when correcting", async ({ page }) => {
  await fillInstitution(page);
  await page.setInputFiles('input[type="file"]', CSV);
  await generate(page);
  const messageRefId = (await page.getByTestId("message-ref-id").innerText()).trim();
  await page.getByRole("button", { name: "Record as submitted" }).click();

  const docRefIds = await page.locator("tbody tr td:last-child").allInnerTexts();
  const accountDocRef = docRefIds[1]!.trim();

  // Accept everything so the records become correctable.
  await page.setInputFiles('input[type="file"][accept*="xml"]', {
    name: "status.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(`<?xml version="1.0"?>
<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0">
  <MessageSpec><MessageRefId>StatusMU</MessageRefId></MessageSpec>
  <CrsStatusMessage>
    <OriginalMessage><OriginalMessageRefID>${messageRefId}</OriginalMessageRefID></OriginalMessage>
    <ValidationErrors/>
    <ValidationResult><Status>Accepted</Status><ValidatedBy>MRA</ValidatedBy></ValidationResult>
  </CrsStatusMessage>
</CRSStatusMessage_OECD>`),
  });
  await expect(page.locator(".state.live")).toHaveCount(4);

  await page.getByRole("tab", { name: "Prepare filing" }).click();
  await page.getByRole("button", { name: "Correction" }).click();
  await page.setInputFiles('input[type="file"][accept*="csv"]', CSV);
  await generate(page);

  const xml = page.locator("pre.xml");
  await expect(xml).toContainText("<MessageTypeIndic>CRS702</MessageTypeIndic>");
  // Parent resent as OECD0 carrying the DocRefId the authority accepted.
  await expect(xml).toContainText("<stf:DocTypeIndic>OECD0</stf:DocTypeIndic>");
  await expect(xml).toContainText("<stf:DocTypeIndic>OECD2</stf:DocTypeIndic>");
  await expect(xml).toContainText(`<stf:CorrDocRefId>${accountDocRef}</stf:CorrDocRefId>`);
  // CorrMessageRefId is forbidden in CRS entirely.
  await expect(xml).not.toContainText("CorrMessageRefId");
});

test("refuses to correct accounts that were never accepted", async ({ page }) => {
  await fillInstitution(page);
  await page.getByRole("button", { name: "Correction" }).click();
  await page.setInputFiles('input[type="file"][accept*="csv"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click();

  await expect(page.getByText(/No accepted records found to correct/)).toBeVisible();
  await expect(page.getByText(/File them as new data instead/)).toBeVisible();
  await expect(page.locator("pre.xml")).toHaveCount(0);
});

test("produces a nil return without any account data", async ({ page }) => {
  await fillInstitution(page);
  await page.getByRole("button", { name: "Nil return" }).click();
  // No upload step is offered for a nil return.
  await expect(page.locator('input[type="file"][accept*="csv"]')).toHaveCount(0);

  await generate(page);
  await expect(page.locator("pre.xml")).toContainText("<MessageTypeIndic>CRS703</MessageTypeIndic>");
  await expect(page.locator("pre.xml")).not.toContainText("<AccountReport>");
});

test("fails loudly for a jurisdiction whose schema is not implemented", async ({ page }) => {
  // Before 2027 HMRC requires its own combined FATCA/CDOT/CRS schema.
  await fillInstitution(page, "GB");
  await expect(page.getByText("uk-combined (not implemented)")).toBeVisible();

  await page.setInputFiles('input[type="file"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click();

  await expect(page.getByText(/requires the "uk-combined" schema/)).toBeVisible();
  await expect(page.getByText(/Emitting a guessed shape/)).toBeVisible();
  await expect(page.locator("pre.xml")).toHaveCount(0);
});

test("switches to the amended schema once the filing date crosses the 2027 cutover", async ({ page }) => {
  await fillInstitution(page);
  await expect(page.getByText("crs-v2.0", { exact: true })).toBeVisible();

  // Same reporting period, filed after the cutover — several authorities then
  // require the amended schema even for earlier years.
  await page.getByLabel("Filing date").fill("2027-03-01");
  await expect(page.getByText("crs-v3.0", { exact: true })).toBeVisible();
});

test("reports missing mandatory data instead of inventing it", async ({ page }) => {
  await fillInstitution(page);
  // Clear the city: City is mandatory in the OECD address type.
  await page.getByLabel("Institution city").fill("");
  await page.setInputFiles('input[type="file"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click();

  await expect(page.getByText(/City is required within an address/)).toBeVisible();
  await expect(page.locator("pre.xml")).toHaveCount(0);
});

test("never contacts any host other than its own origin", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173") && !r.url().startsWith("data:")) {
      foreign.push(r.url());
    }
  });

  await fillInstitution(page);
  await page.setInputFiles('input[type="file"]', CSV);
  await generate(page);
  await page.getByRole("button", { name: "Record as submitted" }).click();

  expect(foreign).toEqual([]);
});

test("offers a CSV template that the tool itself accepts", async ({ page }) => {
  await fillInstitution(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download CSV template" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  // Feed the template straight back in: it must map with no errors.
  await page.setInputFiles('input[type="file"][accept*="csv"]', path!);
  await expect(page.getByText("2 record(s) mapped")).toBeVisible();
  await expect(page.locator(".diagnostic.error")).toHaveCount(0);

  await generate(page);
  await expect(page.locator("pre.xml")).toContainText("<MessageTypeIndic>CRS701</MessageTypeIndic>");
});
