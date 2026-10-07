export type Environment = Record<string, string | undefined>;
type Json = Record<string, unknown>;

export function moneyToMinor(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 100000000)
    throw new Error("Amount is outside the supported range.");
  return minor;
}

interface PaymentRequest extends Json {
  id: string;
  amount_minor: number;
  currency: string;
  status: string;
  plan_name: string;
  provider_order_id: string | null;
}
interface PayPalOrder extends Json {
  id: string;
  status: string;
  links?: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{
    custom_id?: string;
    payee?: { merchant_id?: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { value: string; currency_code: string };
      }>;
    };
  }>;
}

export function createPaymentHandler(
  env: Environment,
  requestFetch: typeof fetch = fetch,
) {
  const supabaseUrl = env["SUPABASE_URL"];
  const publicKey = env["SUPABASE_PUBLISHABLE_KEY"] || env["SUPABASE_ANON_KEY"];
  const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  const site = env["BILLING_SITE_URL"];
  const sandbox = env["PAYPAL_ENVIRONMENT"] !== "live";
  const paypalBase = sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  async function call(url: string, init: RequestInit): Promise<Json> {
    const response = await requestFetch(url, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        `Billing service request failed (${response.status}). Retry or contact Evologics with the payment request ID.`,
      );
    const text = await response.text();
    return text ? (JSON.parse(text) as Json) : {};
  }
  async function rpc(name: string, body: Json, authorization?: string) {
    const key = authorization ? publicKey : serviceKey;
    if (!key || !supabaseUrl)
      throw new Error("Billing database connection is not configured.");
    return call(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: authorization || `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  async function token(): Promise<string> {
    if (
      !env["PAYPAL_CLIENT_ID"] ||
      !env["PAYPAL_CLIENT_SECRET"] ||
      !env["PAYPAL_MERCHANT_ID"]
    )
      throw new Error(
        "Online payments are not configured. Contact Evologics for an invoice.",
      );
    const data = await call(`${paypalBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env["PAYPAL_CLIENT_ID"]}:${env["PAYPAL_CLIENT_SECRET"]}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (typeof data["access_token"] !== "string")
      throw new Error("Payment provider authentication failed.");
    return data["access_token"];
  }
  async function paypal(
    path: string,
    access: string,
    body?: Json,
    requestId?: string,
  ) {
    return call(`${paypalBase}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
        Prefer: "return=representation",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  function verifyCapture(order: PayPalOrder, invoice: PaymentRequest) {
    const units = order.purchase_units;
    const captures = units?.[0]?.payments?.captures;
    if (
      order.id !== invoice.provider_order_id ||
      order.status !== "COMPLETED" ||
      units?.length !== 1 ||
      units[0]?.custom_id !== invoice.id ||
      units[0]?.payee?.merchant_id !== env["PAYPAL_MERCHANT_ID"] ||
      captures?.length !== 1
    ) {
      throw new Error(
        "The payment provider order does not match this company payment request.",
      );
    }
    const capture = captures[0]!;
    if (
      capture.status !== "COMPLETED" ||
      capture.amount.currency_code !== invoice.currency ||
      moneyToMinor(capture.amount.value) !== invoice.amount_minor
    ) {
      throw new Error(
        "Payment is pending or its amount does not match. The licence has not been activated.",
      );
    }
    return capture;
  }
  async function webhook(req: Request, event: Json): Promise<Response> {
    if (!env["PAYPAL_WEBHOOK_ID"])
      throw new Error("Webhook verification is not configured.");
    const access = await token();
    const signature = await paypal(
      "/v1/notifications/verify-webhook-signature",
      access,
      {
        auth_algo: req.headers.get("paypal-auth-algo"),
        cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        webhook_id: env["PAYPAL_WEBHOOK_ID"],
        webhook_event: event,
      },
    );
    if (signature["verification_status"] !== "SUCCESS")
      return Response.json(
        { error: "Invalid payment signature." },
        { status: 401 },
      );
    const type = String(event["event_type"] || "");
    if (
      ![
        "PAYMENT.CAPTURE.COMPLETED",
        "PAYMENT.CAPTURE.REFUNDED",
        "PAYMENT.CAPTURE.REVERSED",
      ].includes(type)
    )
      return Response.json({ ignored: true });
    const resource = event["resource"] as Json | undefined;
    const related = (resource?.["supplementary_data"] as Json | undefined)?.[
      "related_ids"
    ] as Json | undefined;
    const providerId = /^[A-Za-z0-9-]{5,64}$/;
    const parentId = (data: Json, collection: string) => {
      const links = data["links"] as
        | Array<{ rel: string; href: string }>
        | undefined;
      const link = links?.find((item) => item.rel === "up");
      if (!link) return "";
      const url = new URL(link.href);
      if (url.origin !== paypalBase) return "";
      const prefix = `/v2/${collection}/`;
      return url.pathname.startsWith(prefix)
        ? url.pathname.slice(prefix.length)
        : "";
    };
    let orderId = String(related?.["order_id"] || "");
    let captureId =
      type === "PAYMENT.CAPTURE.REFUNDED"
        ? String(related?.["capture_id"] || "")
        : String(resource?.["id"] || "");
    if (
      !captureId &&
      type === "PAYMENT.CAPTURE.REFUNDED" &&
      providerId.test(String(resource?.["id"] || ""))
    ) {
      const refund = await paypal(
        `/v2/payments/refunds/${String(resource!["id"])}`,
        access,
      );
      captureId = parentId(refund, "payments/captures");
    }
    if (!providerId.test(captureId) || !event["id"])
      throw new Error("Payment event is missing provider references.");
    const capture = await paypal(`/v2/payments/captures/${captureId}`, access);
    const captureRelated = (
      capture["supplementary_data"] as Json | undefined
    )?.["related_ids"] as Json | undefined;
    orderId =
      orderId ||
      String(captureRelated?.["order_id"] || "") ||
      parentId(capture, "checkout/orders");
    if (!providerId.test(orderId))
      throw new Error("Payment event is missing its order reference.");
    const order = (await paypal(
      `/v2/checkout/orders/${orderId}`,
      access,
    )) as PayPalOrder;
    const unit = order.purchase_units?.[0];
    if (
      order.purchase_units?.length !== 1 ||
      unit?.payee?.merchant_id !== env["PAYPAL_MERCHANT_ID"] ||
      !unit?.payments?.captures?.some((c) => c.id === captureId)
    )
      throw new Error("Payment event merchant or capture does not match.");
    const amount = capture["amount"] as
      | { value: string; currency_code: string }
      | undefined;
    const refunded = type !== "PAYMENT.CAPTURE.COMPLETED";
    if (
      !amount ||
      (refunded
        ? !["REFUNDED", "PARTIALLY_REFUNDED", "REVERSED", "DECLINED"].includes(
            String(capture["status"]),
          )
        : capture["status"] !== "COMPLETED")
    )
      throw new Error("Payment event is not confirmed by the provider.");
    // Refund/reversal events may arrive out of order. Only an actual provider
    // capture is authoritative; the browser redirect never grants a licence.
    await rpc("aeoi_provider_webhook", {
      p_event: event["id"],
      p_type: type,
      p_order: orderId,
      p_capture: captureId,
      p_amount: moneyToMinor(amount.value),
      p_currency: amount.currency_code,
      p_refunded: refunded,
    });
    return Response.json({ received: true });
  }
  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    const cors: Record<string, string> = {
      "Access-Control-Allow-Origin": site || "https://invalid.invalid",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
    };
    const respond = (body: Json, status = 200) =>
      Response.json(body, { status, headers: cors });
    if (req.method === "OPTIONS")
      return new Response(null, {
        status: origin === site ? 204 : 403,
        headers: cors,
      });
    if (req.method !== "POST")
      return respond({ error: "Method not allowed." }, 405);
    try {
      if (!sandbox && env["BILLING_ALLOW_LIVE"] !== "true")
        throw new Error("Live payments have not been enabled by Evologics.");
      const content = await req.text();
      if (content.length > 100000)
        return respond({ error: "Request too large." }, 413);
      const body = JSON.parse(content) as Json;
      if (new URL(req.url).pathname.endsWith("/billing-webhook"))
        return await webhook(req, body);
      if (env["BILLING_ENABLED"] !== "true")
        return respond(
          {
            error:
              "Online payments are not enabled. Contact Evologics for a payment request.",
          },
          503,
        );
      if (
        !site ||
        !/^https:\/\//.test(site) ||
        new URL(site).origin !== site ||
        (origin && origin !== site)
      )
        return respond({ error: "Billing origin is not permitted." }, 403);
      const authorization = req.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ") || !publicKey || !supabaseUrl)
        return respond({ error: "Sign in to manage company billing." }, 401);
      // Verify the actual Supabase user. Unverified JWT payloads and browser
      // role claims are never accepted as proof of ownership.
      await call(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: publicKey, Authorization: authorization },
      });
      const id = String(body["request_id"] || "");
      if (!/^[0-9a-f-]{36}$/i.test(id))
        return respond({ error: "Payment request ID is required." }, 400);
      const invoice = (await rpc(
        "aeoi_payable_request",
        { p_id: id },
        authorization,
      )) as PaymentRequest;
      const action = body["action"];
      if (invoice.status === "paid") return respond({ status: "paid" });
      if (action !== "checkout" && action !== "capture")
        return respond({ error: "Unknown billing action." }, 400);
      if (!["USD", "EUR", "GBP"].includes(invoice.currency))
        return respond(
          {
            error:
              "This currency requires a bank transfer. Contact Evologics for payment instructions.",
          },
          400,
        );
      const access = await token();
      if (action === "checkout") {
        let order: PayPalOrder;
        if (invoice.provider_order_id) {
          order = (await paypal(
            `/v2/checkout/orders/${invoice.provider_order_id}`,
            access,
          )) as PayPalOrder;
        } else {
          order = (await paypal(
            "/v2/checkout/orders",
            access,
            {
              intent: "CAPTURE",
              purchase_units: [
                {
                  custom_id: id,
                  description: `Evologics ${invoice.plan_name}: annual company licence`,
                  payee: { merchant_id: env["PAYPAL_MERCHANT_ID"] },
                  amount: {
                    currency_code: invoice.currency,
                    value: (invoice.amount_minor / 100).toFixed(2),
                  },
                },
              ],
              payment_source: {
                paypal: {
                  experience_context: {
                    brand_name: "Evologics",
                    shipping_preference: "NO_SHIPPING",
                    user_action: "PAY_NOW",
                    return_url: `${site}/?billing_request=${id}&billing_return=approved`,
                    cancel_url: `${site}/?billing_request=${id}&billing_return=cancelled`,
                  },
                },
              },
            },
            id,
          )) as PayPalOrder;
          if (!order.id)
            throw new Error("The provider did not return an order ID.");
          await rpc("aeoi_bind_payment_order", { p_id: id, p_order: order.id });
        }
        const approval = order.links?.find(
          (link) => link.rel === "payer-action" || link.rel === "approve",
        )?.href;
        if (!approval) {
          if (order.status === "APPROVED" || order.status === "COMPLETED")
            return respond({ status: "approved" });
          throw new Error(
            "Checkout cannot be resumed. Contact Evologics with the payment request ID.",
          );
        }
        const url = new URL(approval);
        if (
          url.protocol !== "https:" ||
          url.hostname !==
            (sandbox ? "www.sandbox.paypal.com" : "www.paypal.com")
        )
          throw new Error("Unexpected checkout destination.");
        return respond({
          approval_url: approval,
          environment: sandbox ? "sandbox" : "live",
        });
      }
      if (!invoice.provider_order_id)
        throw new Error("Start checkout before confirming payment.");
      let order = (await paypal(
        `/v2/checkout/orders/${invoice.provider_order_id}`,
        access,
      )) as PayPalOrder;
      if (order.status !== "COMPLETED")
        order = (await paypal(
          `/v2/checkout/orders/${invoice.provider_order_id}/capture`,
          access,
          {},
          `capture-${id}`,
        )) as PayPalOrder;
      const capture = verifyCapture(order, invoice);
      await rpc("aeoi_provider_payment", {
        p_id: id,
        p_order: invoice.provider_order_id,
        p_capture: capture.id,
        p_amount: invoice.amount_minor,
        p_currency: invoice.currency,
      });
      return respond({ status: "paid" });
    } catch {
      // No provider response bodies, payer details or credentials are logged.
      return respond(
        {
          error:
            "Payment could not be confirmed. Your licence has not been changed. Retry or contact Evologics with the payment request ID.",
        },
        400,
      );
    }
  };
}
