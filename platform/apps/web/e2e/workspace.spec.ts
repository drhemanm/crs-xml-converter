import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const CSV = fileURLToPath(new URL("../../../examples/accounts.csv", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("switching regimes preserves each unfinished draft", async ({ page }) => {
  const crs = page.locator('[data-regime-panel="CRS"]');
  const fatca = page.locator('[data-regime-panel="FATCA"]');
  await crs.getByLabel("Institution name").fill("CRS draft institution");
  await page.getByRole("button", { name: "FATCA", exact: true }).click();
  await fatca.getByLabel("Institution name").fill("FATCA draft institution");
  await page.getByRole("button", { name: "CRS", exact: true }).click();
  await expect(crs.getByLabel("Institution name")).toHaveValue("CRS draft institution");
  await expect(fatca).toBeHidden();
  await page.getByRole("button", { name: "FATCA", exact: true }).click();
  await expect(fatca.getByLabel("Institution name")).toHaveValue("FATCA draft institution");
  await expect(crs).toBeHidden();
});

test("changing CRS settings removes the validated output and download action", async ({ page }) => {
  await page.getByLabel("Institution name").fill("Example institution");
  await page.getByLabel("Institution TAN").fill("MU10203040");
  await page.getByLabel("Institution city").fill("Port Louis");
  await page.getByRole("button", { name: "Nil return", exact: true }).click();
  await page.getByRole("button", { name: "Generate return", exact: true }).click();
  await expect(page.locator("pre.xml")).toBeVisible();
  await page.getByLabel("Reporting period end").fill("2026-12-31");
  await expect(page.locator("pre.xml")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download XML", exact: true })).toHaveCount(0);
});

test("changing FATCA inputs invalidates XML rather than relabelling old output", async ({ page }) => {
  await page.getByRole("button", { name: "FATCA", exact: true }).click();
  const panel = page.locator('[data-regime-panel="FATCA"]');
  await panel.getByLabel("GIIN", { exact: true }).fill("ABCDEF.00000.ME.480");
  await panel.getByLabel("Institution name").fill("Example Mauritius FI");
  await panel.getByLabel("Filer category").selectOption("FATCA602");
  await panel.getByRole("button", { name: "Nil", exact: true }).click();
  await panel.getByRole("button", { name: "Generate FATCA XML" }).click();
  await expect(panel.locator("pre.xml")).toBeVisible();
  await panel.getByLabel("Reporting period", { exact: true }).fill("2026-12-31");
  await expect(panel.locator("pre.xml")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Download test XML" })).toHaveCount(0);
});

test("an invalid spreadsheet row blocks the complete CRS return", async ({ page }) => {
  await page.getByLabel("Institution name").fill("Example institution");
  await page.getByLabel("Institution TAN").fill("MU10203040");
  await page.getByLabel("Institution city").fill("Port Louis");
  await page.setInputFiles('[data-regime-panel="CRS"] input[type="file"][accept*="csv"]', {
    name: "partial.csv", mimeType: "text/csv",
    buffer: Buffer.from("account_number,holder_type,first_name,last_name,residence_country,address_country,address_city,account_balance,currency_code\nACC1,individual,Jane,Doe,FR,FR,Paris,100.00,EUR\nACC2,individual,John,Doe,XX,FR,Paris,100.00,EUR"),
  });
  await expect(page.getByText(/record\(s\) mapped/)).toBeVisible();
  await page.getByRole("button", { name: "Generate return", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generate return", exact: true })).toBeEnabled();
  await expect(page.locator("pre.xml")).toHaveCount(0);
  await expect(page.locator(".diagnostic.error").first()).toBeVisible();
});

test("source file replacement clears a previously validated result", async ({ page }) => {
  await page.getByLabel("Institution name").fill("Example institution");
  await page.getByLabel("Institution TAN").fill("MU10203040");
  await page.getByLabel("Institution city").fill("Port Louis");
  const input = '[data-regime-panel="CRS"] input[type="file"][accept*="csv"]';
  await page.setInputFiles(input, CSV);
  await page.getByRole("button", { name: "Generate return", exact: true }).click();
  await expect(page.locator("pre.xml")).toBeVisible();
  await page.setInputFiles(input, { name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("unrecognised\nvalue") });
  await expect(page.locator("pre.xml")).toHaveCount(0);
});

test("the page CSP permits only the configured workspace endpoint for authentication", async ({ page }) => {
  let called = false;
  await page.route("https://prlarcyfngvwkavmktex.supabase.co/auth/v1/token**", async (route) => {
    called = true;
    await route.fulfill({ status: 400, headers: {
      "access-control-allow-origin": new URL(page.url()).origin,
      "access-control-allow-headers": "authorization,apikey,content-type,x-client-info",
      "access-control-allow-methods": "POST,OPTIONS",
    }, contentType: "application/json", body: JSON.stringify({ msg: "Mock sign-in refused" }) });
  });
  await page.getByLabel("Workspace email").fill("test@example.invalid");
  await page.getByLabel("Workspace password").fill("test-password-not-a-secret");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Mock sign-in refused");
  expect(called).toBe(true);
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("connect-src 'self' https://prlarcyfngvwkavmktex.supabase.co;");
});

test("both regimes fit a narrow viewport and expose selected controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const regime of ["CRS", "FATCA"]) {
    await page.getByRole("button", { name: regime, exact: true }).click();
    await expect(page.getByRole("button", { name: regime, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
