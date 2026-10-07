import { describe, expect, test, vi } from "vitest";
import {
  createPaymentHandler,
  moneyToMinor,
} from "../../../supabase/functions/_shared/payment-service.js";

const ID = "00000000-0000-4000-8000-000000000010";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "server-test",
  BILLING_SITE_URL: "https://filing.example",
  BILLING_ENABLED: "true",
  PAYPAL_CLIENT_ID: "client-test",
  PAYPAL_CLIENT_SECRET: "secret-test",
  PAYPAL_MERCHANT_ID: "MERCHANT123",
  PAYPAL_WEBHOOK_ID: "WEBHOOK123",
};
const invoice = {
  id: ID,
  amount_minor: 9900,
  currency: "USD",
  status: "issued",
  plan_name: "Professional",
  provider_order_id: "ORDER123",
};
const order = {
  id: "ORDER123",
  status: "COMPLETED",
  purchase_units: [
    {
      custom_id: ID,
      payee: { merchant_id: "MERCHANT123" },
      payments: {
        captures: [
          {
            id: "CAPTURE123",
            status: "COMPLETED",
            amount: { value: "99.00", currency_code: "USD" },
          },
        ],
      },
    },
  ],
};
const req = (action = "capture", origin = "https://filing.example") =>
  new Request("https://example.supabase.co/functions/v1/billing-checkout", {
    method: "POST",
    headers: {
      authorization: "Bearer user-test",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ request_id: ID, action }),
  });

function harness(
  options: {
    order?: unknown;
    invoice?: unknown;
    signature?: string;
    authStatus?: number;
    refunded?: boolean;
  } = {},
) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const mock = vi.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/auth/v1/user"))
        return Response.json(
          { id: "USER123" },
          { status: options.authStatus || 200 },
        );
      if (url.endsWith("/aeoi_payable_request"))
        return Response.json(options.invoice || invoice);
      if (url.endsWith("/v1/oauth2/token"))
        return Response.json({ access_token: "provider-test" });
      if (url.includes("verify-webhook-signature"))
        return Response.json({
          verification_status: options.signature || "SUCCESS",
        });
      if (url.includes("/v2/payments/refunds/"))
        return Response.json({
          id: "REFUND123",
          links: [
            {
              rel: "up",
              href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE123",
            },
          ],
        });
      if (url.includes("/v2/payments/captures/"))
        return Response.json({
          id: "CAPTURE123",
          status: options.refunded ? "REFUNDED" : "COMPLETED",
          amount: { value: "99.00", currency_code: "USD" },
          links: [
            {
              rel: "up",
              href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123",
            },
          ],
        });
      if (url.includes("/v2/checkout/orders"))
        return Response.json(options.order || order);
      if (url.includes("/rest/v1/rpc/")) return Response.json(null);
      throw new Error("Unexpected network request: " + url);
    },
  );
  return {
    requests,
    mock,
    handler: createPaymentHandler(env, mock as typeof fetch),
  };
}
describe("payment verification boundaries", () => {
  test("uses decimal amounts without silent rounding", () => {
    expect(moneyToMinor("99.01")).toBe(9901);
    expect(moneyToMinor("0.10")).toBe(10);
    for (const value of ["0", "-1", "1e2", "1.001", "NaN", "1000001"])
      expect(() => moneyToMinor(value)).toThrow();
  });
  test("online payments remain disabled until configured", async () => {
    const fetcher = vi.fn();
    const handler = createPaymentHandler(
      { ...env, BILLING_ENABLED: "false" },
      fetcher,
    );
    expect((await handler(req())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  test("live payments require a separate explicit live switch", async () => {
    const fetcher = vi.fn();
    const handler = createPaymentHandler(
      { ...env, PAYPAL_ENVIRONMENT: "live" },
      fetcher,
    );
    expect((await handler(req())).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  test("rejects another origin and invalid auth before talking to the provider", async () => {
    const first = harness();
    expect(
      (await first.handler(req("capture", "https://attacker.invalid"))).status,
    ).toBe(403);
    expect(first.mock).not.toHaveBeenCalled();
    const second = harness({ authStatus: 401 });
    expect((await second.handler(req())).status).toBe(400);
    expect(second.requests.some((r) => r.url.includes("paypal.com"))).toBe(
      false,
    );
  });
  test("completed provider capture activates the exact stored request, with service credentials only on the server", async () => {
    const h = harness();
    const response = await h.handler(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "paid" });
    const write = h.requests.find((r) =>
      r.url.endsWith("aeoi_provider_payment"),
    )!;
    expect(JSON.parse(String(write.init.body))).toEqual({
      p_id: ID,
      p_order: "ORDER123",
      p_capture: "CAPTURE123",
      p_amount: 9900,
      p_currency: "USD",
    });
    expect((write.init.headers as Record<string, string>)["apikey"]).toBe(
      "server-test",
    );
    expect(
      h.requests.filter(
        (r) => r.url.includes("paypal.com") && r.url.endsWith("/capture"),
      ),
    ).toHaveLength(0);
  });
  test.each(["amount", "currency", "merchant", "custom_id", "pending"])(
    "refuses mismatched %s before granting a licence",
    async (field) => {
      const bad = structuredClone(order);
      const unit = bad.purchase_units[0]!;
      const capture = unit.payments.captures[0]!;
      if (field === "amount") capture.amount.value = "0.99";
      if (field === "currency") capture.amount.currency_code = "EUR";
      if (field === "merchant") unit.payee.merchant_id = "ATTACKER";
      if (field === "custom_id") unit.custom_id = "WRONG";
      if (field === "pending") capture.status = "PENDING";
      const h = harness({ order: bad });
      expect((await h.handler(req())).status).toBe(400);
      expect(
        h.requests.some((r) => r.url.endsWith("aeoi_provider_payment")),
      ).toBe(false);
    },
  );
  test("checkout takes price and company from the database, and binds its idempotent order", async () => {
    const h = harness({
      invoice: { ...invoice, provider_order_id: null },
      order: {
        id: "ORDER123",
        status: "PAYER_ACTION_REQUIRED",
        links: [
          {
            rel: "payer-action",
            href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123",
          },
        ],
      },
    });
    const response = await h.handler(req("checkout"));
    expect(response.status).toBe(200);
    const create = h.requests.find((r) =>
      r.url.endsWith("/v2/checkout/orders"),
    )!;
    const payload = JSON.parse(String(create.init.body));
    expect(payload.purchase_units[0].amount).toEqual({
      currency_code: "USD",
      value: "99.00",
    });
    expect(
      (create.init.headers as Record<string, string>)["PayPal-Request-Id"],
    ).toBe(ID);
    expect(
      h.requests.some((r) => r.url.endsWith("aeoi_bind_payment_order")),
    ).toBe(true);
  });
  test("rejects arbitrary provider approval URLs", async () => {
    const h = harness({
      order: {
        ...order,
        links: [{ rel: "approve", href: "https://attacker.invalid/steal" }],
      },
    });
    expect((await h.handler(req("checkout"))).status).toBe(400);
  });
  test("forged webhook signatures never change billing", async () => {
    const h = harness({ signature: "FAILURE" });
    const request = new Request(
      "https://example.supabase.co/functions/v1/billing-webhook",
      {
        method: "POST",
        body: JSON.stringify({
          id: "EVENT123",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
        }),
      },
    );
    expect((await h.handler(request)).status).toBe(401);
    expect(
      h.requests.some((r) => r.url.endsWith("aeoi_provider_webhook")),
    ).toBe(false);
  });
  test("signed completed webhook verifies the provider order and capture before settlement", async () => {
    const h = harness();
    const request = new Request(
      "https://example.supabase.co/functions/v1/billing-webhook",
      {
        method: "POST",
        body: JSON.stringify({
          id: "EVENT123",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            id: "CAPTURE123",
            supplementary_data: { related_ids: { order_id: "ORDER123" } },
          },
        }),
      },
    );
    expect((await h.handler(request)).status).toBe(200);
    expect(
      h.requests.some((r) =>
        r.url.endsWith("/v2/payments/captures/CAPTURE123"),
      ),
    ).toBe(true);
    expect(
      h.requests.some((r) => r.url.endsWith("aeoi_provider_webhook")),
    ).toBe(true);
  });
  test("refund webhooks resolve authoritative capture and order links without trusting arbitrary URLs", async () => {
    const h = harness({ refunded: true });
    const request = new Request(
      "https://example.supabase.co/functions/v1/billing-webhook",
      {
        method: "POST",
        body: JSON.stringify({
          id: "EVENT-REFUND",
          event_type: "PAYMENT.CAPTURE.REFUNDED",
          resource: { id: "REFUND123" },
        }),
      },
    );
    expect((await h.handler(request)).status).toBe(200);
    const write = h.requests.find((r) =>
      r.url.endsWith("aeoi_provider_webhook"),
    )!;
    expect(JSON.parse(String(write.init.body)).p_refunded).toBe(true);
    expect(
      h.requests.every(
        (r) =>
          r.url.startsWith("https://example.supabase.co") ||
          r.url.startsWith("https://api-m.sandbox.paypal.com"),
      ),
    ).toBe(true);
  });
});
