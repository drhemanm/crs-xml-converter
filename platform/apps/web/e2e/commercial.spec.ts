import { expect, test, type Page } from "@playwright/test";

const ORG = "00000000-0000-4000-8000-000000000010",
  FI = "00000000-0000-4000-8000-000000000020",
  REQUEST = "00000000-0000-4000-8000-000000000030";
const organization = {
  id: ORG,
  name: "Example Management Company",
  created_by: "USER123",
  created_at: "2026-10-01T00:00:00Z",
};
const payment = {
  id: REQUEST,
  plan_name: "Professional",
  amount_minor: 9900,
  filing_limit: 50,
  institution_limit: 5,
  currency: "USD",
  status: "issued",
  created_at: "2026-10-07T00:00:00Z",
  paid_at: null,
  payment_method: null,
  period_start: null,
  period_end: null,
};
const billing = {
  organization_id: ORG,
  plan_id: "evaluation",
  plan_name: "Evaluation",
  status: "evaluation",
  period_start: "2026-10-01T00:00:00Z",
  period_end: "2026-10-31T00:00:00Z",
  filings_used: 2,
  filing_limit: 3,
  institution_count: 1,
  institution_limit: 1,
  can_manage: true,
  institutions: [
    { id: FI, name: "Example FI", crs_filings: 4, fatca_filings: 2 },
  ],
  payment_requests: [payment],
};

async function connected(page: Page, operator = false) {
  let current = structuredClone(billing);
  let captures = 0;
  await page.addInitScript(() =>
    localStorage.setItem(
      "aeoi.supabase.session.v1",
      JSON.stringify({
        access_token: "mock-user-token",
        refresh_token: "mock-refresh-token",
        expires_at: 4102444800,
        user: { id: "USER123", email: "operator@example.invalid" },
      }),
    ),
  );
  await page.route(
    "https://prlarcyfngvwkavmktex.supabase.co/**",
    async (route) => {
      const url = new URL(route.request().url());
      let response: unknown = [];
      if (url.pathname.endsWith("/organizations")) response = [organization];
      else if (url.pathname.endsWith("/reporting_institutions"))
        response = [
          {
            id: FI,
            organization_id: ORG,
            legal_name: "Example FI",
            jurisdiction: "MU",
            identifier_type: "TAN",
            identifier_value: "MU10203040",
            city: "Port Louis",
            active: true,
          },
        ];
      else if (url.pathname.endsWith("aeoi_get_pseudonym_key"))
        response = "test-company-key";
      else if (url.pathname.endsWith("aeoi_commercial_access"))
        response = operator;
      else if (url.pathname.endsWith("aeoi_company_billing"))
        response = current;
      else if (url.pathname.endsWith("aeoi_admin_dashboard"))
        response = {
          companies: [
            {
              ...organization,
              billing: current,
              filings_total: 6,
              filings_30_days: 3,
              last_filing_at: "2026-10-07T00:00:00Z",
            },
          ],
          plans: [
            {
              id: "professional",
              name: "Professional",
              filing_limit: 50,
              institution_limit: 5,
              price_minor: 9900,
              currency: "USD",
              available: true,
            },
          ],
          paid_totals: [],
          audit: [],
        };
      else if (url.pathname.endsWith("aeoi_record_bank_payment")) {
        const body = route.request().postDataJSON();
        expect(body.p_amount).toBe(9900);
        expect(body.p_reference).toBe("BANK-STATEMENT-001");
        current = {
          ...current,
          status: "active",
          plan_name: "Professional",
          filing_limit: 50,
          institution_limit: 5,
          payment_requests: [
            {
              ...payment,
              status: "paid",
              payment_method: "bank_transfer" as never,
            },
          ],
        };
        response = null;
      } else if (url.pathname.endsWith("billing-checkout")) {
        const body = route.request().postDataJSON();
        expect(Object.keys(body).sort()).toEqual(["action", "request_id"]);
        expect(body.request_id).toBe(REQUEST);
        if (body.action === "capture") {
          captures++;
          current = {
            ...current,
            status: "active",
            plan_name: "Professional",
            payment_requests: [{ ...payment, status: "paid" }],
          };
          response = { status: "paid" };
        } else response = { status: "approved" };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:4173",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info",
          "access-control-allow-methods": "POST,OPTIONS",
        },
        body: JSON.stringify(response),
      });
    },
  );
  return { captures: () => captures };
}

test("company members see usage and billing without Evologics operator controls", async ({
  page,
}) => {
  await connected(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Company and billing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Company and billing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Company filing allowance used" }),
  ).toHaveAttribute("value", "2");
  await expect(page.getByRole("row", { name: "Example FI 4 2" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Evologics administration" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pay annual licence" }),
  ).toBeVisible();
});
test("checkout return never activates access without verified capture", async ({
  page,
}) => {
  const state = await connected(page);
  await page.goto(`/?billing_request=${REQUEST}&billing_return=approved`);
  await expect(
    page.getByRole("heading", { name: "Confirm your payment" }),
  ).toBeVisible();
  expect(state.captures()).toBe(0);
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Professional", exact: true }),
  ).toBeVisible();
  expect(state.captures()).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Confirm your payment" }),
  ).toHaveCount(0);
});
test("Evologics operators inspect company activity and record a bank payment", async ({
  page,
}) => {
  await connected(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Evologics administration" }).click();
  await expect(
    page.getByRole("heading", { name: "Company portfolio" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Example Management Company" })
    .click();
  await expect(page.getByRole("row", { name: "Example FI 4 2" })).toBeVisible();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByLabel("Bank statement / transfer reference")
    .fill("BANK-STATEMENT-001");
  await page.getByRole("button", { name: "Confirm and record" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "recorded in the operator audit" }),
  ).toContainText("recorded in the operator audit");
  await expect(page.getByRole("cell", { name: /bank transfer/ })).toBeVisible();
});
test("commercial pages fit phone width and switching back preserves the filing draft", async ({
  page,
}) => {
  await connected(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.locator('[data-regime-panel="CRS"]').getByLabel("Institution name"),
  ).toHaveValue("Example FI");
  await page
    .locator('[data-regime-panel="CRS"]')
    .getByLabel("Institution city")
    .fill("My draft city");
  for (const view of ["Company and billing", "Evologics administration"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: view === "Company and billing" ? view : "Company portfolio",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "CRS", exact: true }).click();
  await expect(page.getByLabel("Institution city")).toHaveValue(
    "My draft city",
  );
});

test("cancelled checkout offers a safe resume without requesting capture", async ({
  page,
}) => {
  const state = await connected(page);
  await page.goto(`/?billing_request=${REQUEST}&billing_return=cancelled`);
  await expect(
    page.getByRole("heading", { name: "Checkout cancelled" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume checkout" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm payment", exact: true }),
  ).toHaveCount(0);
  expect(state.captures()).toBe(0);
});
