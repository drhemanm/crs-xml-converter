import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
const CSV = fileURLToPath(new URL("../../../examples/accounts.csv", import.meta.url));

async function prepare(page: Page) {
  await page.getByLabel("Institution name").fill("Synthetic institution");
  await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill("MU10203040");
  await page.getByLabel("Institution city").fill("Port Louis");
}
async function stored(page: Page) {
  return page.evaluate(async () => new Promise<{ count: number; revision: number; refs: string[]; secret: string }>((resolve, reject) => {
    const open = indexedDB.open("crs-filing-history", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction("ledger", "readonly"), get = tx.objectStore("ledger").get("current");
      get.onsuccess = () => resolve({ count: get.result?.entries.length ?? 0, revision: get.result?.revision ?? -1,
        refs: get.result?.entries.map((e: { docRefId: string }) => e.docRefId) ?? [], secret: get.result?.hmacSecret ?? "" });
      tx.oncomplete = () => db.close();
    };
  }));
}

test("failed history commit leaves the old ledger intact and the same filing can be retried", async ({ page }) => {
  await page.goto("/"); await prepare(page); await page.setInputFiles('input[type="file"][accept*="csv"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click(); await expect(page.locator("pre.xml")).toBeVisible();
  const xml = await page.locator("pre.xml").innerText();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      if (this.name === "ledger" && value.revision > 0) throw new DOMException("Synthetic storage failure", "QuotaExceededError");
      return original.call(this, value, key!);
    };
  });
  await page.getByRole("button", { name: "Record in local history" }).click();
  await expect(page.getByText(/Could not save filing history: Synthetic storage failure/)).toBeVisible();
  expect((await stored(page)).count).toBe(0);
  await expect(page.locator("pre.xml")).toHaveText(xml);
  await page.evaluate(() => (window as any).__restorePut());
  await page.getByRole("button", { name: "Record in local history" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  const committed = await stored(page); expect(committed.count).toBe(4);
  await page.reload(); await page.getByRole("button", { name: /Filing history/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  expect((await stored(page)).refs).toEqual(committed.refs);
});

test("legacy history and its HMAC key migrate and still support accepted-record corrections", async ({ page }) => {
  await page.goto("/"); await prepare(page); await page.setInputFiles('input[type="file"][accept*="csv"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click(); await expect(page.locator("pre.xml")).toBeVisible();
  const message = (await page.getByTestId("message-ref-id").innerText()).trim();
  await page.getByRole("button", { name: "Record in local history" }).click(); await expect(page.locator("tbody tr")).toHaveCount(4);
  const before = await stored(page);
  await page.evaluate(async () => {
    const state: any = await new Promise((resolve) => { const open = indexedDB.open("crs-filing-history", 1); open.onsuccess = () => {
      const db = open.result, tx = db.transaction("ledger", "readonly"), get = tx.objectStore("ledger").get("current");
      let value: any; get.onsuccess = () => { value = get.result; }; tx.oncomplete = () => { db.close(); resolve(value); };
    }; });
    localStorage.setItem("crs.ledger.v1", JSON.stringify({ version: 1, entries: state.entries }));
    localStorage.setItem("crs.ledger.hmac.v1", state.hmacSecret);
    await new Promise<void>((resolve, reject) => { const remove = indexedDB.deleteDatabase("crs-filing-history"); remove.onsuccess = () => resolve(); remove.onerror = () => reject(remove.error); });
  });
  await page.reload(); await page.getByRole("button", { name: /Filing history/ }).click(); await expect(page.locator("tbody tr")).toHaveCount(4);
  const migrated = await stored(page); expect(migrated.refs).toEqual(before.refs); expect(migrated.secret).toBe(before.secret);
  expect(await page.evaluate(() => localStorage.getItem("crs.ledger.v1"))).toBeNull();
  await page.setInputFiles('input[type="file"][accept*="xml"]', { name: "status.xml", mimeType: "application/xml", buffer: Buffer.from(`<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0"><MessageSpec><MessageRefId>TestStatus</MessageRefId></MessageSpec><CrsStatusMessage><OriginalMessage><OriginalMessageRefID>${message}</OriginalMessageRefID></OriginalMessage><ValidationErrors/><ValidationResult><Status>Accepted</Status><ValidatedBy>test</ValidatedBy></ValidationResult></CrsStatusMessage></CRSStatusMessage_OECD>`) });
  await expect(page.locator(".state.live")).toHaveCount(4);
  await page.reload(); await prepare(page); await page.getByRole("button", { name: "Correction", exact: true }).click(); await page.setInputFiles('input[type="file"][accept*="csv"]', CSV);
  await page.getByRole("button", { name: "Generate return" }).click(); await expect(page.locator("pre.xml")).toContainText("<MessageTypeIndic>CRS702</MessageTypeIndic>");
  const corrected = await page.locator("pre.xml").innerText();
  for (const ref of before.refs.slice(1)) expect(corrected).toContain(`<stf:CorrDocRefId>${ref}</stf:CorrDocRefId>`);
});

test("a stale tab cannot overwrite newer history", async ({ page, context }) => {
  await page.goto("/"); await prepare(page); await page.getByRole("button", { name: "Nil return", exact: true }).click();
  const other = await context.newPage(); await other.goto("/"); await prepare(other); await other.getByRole("button", { name: "Nil return", exact: true }).click();
  await page.getByRole("button", { name: "Generate return" }).click(); await expect(page.locator("pre.xml")).toBeVisible();
  await page.getByRole("button", { name: "Record in local history" }).click(); await expect(page.locator("tbody tr")).toHaveCount(1);
  const saved = await stored(page);
  await other.getByRole("button", { name: "Generate return" }).click(); await expect(other.locator("pre.xml")).toBeVisible();
  await other.getByRole("button", { name: "Record in local history" }).click(); await expect(other.getByText(/Filing history changed in another tab/)).toBeVisible();
  expect(await stored(page)).toEqual(saved);
});

test("failed legacy migration preserves the original copy for a later retry", async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem("crs.ledger.v1", JSON.stringify({ version: 1, entries: [] }));
    localStorage.setItem("crs.ledger.hmac.v1", "S".repeat(32));
    IDBObjectStore.prototype.put = function () { throw new DOMException("Synthetic migration failure", "QuotaExceededError"); };
  });
  await page.goto("/"); await expect(page.getByText("Synthetic migration failure", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate return" })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("crs.ledger.v1"))).not.toBeNull();
  const retry = await context.newPage(); await retry.goto("/"); await prepare(retry);
  expect((await stored(retry)).secret).toBe("S".repeat(32));
  expect(await retry.evaluate(() => localStorage.getItem("crs.ledger.v1"))).toBeNull();
});

test("corrupt legacy history blocks filing instead of silently starting a new ledger", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("crs.ledger.v1", "{corrupt"));
  await page.goto("/"); await expect(page.getByText(/existing local filing history could not be read/)).toBeVisible();
  await page.getByLabel("Institution name").fill("Synthetic institution"); await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill("MU10203040");
  await page.getByRole("button", { name: "Nil return", exact: true }).click(); await expect(page.getByRole("button", { name: "Generate return" })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("crs.ledger.v1"))).toBe("{corrupt");
});
