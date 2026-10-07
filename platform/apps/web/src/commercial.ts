import { authedFetch } from "./backend.js";

export interface PaymentRequest {
  id: string;
  plan_name: string;
  amount_minor: number;
  currency: string;
  status: "issued" | "paid" | "void" | "refunded";
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  period_start: string | null;
  period_end: string | null;
}
export interface CompanyBilling {
  organization_id: string;
  plan_id: string;
  plan_name: string;
  status: "evaluation" | "active" | "suspended" | "expired";
  period_start: string;
  period_end: string;
  filings_used: number;
  filing_limit: number;
  institution_count: number;
  institution_limit: number;
  can_manage: boolean;
  institutions: Array<{
    id: string;
    name: string;
    crs_filings: number;
    fatca_filings: number;
  }>;
  payment_requests: PaymentRequest[];
}
export interface CommercialPlan {
  id: string;
  name: string;
  filing_limit: number;
  institution_limit: number;
  price_minor: number | null;
  currency: string;
  available: boolean;
}
export interface AdminDashboard {
  companies: Array<{
    id: string;
    name: string;
    created_at: string;
    billing: CompanyBilling;
    filings_total: number;
    filings_30_days: number;
    last_filing_at: string | null;
  }>;
  plans: CommercialPlan[];
  paid_totals: Array<{
    currency: string;
    amount_minor: number;
    requests: number;
  }>;
  audit: Array<{
    id: number;
    organization_id: string | null;
    event_type: string;
    request_id: string | null;
    created_at: string;
  }>;
}

export function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    value / 100,
  );
}

export async function commercialRpc<T>(
  name: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const response = await authedFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const data = body as Record<string, unknown> | null;
    throw new Error(
      typeof data?.["message"] === "string"
        ? data["message"]
        : "Company billing could not be loaded. Contact Evologics.",
    );
  }
  return body as T;
}

export async function paymentAction(
  id: string,
  action: "checkout" | "capture",
): Promise<{ approval_url?: string; status?: string; environment?: string }> {
  const response = await authedFetch("/functions/v1/billing-checkout", {
    method: "POST",
    body: JSON.stringify({ request_id: id, action }),
  });
  const body = (await response.json()) as {
    approval_url?: string;
    status?: string;
    environment?: string;
    error?: string;
  };
  if (!response.ok)
    throw new Error(body.error || "Payment could not be confirmed.");
  if (body.approval_url) {
    const url = new URL(body.approval_url);
    if (
      url.protocol !== "https:" ||
      !["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname)
    )
      throw new Error("Unexpected checkout destination.");
  }
  return body;
}
