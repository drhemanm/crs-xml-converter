# Company licences and Evologics operations

## What exists

The platform includes two separate administration surfaces:

- **Company and billing**: licence status, shared filing/institution allowances,
  usage by reporting institution, payment requests, verified checkout return,
  and adding reporting institutions within the company allowance.
- **Evologics administration**: company portfolio, lifetime and recent filing
  counts, CRS/FATCA counts per institution, licence status, configurable annual
  plans, payment requests, bank reconciliation and commercial audit history.

Evologics operator access is stored in `aeoi_private.operators`, provisioned by
the database owner. Company owners/admins cannot grant themselves this access.
Tenant members can read their own billing; only company owners/admins can pay.
The database checks these permissions on every request. Hiding navigation is
not an authorisation boundary.

## Commercial unit and limits

A company licence covers its team and reporting institutions for one annual
term. An allowance unit is one **successful new or nil filing committed to the
connected ledger**. Corrections, amendments and voids remain in usage history
but do not consume the new-filing allowance. Failed validations, failed ledger
transactions, duplicate MessageRefIds and local evaluations are not charged.

These are recorded filing counts, not counts of every browser Generate click,
download, taxpayer account or authority-accepted return. Source data remains
local. Metadata RPCs do not prove that a client's XML was independently
validated or submitted. The regulatory engine remains usable locally; this
licence sells the connected workflow and durable history, not browser DRM.

The company contract is locked during each filing transaction so simultaneous
commits cannot spend the same remaining allowance. Limits on active reporting
institutions are checked in the database on creation/reactivation. Companies
retain read access to history after expiry or suspension.

New companies have a 30-day evaluation with three new/nil filings and one
institution. One evaluation company is allowed per creator account. Existing
companies keep their already-active institutions during migration. Existing
filings before the new evaluation start do not consume its allowance.

Seeded Professional (50 filings / 5 institutions) and Firm (250 / 50) plans are
draft commercial defaults. Their prices are **unset and unavailable** until an
Evologics operator configures them. Plan edits affect future payment requests;
issued requests and paid terms preserve their original price and allowances.

## Payment lifecycle

1. Agree the company plan, total price, currency and applicable tax treatment.
2. An operator issues a payment request in the company portfolio. This makes
   it visible in the customer's billing screen. No email is automatically sent.
3. A company owner/admin opens hosted PayPal checkout, or arranges a bank
   transfer using verified Evologics instructions. No card details enter this app.
4. The Edge Function creates the order using the price held in the database.
   Browser-supplied amounts and return parameters cannot grant access.
5. Verified capture must match the request, order, capture, merchant, amount
   and currency before the database atomically records payment and its term.
   Bank transfers require an Evologics operator and a statement reference.
6. Signed webhooks reconcile completed captures and refunded/reversed captures.
   Duplicate events do not extend terms. Refunds suspend access for operator
   review; a later completed event does not undo a refund.

The licence does not auto-renew or charge a card on a schedule. Customers pay
another annual request to renew. Same-plan early renewals queue the next term,
preserving the current term's allowance. A queued renewal activates when its
start arrives, at the next billing read or filing/institution write. Plan
changes start a new term immediately; there is no automatic proration.
Operators must agree any plan-change credit separately before collecting money.
Suspended companies require an explicit operator resolution.

Online checkout supports USD, EUR and GBP in this adapter. MUR requests use
bank transfers. Provider acceptance, settlement currency and fees must be
confirmed with Evologics' actual merchant account before enabling live checkout.

Payment requests are operational billing records, **not tax invoices**. The
platform does not compute VAT, issue fiscal documents, automatically chase
debts, send payment emails, initiate bank transfers or initiate refunds.
Refunds happen in the provider account; the verified webhook updates access.
Paid totals are grouped by currency and exclude refunded requests; they are
not an accounting revenue-recognition statement.

## Deployment and activation

Code and local/CI tests do not activate billing on the live Supabase project.
Apply the new migration after the existing ledger migrations, review its
permissions, and deploy both functions to the dedicated `taxmu` project. Check
the linked project reference before any deployment. Existing legacy migration
names must be reconciled with actual migration history before using `db push`.
Do not replay the historical migrations against an already-provisioned project.

The new migration is `supabase/migrations/20261007193040_commercial_controls.sql`.
It also breaks the existing organization/membership RLS recursion through a
private, scoped owner lookup.

Provision a verified operator user through the database owner's SQL console:

```sql
-- Replace the UUID with the verified Evologics user's auth.users.id.
insert into aeoi_private.operators(user_id) values ('VERIFIED-USER-UUID');
```

Revoking the row immediately denies operator RPCs, even if a navigation button
remains visible until refresh. Do not give customers direct table privileges.

Set these function secrets through Supabase's secret configuration, never in
the browser or repository:

| Setting | Purpose |
| --- | --- |
| `SUPABASE_URL` | Dedicated workspace project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` or default `SUPABASE_ANON_KEY` | Server auth verification and caller-scoped requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only payment settlement RPCs |
| `BILLING_SITE_URL` | Exact HTTPS app origin, without trailing slash |
| `BILLING_ENABLED` | `true` to enable checkout; otherwise disabled |
| `PAYPAL_ENVIRONMENT` | `sandbox` initially; `live` only after acceptance |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Matching provider app credentials |
| `PAYPAL_MERCHANT_ID` | Expected receiving merchant, checked on capture |
| `PAYPAL_WEBHOOK_ID` | Registered webhook ID for signature verification |
| `BILLING_ALLOW_LIVE` | Explicit `true` required for live payment calls |

Register `billing-webhook` for `PAYMENT.CAPTURE.COMPLETED`,
`PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`. The webhook disables
Supabase JWT verification because PayPal signs requests itself; the handler
verifies the provider signature before touching billing. The checkout function
keeps JWT verification enabled and verifies the signed-in Supabase user.

User calls use the user's token and database membership checks. Service keys
are used only by the server for order binding and verified settlement. Existing
CSP permits the dedicated Supabase endpoint; checkout redirects to PayPal
without embedding a third-party payment SDK or widening script/connect policy.

## Verification and launch gates

Run the platform typecheck, tests, production build, dependency audit and
Chromium suite. PostgreSQL tests use PGlite with actual schema, role grants,
RLS policies, filing RPCs and commercial triggers. Edge tests mock upstream
responses and verify security boundaries. Browser tests mock the connected
backend and exercise navigation, billing returns, bank recording and phone
layout. They are not a real merchant sandbox acceptance test.

Before accepting customer payments:

1. Apply/review the migration and run Supabase security/performance advisors.
2. Provision the verified Evologics operators; test denial for customer admins.
3. Configure agreed prices, total-price/tax handling and bank instructions.
4. Run a real merchant sandbox checkout, capture, cancel, replay and refund.
5. Test quota rejection, parallel writes, queued renewal and cross-tenant denial
   on the staging project; inspect the commercial audit and provider record.
6. Verify the rendered desktop/mobile screens and operating/support procedures.
7. Complete the existing regulatory acceptance and backup/restore gates before
   marketing a production-certified filing service. Paid pilot terms must
   explicitly describe the pre-validation scope.

If capture succeeds but the database response is lost, retry Confirm payment:
the handler reads the provider order and settlement is idempotent. If an event
cannot be mapped to its order or a payment cannot be confirmed, access remains
unchanged and the provider retries failed webhook responses. Reconcile the
provider order/capture against the payment request and audit rather than issuing
a second charge. Payment-provider APIs have 15-second per-request timeouts.

Official implementation references:
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/auth-headers
- https://developer.paypal.com/api/orders/v2
- https://developer.paypal.com/api/webhooks/v1
