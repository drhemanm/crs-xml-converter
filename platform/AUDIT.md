# Platform audit — `platform/` (Supabase + Vite)

**Date:** 2026-10-13
**Scope:** `platform/` migrations, Edge Functions, web app, packages, `.github/workflows/platform.yml`, plus a read-only inspection of the live `taxmu` Supabase project (`prlarcyfngvwkavmktex`).
**Method:** code review; migrations replayed against PGlite with Supabase roles/`auth.uid()` stubbed; platform typecheck/test/build/audit run locally. No repository or live database state was changed.

The root `AUDIT.md` covers the legacy React/Firebase converter and is not repeated here.

## Live project state (read-only, 2026-10-13)

| Observation | Consequence |
|---|---|
| 0 users, 0 organizations | No customers yet; nothing to migrate. |
| `aeoi_private` schema absent — `commercial_controls` **not applied** | Live platform has no licences, quotas, operators or billing. Filing is unlimited for every account today. |
| Live migration history ≠ repo: live has `aeoi_add_ledger_jurisdiction`, `aeoi_fill_ledger_jurisdiction` (not in repo); repo has `ledger_semantics`, `commercial_controls` (not live) | Repo cannot reproduce production. See C1. |
| `public.email_subscribers` exists live but no repo migration creates it | Out-of-band schema change. |
| Security advisor: 7 tables visible in GraphQL to `authenticated` (lint 0027) | RLS is enabled on all of them, so this is schema discoverability, not data exposure. Revoke if GraphQL is unused. |

## Local checks

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm typecheck` (8 projects) | Pass |
| `pnpm test` | 17 files, 174 tests pass (2 suites depend on root `schemas/oecd-crs-v3.0`) |
| `pnpm --filter @crs/web build` | Pass, >500 kB chunk warning |
| `pnpm audit --prod --audit-level high` | No known vulnerabilities |
| Playwright e2e | Not run |

---

## Critical

### C1. Migration chain does not apply to a fresh database
1. **Wrong order.** The Supabase CLI sorts by filename; `'1'` < `'_'`, so `20261007193040_commercial_controls.sql` runs first and fails (`public.organizations` does not exist).
2. **Duplicate versions.** Ten files share version `20261007`; `schema_migrations` keys on version.
3. **Bad grant** — `20261007_guarded_history_rpcs.sql:69` grants on `aeoi_record_filing` with 10 args (one extra `text`); the function has 9. The migration rolls back.
4. **Missing objects** — `20261007_security_hardening.sql:3-7` references `public.email_subscribers` and `public.rls_auto_enable()`, which no repo migration creates.

`apps/web/test/commercial-database.test.ts:56-73` replays only 6 hand-picked files in a hand-picked order, so CI cannot catch this.

**Impact:** `db reset`, branches/previews, disaster recovery and `db push` fail or partially apply.
**Fix:** rename to unique 14-digit versions in intended order; fix line 69; add the live-only migrations (`add/fill_ledger_jurisdiction`, `email_subscribers`) to the repo or guard those statements; `supabase migration repair` the live history; add a CI job that replays every file in sorted order (`supabase db reset` or PGlite).

## High

### H1. Company filing allowance is bypassable
- Only `filing_kind in ('new','nil')` counts (`20261007193040_commercial_controls.sql:157-162`). `filing_kind` is client-supplied, and `record_filing_internal` (`20261007_private_privileged_functions.sql:28,41-56`) never checks that a "correction"/"amended" filing references an existing live DocRefId. Confirmed: after the allowance was exhausted, bogus `correction` and `amended` filings with new data were accepted.
- Recording is optional: XML is generated and downloadable in the browser before "Record as filed" (`apps/web/src/CrsApp.tsx:403-462`, `FatcaApp.tsx:204-292`).

**Fix:** decide whether limits are enforced or advisory. If enforced: require corrections/voids/amendments to reference existing live DocRefIds in the same org/institution/period, check `doc_type_indic` matches the kind, count any OECD1/FATCA1 record regardless of label; longer term, gate download on a server-recorded filing.

### H2. Ledger record states can be rewritten by preparers/reviewers
- `record_filing_internal` stores client-supplied `record_state`/`superseded_by` as-is (`private_privileged_functions.sql:55`). Confirmed: `record_state: 'live'` with `corr_doc_ref_id: 'NONEXISTENT'` accepted.
- `apply_authority_status_internal` (`:72-128`) lets any reviewer/preparer set any record to any state and flip a filing between accepted/rejected repeatedly with an unverified, free-text authority response. Confirmed in PGlite.

**Impact:** later corrections target wrong DocRefIds or produce duplicate live records → authority rejections. Actions are audited (append-only `audit_events`).
**Fix:** force `pending`/`null` on insert; enforce a state machine (`pending → live|rejected`, `live → superseded` only with a matching correction); block re-applying a final status without owner/admin override.

## Medium

- **M1. Large filings will likely time out (untested).** Up to 250,000 entries per RPC, inserted row by row with a per-row trigger, against the default 8 s `authenticated` timeout. Use set-based `INSERT … SELECT FROM jsonb_to_recordset`, a per-function timeout, and load-test.
- **M2. GB XML declared ISO-8859-1 but written UTF-8** (`packages/jurisdictions/src/packs.ts:245`; `CrsApp.tsx:455`; `apps/cli/src/index.ts:196`). Accented names reach HMRC garbled. Encode to Latin-1 bytes for that charset.
- **M3. Stuck payment request.** A request with a PayPal order attached cannot be voided (`commercial_controls.sql:318`) and only one open request is allowed (`:78`); an abandoned checkout blocks the company permanently. Allow operator void after confirming the order was never captured.
- **M4. Partial refund suspends the whole licence** (`supabase/functions/_shared/payment-service.ts:234-241` → `commercial_controls.sql:368-372`). Suspend only on full refund/reversal.
- **M5. Sandbox by default.** `sandbox = env.PAYPAL_ENVIRONMENT !== "live"` (`payment-service.ts:47`) and the request does not record its environment, so a missing/mistyped variable lets sandbox payments activate real licences. Require exactly `sandbox|live`, store the environment, refuse cross-environment settlement.
- **M6. Billing failures are silent** (`payment-service.ts:414-423`): every error becomes a generic 400 with no log. Log structured PII-free errors, return 5xx for internal faults, alert on webhook failures.
- **M7. Download before record** lets the ledger diverge from what the authority holds. Record (status `generated`) before download, or block new filings while one is unrecorded.

## Low

- **L1.** Institutions cannot be edited or deactivated: `20261007_restrict_pseudonym_key.sql:2-12` removed UPDATE. With an evaluation cap of 1, a typo is permanent. Add an owner/admin RPC.
- **L2.** Membership is managed only by `created_by`, not by the `owner`/`admin` roles (`commercial_controls.sql:19-27`); no ownership transfer; members are added without acceptance; preparers can add institutions via RLS (`20261007_aeoi_ledger.sql:208-215`) though the UI shows it only to admins.
- **L3.** One-evaluation-per-account only matches contracts still on `evaluation` (`commercial_controls.sql:127-131`), so it resets after upgrade. Unconfirmed: `select … from auth.users for update` in that trigger may need UPDATE on `auth.users`; test on a branch before applying the migration.
- **L4.** `CrsApp.tsx:289` falls back to the raw account number as `business_key`, and `deriveKeys` uses `"unkeyed"` with an empty secret (`:72`). Throw instead.
- **L5.** Session in `localStorage` (`backend.ts:103`); mitigated by strict CSP and no raw HTML sinks.
- **L6.** 20 MB upload limit applies to compressed size (`spreadsheet.ts:8`); CSV path does not reject duplicate headers like XLSX does (`:26-29` vs `:50-56`).
- **L7.** CI: actions pinned to tags not SHAs; no migration replay; `paths` filter ignores root `schemas/**`; Vercel `buildCommand` runs no tests.
- **L8.** `hydrateInstitutionForFiling` swallows all errors (`backend.ts:366-374`); webhook re-serialises parsed JSON for PayPal verification (`payment-service.ts:157,281`), possibly brittle (unconfirmed).

## Info

- **I1.** CSP `connect-src` (`vercel.json:13`) and `backend.ts:1-2` defaults hard-code `prlarcyfngvwkavmktex` (= `taxmu`). Any other project is CSP-blocked; a build without env vars silently targets production.
- **I2.** Default DELETE/TRUNCATE/REFERENCES/TRIGGER grants to `authenticated` remain (`aeoi_ledger.sql:337-343`); RLS blocks DELETE. Revoke for defence in depth.
- **I3.** Pseudonym HMAC key sits beside the digests (DB via preparer RPC; IndexedDB `ledger-storage.ts:15`); low-entropy account numbers are brute-forceable by a key holder.
- **I4.** Unconfirmed: Edge Function sends the service key as `Bearer`; verify compatibility if using new `sb_secret_` keys.

## Done well

No cross-tenant read path or operator self-escalation was found. Privileged functions are `SECURITY DEFINER` with `search_path=''`, membership/role checks and invoker wrappers; PUBLIC EXECUTE is revoked; operator table is unreachable from clients. History tables are RPC-only with an append-only audit trail. Settlement locks rows, matches amount/currency/reference, and is idempotent; webhooks verify signatures with PayPal, re-fetch captures, check merchant, and dedupe events. Checkout verifies the user server-side, locks CORS to `BILLING_SITE_URL`, and requires `BILLING_ALLOW_LIVE` for live. Strong CSP/HSTS/COOP headers; only the publishable key ships. XML is built with an escaping tree serializer and schema-validated before download. Taxpayer source data stays on the device.

## Priority

1. C1 — blocks any reproducible deployment, and must precede applying commercial controls live.
2. H1, H2 — decide enforcement model, then harden `record_filing_internal` / `apply_authority_status_internal`.
3. M5, M6 — before any live payment.
4. M3, M4.
5. M2 (UK filers).
6. M1 load test, M7.
7. Low / Info.
