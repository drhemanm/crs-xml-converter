import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const OP = "00000000-0000-4000-8000-000000000001",
  A = "00000000-0000-4000-8000-000000000002",
  B = "00000000-0000-4000-8000-000000000003";
const VIEWER = "00000000-0000-4000-8000-000000000004";
const ORG = "00000000-0000-4000-8000-000000000010",
  OTHER = "00000000-0000-4000-8000-000000000011",
  FI = "00000000-0000-4000-8000-000000000020";
let db: PGlite;
async function user(id: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function rpc<T = unknown>(name: string, params: unknown[] = []) {
  const result = await db.query<{ value: T }>(
    `select public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) value`,
    params,
  );
  return result.rows[0]!.value;
}
async function filing(ref: string, kind = "new") {
  // The original guarded RPC and the actual commercial triggers run together.
  return rpc("aeoi_record_filing", [
    ORG,
    FI,
    "CRS",
    "2026-12-31",
    "crs-v3.0",
    kind,
    ref,
    "a".repeat(64),
    JSON.stringify([
      {
        record_kind: "ReportingFI",
        doc_ref_id: ref + "-fi",
        doc_type_indic: "OECD1",
        business_key: "fi",
        payload_digest: "b".repeat(64),
        record_state: "pending",
      },
    ]),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    insert into auth.users values('${OP}'),('${A}'),('${B}'),('${VIEWER}');`);
  const migration = (name: string) =>
    readFileSync(
      new URL(`../../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );
  await db.exec(
    migration("20261007_aeoi_ledger.sql").replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  await db.exec(migration("20261007_ledger_semantics.sql"));
  await db.exec(migration("20261007_durable_corrections.sql"));
  await db.exec(migration("20261007_private_privileged_functions.sql"));
  await db.exec(migration("20261007_revoke_direct_history_writes.sql"));
  await db.exec(migration("20261007193040_commercial_controls.sql"));
  await db.exec(`insert into aeoi_private.operators(user_id) values('${OP}');`);
  await user(A);
  await db.query(
    "insert into public.organizations(id,name,created_by) values($1,'Company A',$2)",
    [ORG, A],
  );
  await db.query(
    "insert into public.reporting_institutions(id,organization_id,legal_name,jurisdiction,identifier_type,identifier_value) values($1,$2,'Institution A','MU','TAN','MU12345')",
    [FI, ORG],
  );
  await user(B);
  await db.query(
    "insert into public.organizations(id,name,created_by) values($1,'Company B',$2)",
    [OTHER, B],
  );
  await user(A);
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'viewer')",
    [ORG, VIEWER],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("commercial database authorization and transaction behaviour", () => {
  test("company viewers may inspect usage but cannot pay or manage commercial settings", async () => {
    await user(VIEWER);
    expect(
      (await rpc<{ can_manage: boolean }>("aeoi_company_billing", [ORG]))
        .can_manage,
    ).toBe(false);
    await expect(rpc("aeoi_admin_dashboard")).rejects.toThrow(/operator/);
    await expect(
      rpc("aeoi_issue_payment_request", [ORG, "professional"]),
    ).rejects.toThrow(/operator/);
  });
  test("members cannot inspect other companies or provision themselves as operators", async () => {
    await user(A);
    expect(await rpc("aeoi_commercial_access")).toBe(false);
    await expect(rpc("aeoi_company_billing", [OTHER])).rejects.toThrow(
      /denied/,
    );
    await expect(rpc("aeoi_admin_dashboard")).rejects.toThrow(/operator/);
    await expect(
      db.query("insert into aeoi_private.operators(user_id) values($1)", [A]),
    ).rejects.toThrow(/permission/);
    await expect(
      rpc("aeoi_provider_payment", [
        ORG,
        "ORDER123",
        "CAPTURE123",
        10000,
        "USD",
      ]),
    ).rejects.toThrow(/permission/);
  });
  test("operators see a separate company portfolio without being tenant members", async () => {
    await user(OP);
    expect(await rpc("aeoi_commercial_access")).toBe(true);
    const dashboard = await rpc<{ companies: unknown[]; plans: unknown[] }>(
      "aeoi_admin_dashboard",
    );
    expect(dashboard.companies).toHaveLength(2);
    expect(dashboard.plans).toHaveLength(3);
  });
  test("failed transactions and duplicate filing references consume no extra allowance", async () => {
    await user(A);
    await filing("TEST-1");
    await expect(filing("TEST-1")).rejects.toThrow(/duplicate/);
    await expect(
      rpc("aeoi_record_filing", [
        ORG,
        FI,
        "CRS",
        "2026-12-31",
        "crs-v3.0",
        "new",
        "INVALID-ROW",
        "a".repeat(64),
        JSON.stringify([{ record_kind: "ReportingFI" }]),
      ]),
    ).rejects.toThrow(/metadata/);
    const billing = await rpc<{ filings_used: number }>(
      "aeoi_company_billing",
      [ORG],
    );
    expect(billing.filings_used).toBe(1);
  });
  test("company quota is shared; corrections do not consume it", async () => {
    await user(A);
    await filing("TEST-2");
    await filing("TEST-3", "nil");
    await expect(filing("TEST-4")).rejects.toThrow(/allowance reached/);
    await filing("CORRECTION-1", "correction");
    const billing = await rpc<{
      filings_used: number;
      institutions: Array<{ crs_filings: number }>;
    }>("aeoi_company_billing", [ORG]);
    expect(billing.filings_used).toBe(3);
    expect(billing.institutions[0]!.crs_filings).toBe(4);
  });
  test("institution caps and evaluation-company caps are enforced in the database", async () => {
    await user(A);
    await expect(
      db.query(
        "insert into public.reporting_institutions(organization_id,legal_name,jurisdiction,identifier_type,identifier_value) values($1,'Second FI','MU','TAN','MU999')",
        [ORG],
      ),
    ).rejects.toThrow(/institution allowance/);
    await expect(
      db.query(
        "insert into public.organizations(name,created_by) values('Extra trial',$1)",
        [A],
      ),
    ).rejects.toThrow(/one evaluation/i);
    await expect(
      db.query(
        "update public.reporting_institutions set organization_id=$1 where id=$2",
        [OTHER, FI],
      ),
    ).rejects.toThrow(/cannot be moved/);
  });
  test("unconfigured prices cannot issue payment requests; company owners cannot set prices", async () => {
    await user(OP);
    await expect(
      rpc("aeoi_issue_payment_request", [ORG, "professional"]),
    ).rejects.toThrow(/price first/);
    await user(A);
    await expect(
      rpc("aeoi_configure_plan", [
        "professional",
        "Professional",
        50,
        5,
        9900,
        "USD",
        true,
      ]),
    ).rejects.toThrow(/operator/);
  });
  test("bank transfers require exact amounts, activate one annual licence and are idempotent", async () => {
    await user(OP);
    await rpc("aeoi_configure_plan", [
      "professional",
      "Professional",
      50,
      5,
      9900,
      "USD",
      true,
    ]);
    const id = await rpc<string>("aeoi_issue_payment_request", [
      ORG,
      "professional",
    ]);
    await expect(
      rpc("aeoi_record_bank_payment", [id, "BANK-001", 9901, "USD"]),
    ).rejects.toThrow(/does not match/);
    await rpc("aeoi_record_bank_payment", [id, "BANK-001", 9900, "USD"]);
    await rpc("aeoi_record_bank_payment", [id, "BANK-001", 9900, "USD"]);
    await user(A);
    const billing = await rpc<{
      status: string;
      filing_limit: number;
      filings_used: number;
      payment_requests: Array<{ period_start: string; period_end: string }>;
    }>("aeoi_company_billing", [ORG]);
    expect(billing.status).toBe("active");
    expect(billing.filing_limit).toBe(50);
    expect(billing.filings_used).toBe(0);
    expect(
      new Date(billing.payment_requests[0]!.period_end).getUTCFullYear() -
        new Date(billing.payment_requests[0]!.period_start).getUTCFullYear(),
    ).toBe(1);
    await expect(
      rpc("aeoi_record_bank_payment", [id, "BANK-002", 9900, "USD"]),
    ).rejects.toThrow(/operator/);
  });
  test("a pending smaller plan cannot be oversold by adding institutions before capture", async () => {
    await user(OP);
    await rpc("aeoi_configure_plan", [
      "solo",
      "Solo",
      20,
      1,
      5000,
      "USD",
      true,
    ]);
    const id = await rpc<string>("aeoi_issue_payment_request", [ORG, "solo"]);
    await user(A);
    await expect(
      db.query(
        "insert into public.reporting_institutions(organization_id,legal_name,jurisdiction,identifier_type,identifier_value) values($1,'Second FI','MU','TAN','MU999')",
        [ORG],
      ),
    ).rejects.toThrow(/pending plan/);
    await user(OP);
    await rpc("aeoi_change_payment_request", [
      id,
      "void",
      "Customer chose a different plan",
    ]);
  });
  test("renewal is queued without resetting the current allowance, and suspension blocks filing", async () => {
    await user(A);
    await filing("PAID-FILING-1");
    await user(OP);
    const renewal = await rpc<string>("aeoi_issue_payment_request", [
      ORG,
      "professional",
    ]);
    await rpc("aeoi_record_bank_payment", [renewal, "BANK-RENEW", 9900, "USD"]);
    const billing = await rpc<{
      filings_used: number;
      payment_requests: Array<{ id: string }>;
    }>("aeoi_company_billing", [ORG]);
    expect(billing.filings_used).toBe(1);
    await rpc("aeoi_change_payment_request", [
      renewal,
      "suspend",
      "Customer fraud review",
    ]);
    await user(A);
    await expect(filing("SUSPENDED")).rejects.toThrow(/inactive/);
  });
  test("verified provider captures are bound to the request and replayed webhooks do not extend access", async () => {
    await user(OP);
    const id = await rpc<string>("aeoi_issue_payment_request", [
      OTHER,
      "professional",
    ]);
    await user("", "service_role");
    await rpc("aeoi_bind_payment_order", [id, "ORDER-123"]);
    await expect(
      rpc("aeoi_provider_payment", [
        id,
        "WRONG-ORDER",
        "CAPTURE-123",
        9900,
        "USD",
      ]),
    ).rejects.toThrow(/does not match/);
    await rpc("aeoi_provider_webhook", [
      "EVENT-1",
      "PAYMENT.CAPTURE.COMPLETED",
      "ORDER-123",
      "CAPTURE-123",
      9900,
      "USD",
      false,
    ]);
    await rpc("aeoi_provider_webhook", [
      "EVENT-1",
      "PAYMENT.CAPTURE.COMPLETED",
      "ORDER-123",
      "CAPTURE-123",
      9900,
      "USD",
      false,
    ]);
    await user(B);
    const billing = await rpc<{ status: string; payment_requests: unknown[] }>(
      "aeoi_company_billing",
      [OTHER],
    );
    expect(billing.status).toBe("active");
    expect(billing.payment_requests).toHaveLength(1);
    await user("", "service_role");
    await rpc("aeoi_provider_webhook", [
      "EVENT-2",
      "PAYMENT.CAPTURE.REFUNDED",
      "ORDER-123",
      "CAPTURE-123",
      9900,
      "USD",
      true,
    ]);
    await rpc("aeoi_provider_webhook", [
      "EVENT-3",
      "PAYMENT.CAPTURE.COMPLETED",
      "ORDER-123",
      "CAPTURE-123",
      9900,
      "USD",
      false,
    ]);
    await user(B);
    expect(
      (await rpc<{ status: string }>("aeoi_company_billing", [OTHER])).status,
    ).toBe("suspended");
  });
  test("anonymous users cannot invoke billing or service settlement APIs", async () => {
    await user("", "anon");
    await expect(rpc("aeoi_company_billing", [ORG])).rejects.toThrow(
      /permission/,
    );
    await expect(rpc("aeoi_admin_dashboard")).rejects.toThrow(/permission/);
    await expect(
      rpc("aeoi_provider_webhook", ["X", "X", "X", "X", 1, "USD", false]),
    ).rejects.toThrow(/permission/);
  });
});
