# Platform Audit — CRS XML Converter SaaS

**Date:** 2026-07-26
**Scope:** Full repository — React frontend, Firebase (Auth/Firestore/Functions), Vercel serverless API, PayPal billing, Firestore security rules, configuration, and compliance posture.

---

## Executive summary

The core product (Excel/CSV → CRS v3.0 XML conversion in the browser) is functional and reasonably built, but the platform around it has **critical security and revenue-integrity flaws**. The three most serious problems:

1. **Any signed-in user can grant themselves an unlimited Enterprise plan** — Firestore rules let users write their own `users/{uid}` document, where `plan`, `conversionsLimit`, `conversionsUsed`, and even `role: 'admin'` live. All entitlement enforcement is client-side.
2. **The PayPal webhook accepts forged events** — neither webhook implementation verifies PayPal's signature, so an unauthenticated `POST` can activate a subscription for any account.
3. **Paying is actually impossible** — the pricing/checkout UI is never rendered, the checkout component charges one-time prices ($29/$99) that don't match the advertised plans ($79/$299), and one-time payments would never trigger the subscription webhook that upgrades accounts anyway.

Additionally, the Firestore rules for audit collections are broken (audit writes are silently denied), the GDPR data-request portal is a stub that stores requests in the requester's own browser, and stated retention policies contradict what the code does. Several "GDPR compliant / 7-year retention / 100% XSD validated" claims in the UI and audit metadata are not backed by the implementation, which is a real exposure for a regulatory-compliance product.

Severity counts: **7 critical, 7 high, 8 medium, 7 low.**

> **Update (added after CRS domain research):** a seventh critical finding, **C0**, was added below and is more serious than any security issue here — the generator fabricates self-certification attestations when source data is missing, causing institutions to make false statements to their tax authority. See also `CONCEPT.md` for a strategic and architectural assessment of whether this product concept is sound.

---

## Critical findings

### C0. Fabricated regulatory attestations in generated filings — highest severity
*(Added after CRS domain research; see `CONCEPT.md` §2.5 for the full analysis.)*

> **Status: fixed in the live app.** A missing self-certification now emits the
> OECD "not reported" sentinel (`CRS900` / `CRS1000`), never `CRS901` / `CRS1001`.
> A *present but unrecognised* value rejects the row instead of falling through
> to a default. `AcctHolderType` has no sentinel and is now a hard stop. The
> `"Not Provided"` street/city and `"XX"` country substitutions from M4 are gone
> with it: Street is omitted when absent, City and residence country are
> required. Rejected rows are shown to the filer with reasons and excluded from
> the report count, which previously over-stated the file's contents. Covered by
> `src/components/crsGeneration.test.js`.

When a source column is missing, `mapDataToCRS` does not fail and does not mark the value unknown — it substitutes a compliant-looking default (`CRSXMLConverter.js:1346-1351`, `:1396`, `:1419-1422`). Most seriously, `SelfCert` defaults to **`CRS901`** and controlling-person `SelfCert` to **`CRS1001`** — both meaning *"a valid self-certification was obtained."*

An institution that uploads a spreadsheet with no `self_cert` column will therefore file a return asserting, for every account, that it holds a valid self-certification — the cornerstone due-diligence obligation under CRS. If it does not hold them, the institution has made a false statement to its tax authority, produced by a tool that reported the output as "100% compliant."

The schema provides the honest alternative and the code ignores it: the "not reported" sentinels `CRS900` / `CRS1000` / `CRS1100` / `CRS1200` / `CRS800` are declared in this file (`:172-217`) and never used. Their validity is gated on reporting period (not usable for periods after 2025-12-31, valid for earlier ones), so the fix must branch on `ReportingPeriod`.

**Fix:** treat missing required data as a hard stop, or emit the period-appropriate "not reported" sentinel. Never a plausible default. Same applies to the `"Not Provided"` street/city and `"XX"` country-code substitutions at `:1587-1590` (finding M4).

### C1. Users can self-upgrade to any plan (broken access control)

> **Status: fixed.** `users/{uid}` update is now restricted to an explicit
> allow-list of profile fields; `plan`, `conversionsLimit`,
> `subscriptionStatus`, `role` and `email` are unwritable from a client, on
> create as well as update. Create additionally pins the free-plan values and
> requires the document's email to match the caller's token. Covered by
> `firestore-tests/rules.test.mjs`.
`firestore.rules:5-7` gives the account owner unrestricted `write` on `users/{userId}`:

```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

The same document stores the billing entitlements the app enforces (`plan`, `conversionsLimit`, `conversionsUsed`, `subscriptionStatus` — see `CRSXMLConverter.js:2030-2059`). Any user can run one `updateDoc` from the browser console and get `plan: 'enterprise'`, `conversionsLimit: 10^9`, `conversionsUsed: 0`. Quota checks (`getUserConversionStatus`, `CRSXMLConverter.js:554`) run entirely client-side against this user-writable data.

**Fix:** Split entitlements out of the user-writable document (e.g. `users/{uid}/private/entitlements` writable only by Admin SDK / Cloud Functions), or restrict the rule with `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...safe fields...])`. Enforce quota server-side (see C4).

### C2. PayPal webhooks are not verified — forged subscription activation
Both webhook handlers process events with **no signature verification**:
- `functions/index.js:10-60` — reads `functions.config().paypal?.webhook_id` into a variable and never uses it. CORS is opened to `*` for good measure.
- `api/paypal-webhook.js:16-50` — same pattern with `process.env.PAYPAL_WEBHOOK_ID`, and its event handlers are empty stubs.

`handleSubscriptionActivated` (`functions/index.js:73-145`) looks up the user **by the email inside the attacker-supplied payload** and upgrades them. An unauthenticated `curl` with `event_type: BILLING.SUBSCRIPTION.ACTIVATED`, your own email, and plan ID `P-85257906JW695051MNCWWEIQ` yields a free Enterprise plan.

**Fix:** Verify every event with PayPal's `/v1/notifications/verify-webhook-signature` API (or validate the transmission headers against the webhook cert) before acting; reject on failure. Delete whichever of the two handlers isn't the live one.

### C3. Admin check is defeatable via C1 (`role` is user-writable)

> **Status: fixed.** `manualResetUser` now checks
> `context.auth.token.admin === true` -- a custom claim, settable only through
> the Admin SDK (`functions/scripts/set-admin-claim.js`). The rules refuse to
> write a `role` field at all.
`manualResetUser` (`functions/index.js:336-368`) gates on `users/{uid}.role === 'admin'` — but per C1 users can write `role: 'admin'` into their own document, then reset any user's quota (the target `userId` is caller-supplied). **Fix:** use Firebase custom claims for admin, not a user-writable field.

### C4. All usage metering and limits are client-enforced

> **Status: partially mitigated, still open.** Rules now allow
> `conversionsUsed` to advance by exactly one and never past
> `conversionsLimit`, so the counter cannot be reset and the limit cannot be
> raised from the browser. The client still decides whether to call the
> increment at all, so a tampered client converts for free. Closing that needs
> server-side counting; it is bundled with the payment work.
- Anonymous limit: `localStorage` (`CRSXMLConverter.js:358-416`) — cleared in two clicks, or bypassed with incognito.
- Registered limit: checked in the browser and incremented by the browser (`updateUserUsage`, `CRSXMLConverter.js:2229`); a user who blocks that write converts for free forever.
- XML generation itself happens fully client-side, so nothing stops a tampered client.

**Fix:** If quotas matter commercially, move conversion (or at least a signed "conversion token" issuance/decrement) behind a Cloud Function with server-side counting via a Firestore transaction.

### C5. The payment funnel is broken end-to-end (revenue integrity)
- `PayPalCheckout.js` is **never imported or rendered anywhere** — there is no upgrade/pricing UI in the app, so no customer can ever pay.
- If it were rendered: it creates **one-time orders** at `$29/$99` (`PayPalCheckout.js:6-9`) while `PRICING_PLANS` advertises **subscriptions** at `$79/$299` (`CRSXMLConverter.js:89-144`), and `analytics.js` values them at `$29/$99` again.
- One-time orders never emit `BILLING.SUBSCRIPTION.*` events, so even a successful payment would never upgrade the account. The order amount is also entirely client-controlled and never verified server-side.

**Fix:** Decide the model (subscriptions, given the webhook), render a pricing section using `PayPalButtons` with `createSubscription({plan_id})`, and reconcile all price constants. Grant entitlements only from the verified webhook (C2).

### C6. Secrets/config committed to the repository
`.env` is committed (added 2025-08-26) despite being listed in `.gitignore`, and `.gitignore` itself has a PayPal client ID pasted into it (`.gitignore:32-33`). The Firebase web config and PayPal client ID are public-by-design values, but `PAYPAL_WEBHOOK_ID` is server config, and committing `.env` files sets the pattern that will eventually leak a real secret. **Fix:** `git rm --cached .env`, clean the `.gitignore` stray lines, move server config to Vercel/Firebase secret storage, and rotate the webhook ID. Also enable Firebase API-key referrer restrictions.

---

## High-severity findings

### H1. Audit-trail Firestore rules are broken — audit logging silently fails

> **Status: fixed.** Create rules test `request.resource.data`, entries must
> be attributed to the caller and stamped with `request.time`, and update and
> delete are denied outright. Unauthenticated writes are refused everywhere --
> anonymous trial conversions are no longer logged, and the client no longer
> attempts it, so there is no open write endpoint into Firestore.
Every audit `create` rule tests `resource.data.userId` (`firestore.rules:10-42`). On a `create`, `resource` does not exist — the correct object is `request.resource.data` — so the condition errors → denies. The anonymous catch-all block (`firestore.rules:39-42`) has the same bug **and** still implicitly requires auth context evaluation; unauthenticated writes are denied too. Net effect: **every `addDoc` to the audit collections fails**, and the app swallows the error with `console.error` (`logAuditEvent`, `CRSXMLConverter.js:486-488`). The product's advertised compliance audit trail does not exist in production.

**Fix:** Use `request.resource.data.userId == request.auth.uid` (create-only, no client read/update/delete), or better: write audit entries from a Cloud Function so clients can't forge them at all. Add an integration test against the Firestore emulator.

### H2. Retention claims contradict the code

> **Status: fixed.** One number now, everywhere: 12 months. That is what the
> privacy policy already published, so the code moved to match it rather than
> the other way round. `cleanupAuditLogs` uses a 365-day window and the audit
> metadata stamp reads `12_MONTHS`. The policy's "uploaded files deleted
> within 24 hours" line was also wrong in the other direction -- files never
> leave the browser, so there is nothing to delete.
Audit entries are stamped `retentionPeriod: '7_YEARS'` (`CRSXMLConverter.js:475`), while `cleanupAuditLogs` deletes anything older than **90 days** (`functions/index.js:284-333`). For a CRS compliance product, misstating audit retention is a serious legal exposure. Pick one policy and make code, privacy policy, and metadata agree.

### H3. GDPR Data Request Portal is a façade

> **Status: fixed.** Signed-in users lodge requests into `data_requests` in
> Firestore, with a real reference, a server timestamp, and a status list that
> reads back from the database. Everyone else gets a pre-filled mailto to
> `contacts@evologics.ai` rather than a fake success screen: we hold personal
> data only for registered accounts, and being signed in is what verifies the
> requester's identity. The verification-method picker, which offered
> processes that did not exist, is gone. Write failures are shown with the
> support address instead of being swallowed.
`DataRequestPortal.js:79-108` "submits" access/erasure/rectification requests to `localStorage` in the requester's own browser after a fake 2-second delay. No one at the company is ever notified. Users are led to believe they exercised statutory rights (30-day deadlines are displayed). **Fix:** persist requests to a backend (Firestore collection + email notification via a Cloud Function) or replace the portal with a mailto flow until one exists.

### H4. Known-vulnerable and end-of-life dependencies

> **Status: partially fixed. The `xlsx` swap needs a network this environment
> does not have and is the one item left for you.**
>
> - **`package-lock.json` did not exist.** Every deploy resolved dependency
>   versions fresh, so builds were not reproducible and a compromised
>   transitive package would land silently. A lockfile is now committed.
> - **`xlsx@0.18.5` — still vulnerable, now defended at the boundary.** npm
>   reports "No fix available": SheetJS stopped publishing to npm and ships
>   fixed builds from its own CDN, which this environment's network policy
>   blocks, so the upgrade could not be made *or verified* here. The fix is one
>   line in `package.json`, on a machine that can reach `cdn.sheetjs.com`:
>
>   ```
>   "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
>   ```
>
>   Until then the parse boundary defends itself: uploads capped at 15 MB,
>   parser options cut to only what the converter reads (styles, formulas,
>   number formats and cell stubs were all being parsed and none are used),
>   rows rebuilt on a null prototype with `__proto__`/`constructor`/`prototype`
>   keys dropped, and an explicit check that `Object.prototype` was not
>   modified during the parse — if it was, the file is rejected and the
>   addition removed. Covered by tests in `crsGeneration.test.js`.
> - **Cloud Functions Node 18 → 22.** 18 is decommissioned; deploys were
>   blocked.
> - **`firebase-functions@4` / `functions.config()`** — still open. The only
>   consumer is the PayPal webhook ID, so this moves with the payment work.
> - **`react-scripts@5` (CRA) is unmaintained** — still open. Most of what
>   `npm audit` reports is its dev toolchain (webpack-dev-server, sockjs),
>   which never reaches a browser. Migrating to Vite is a real piece of work
>   and not a security fix; it should be scheduled on its own.
- `xlsx@0.18.5` — known prototype-pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363) advisories; the npm package is abandoned (SheetJS distributes fixed builds from its own registry). This library parses untrusted uploaded files — the single most exposed code path in the app.
- Cloud Functions pinned to **Node 18** (`functions/package.json:12`) — deprecated/decommissioned on Cloud Functions; deploys will be blocked.
- `firebase-functions@4` with `functions.config()` — the `functions.config()` API is shut down (March 2026 deadline); `resetMonthlyLimits`/`pubsub.schedule` v1 style also needs migration to v2.
- `react-scripts@5` (CRA) is deprecated/unmaintained.

### H5. Webhook duplication and dead code
Two divergent webhook implementations exist (`api/paypal-webhook.js` on Vercel, `functions/index.js` on Firebase). The Vercel one has empty handler stubs (`// ... existing code`), meaning if PayPal points there, **nothing happens at all** on payment events. Keep exactly one, delete the other.

### H6. `resetMonthlyLimits` breaks at >500 users

> **Status: fixed.** Chunked into batches of 500. `cleanupAuditLogs` was
> deleting at most 500 documents per collection per week, so it never caught
> up on a busy collection; it now loops until the expiry window is drained,
> bounded at 20 passes so one invocation cannot overrun the function timeout.
Single `WriteBatch` for all active users (`functions/index.js:250-265`); Firestore batches cap at 500 ops, so the monthly reset throws and **no one's quota resets** once the user base passes 500. Chunk into batches of ≤500 (`cleanupAuditLogs` already does this correctly).

### H7. Missing modern security headers

> **Status: fixed.** `vercel.json` and `firebase.json` now carry the same
> policy: CSP, HSTS, Referrer-Policy, Permissions-Policy,
> Cross-Origin-Opener-Policy, X-Content-Type-Options and X-Frame-Options.
> The deprecated X-XSS-Protection is gone. The build sets
> `INLINE_RUNTIME_CHUNK=false` so `script-src` needs no `'unsafe-inline'`.
> Verified by driving the app under the exact production headers: no CSP
> violations, and a probe confirms each disallowed origin is blocked.
`vercel.json` sets only `X-Content-Type-Options`, `X-Frame-Options`, and the deprecated `X-XSS-Protection`. No **Content-Security-Policy**, **Strict-Transport-Security**, **Referrer-Policy**, or **Permissions-Policy**; `firebase.json` hosting sets none at all. Given the app handles financial PII in-browser and loads the PayPal SDK, a CSP is the main XSS backstop.

---

## Medium-severity findings

- **M1. PII flows into logs and analytics.** ~~Audit entries store `userEmail` in plaintext; `console.log` sprinkles user/session data into the browser console; `analytics.js`'s duplicate `trackEvent` lacks PII sanitization.~~
  **Fixed.** `userEmail` is gone from audit entries — `userId` attributes the record and the address is resolvable from Auth when genuinely needed. The remaining production `console.log` calls are gated on `NODE_ENV`. `src/utils/analytics.js` is deleted: nothing imported it, and it held both an unsanitized `trackEvent` waiting to be picked up by mistake and a second set of prices contradicting `PRICING_PLANS`.
- **M2. "100% XSD compliant" is asserted, never verified.** ~~The string appears ~40 times; `xmlValidation: 'PASSED'` is hardcoded.~~
  **Fixed.** Every "100% compliant" claim is gone from UI copy, comments and metadata. `xmlValidation` now records `NOT_PERFORMED`, which is the truth: the XSDs are not bundled and the browser cannot fetch them, so nothing is validated. Writing `PASSED` put a false assertion of validation into the audit trail — the record a regulator would rely on. Actually validating still requires bundling the schemas (the `platform/` package does this with libxml2-wasm).
- **M3. XML correctness gaps.** **Fixed.**
  - `targetNamespace` removed from the instance document.
  - `DocRefId` / `MessageRefId` now begin with the transmitting country code and reporting year (`<CC><YYYY><unique>`), which jurisdictions validate on upload. The previous `DOC` + base36 had no country prefix and would be rejected before the file was read.
  - Ambiguous dates are rejected rather than guessed. `03/04/1980` parses as a valid date both day-first and month-first, and the old code silently took whichever succeeded first — a wrong birth date on a tax return. Unambiguous forms and ISO are accepted; anything else names the column and asks for `YYYY-MM-DD`. The reader is also told to render date cells as ISO, because it was reformatting a good `1980-05-12` into `"5/12/80"` and manufacturing the ambiguity itself.
  - `ReceivingCountry` is left equal to the FI's own jurisdiction. This audit line was wrong: for domestic FI-to-authority filing that is correct, and MRA in particular requires a single consolidated file per FI per year covering all reportable jurisdictions, which only works with the local jurisdiction as receiver.
- **M4. Fabricated fallback data in regulatory output.** **Fixed** with C0 — see above.
- **M5. Firebase config in Cloud Function env for Vercel API.** `firebase-admin-config.js` expects `FIREBASE_PRIVATE_KEY` in Vercel env — acceptable, but there's no runtime guard: a missing var yields a cryptic crash inside the webhook `try` and returns 500 to PayPal forever (no dead-letter/retry handling, no idempotency — replayed events double-append history records).
- **M6. Webhook handlers never dedupe events.** PayPal redelivers; `payment_history`/`subscription_history`/`paypal_events` will accumulate duplicates. Key writes by `event.id`.
- **M7. Rules leave server-only collections implicit.** **Fixed** — explicit `match /{document=**} { allow read, write: if false; }` added, with a rules test asserting an arbitrary collection is unwritable.
  Original finding: `paypal_events`, `payment_history`, `subscription_history`, `pending_subscriptions`, `system_events`, `audit_subscription_events` have no rules (default deny — fine today), but there's no explicit deny-all catch-all, so a future careless rule addition inherits risk. Add an explicit `match /{document=**} { allow read, write: if false; }` at the end.
- **M8. `window.location.reload()` after auth** **Fixed** — all three removed. Beyond masking the auth race, a reload mid-session discarded an already-uploaded file and its validation results.
  Original finding: (`CRSXMLConverter.js:2418,2431,2450`) — full page reloads defeat SPA state and mask the auth-state race it papers over; `onAuthStateChanged` already handles this.

---

## Low-severity / code-quality findings

- **L1.** `App.js:4` imports a non-existent named export `{ CRSXMLConverter }` (unused → `undefined`); dead line.
- **L2.** `CRSXMLConverter.js` is a 3,625-line file containing Firebase init, constants, validation, XML generation, auth context, and all UI. Split into modules; XML generation logic deserves its own tested package.
- **L3.** No tests of any kind, and no CI. For a product whose output goes to tax authorities, the XML generator and validators are prime unit-test targets (testing libs are already in `devDependencies`).
- **L4.** `firebase-tools` as a devDependency of the web app bloats installs; usually installed globally/CI-only.
- **L5.** Duplicated business constants: prices in three places, plan IDs hardcoded in both frontend and webhook (`functions/index.js:99-105` says "should match what you've set up in PayPal").
- **L6.** `README.md` is minimal; no setup, deploy, or environment documentation; `firestore.indexes.json` defines indexes for queries the client can never run (audit reads are denied per H1).
- **L7.** Anonymous audit design conflict: `logAuditEvent` writes `userId: 'anonymous'` for signed-out users, but rules require `request.auth != null` — anonymous logging can never work even after fixing H1. Consider Firebase Anonymous Auth if pre-signup audit matters.

---

## What's done well

- XML special-character escaping is applied consistently (`escapeXML`) — no injection into generated XML.
- Processing uploaded financial data entirely in the browser is a genuinely good privacy posture (files never leave the user's machine).
- The CRS v3.0 enum/code mappings and column auto-detection are thorough and well organized.
- Error states surface to the user rather than failing silently (in the UI layer, at least).
- Firestore user-isolation intent is right (owner-only access) — it's the *scope* of writable fields that's wrong, not the model.

---

## Prioritized remediation plan

| # | Action | Addresses |
|---|--------|-----------|
| 1 | Verify PayPal webhook signatures; delete the dead duplicate handler | C2, H5 |
| 2 | Lock down `users/{uid}` writes (field allowlist or server-only entitlements subdoc); move `role` to custom claims | C1, C3 |
| 3 | Fix audit rules (`request.resource.data`), or move audit writes server-side; add emulator tests | H1, L7 |
| 4 | Remove `.env` from git, rotate webhook ID, clean `.gitignore` | C6 |
| 5 | Build the actual subscription checkout (PayPal subscriptions), reconcile prices, grant plans only via verified webhook | C5 |
| 6 | Move quota enforcement server-side | C4 |
| 7 | Upgrade Node runtime, migrate off `functions.config()`, replace `xlsx` with a patched SheetJS build, chunk the monthly-reset batch | H4, H6 |
| 8 | Make the GDPR portal real; align retention policy (90d vs 7y) everywhere | H2, H3 |
| 9 | Add CSP/HSTS/Referrer-Policy headers on both hosts | H7 |
| 10 | Add unit tests for validation + XML generation; real XSD validation step; fix XML metadata issues | M2, M3, M4, L3 |

---

## Additions since the original audit


### A7. Cloud Functions have never been deployed, so quotas never reset
Deploying them fails with "Billing account for project is not open": Cloud
Functions require the Blaze plan and this project is on Spark. Since Blaze has
always been required, nothing in `functions/` has ever run.

The consequence that reached users: `resetMonthlyLimits` never ran, so
`conversionsUsed` never returned to zero. "3 conversions per month" has been
"3 conversions ever" for every account since launch, and any registered user
who spent theirs has been blocked ever since.

**Fixed without billing.** The reset is now performed by the client and
authorised by the rules: a client may zero its own counter exactly when the
stored `usagePeriod` is not the current month, and only by writing the current
month alongside. The month comes from `request.time` — the server's clock — so
asking early, asking twice, or claiming a future month is refused. Nine rules
tests cover those cases.

`usagePeriod` is deliberately absent from the owner-writable list, so it cannot
be written except through a reset; otherwise a client would write next month's
label and reset at will. That was a real hole in the first version of this rule
and the tests caught it.

Still not deployed, and no longer on the critical path:
- `cleanupAuditLogs` — replaceable with a native Firestore TTL policy, which is
  free. Nothing has accumulated yet because H1 meant nothing was ever written.
- `manualResetUser` — an admin convenience. Its old `role`-based check is now
  unexploitable anyway, because the rules refuse to write `role`.
- `paypalWebhook` — never live, which also means the Firebase-side webhook has
  never processed a payment event. The Vercel handler is the one to keep.

### A1. Firestore rules, indexes and functions were never deployed

> **Rules and indexes deployed to `crs-xml-converter-saas` on 27 July 2026**
> via `firebase deploy --only firestore:rules,firestore:indexes`. C1, C3 and H1
> are closed in production from that point, not merely in the repository.
> Cloud Functions are **not** yet deployed — scheduled cleanup and the admin
> callable still run their old code. Nothing user-facing depends on them.

Vercel deploys the web app and nothing else. `firestore.rules`,
`firestore.indexes.json` and `functions/` ship only via `firebase deploy`, which
nothing and nobody was running — so C1, C3 and H1 were fixed in the repository
while production kept the holes they closed, and the GDPR portal wrote to a
collection the deployed rules denied.

**Fixed:** `.github/workflows/firebase-deploy.yml` deploys them on any change to
those paths, after running the rules suite. It needs a `FIREBASE_SERVICE_ACCOUNT`
secret and a `FIREBASE_PROJECT_ID` variable; until those exist it stops with an
explanation rather than failing obscurely. **Someone still has to add them.**

### A2. The app had no CI
The tests existed and nothing ran them. Two deploys went red on lint errors a
local build could not catch, because `react-scripts build` aborts before linting
in this toolchain and the workaround (`DISABLE_ESLINT_PLUGIN=true`) skips exactly
the gating check.

**Fixed:** `.github/workflows/app.yml` runs the deploy's real lint, the unit
tests, a production build and the Firestore rules suite. `npm run verify` does
the same locally. `.eslintrc.ci.js` reproduces the deploy ruleset.

### A3. No filing lifecycle — the product could not do the job it exists for
A stateless converter cannot file a correction, a void or a nil return, and
every reporting FI needs all three. Corrections in particular are impossible
without remembering the DocRefId of the record being replaced.

**Fixed:** `src/crs/lifecycle.js`, `src/crs/refs.js` and `src/crs/ledger.js`
implement the four filing modes with the OECD correction rules — CorrDocRefId
referencing the latest version, ReportingFI resent as OECD0 under its original
DocRefId, CorrMessageRefId never emitted, voided records not correctable,
duplicate filings refused. The ledger stores references and hashes only; rules
tests assert that customer data cannot be written into it.

### A4. Dividends were dropped from every return
The mapper derived its source column as `${type}_amount`, giving
`dividends_amount`, while the column mapping only ever produced
`dividend_amount`. Every dividend figure read as zero and vanished from the
file — under-reporting income to a tax authority with no error shown.

**Fixed**, with the source column and CRS code now listed together rather than
derived from each other.

### A5. Column matching could hand a header to the wrong field
Substring containment was tested in both directions, so a longer field name
swallowed a shorter header: a `controlling_person_address` column was claimed by
`controlling_person_address_country`, and a street address was then validated as
a country code.

**Fixed:** three passes — exact, punctuation-insensitive, then containment
against the canonical field name only — each claiming its header so one column
feeds one field, with an ambiguous match reported as a missing column rather
than guessed.

### A6. The promised template did not exist
Documentation told filers to "download our sample template" since launch and no
such download existed; the sample data structure shown in the docs used columns
the converter does not read and would have been rejected on upload.

**Fixed:** template and field guide generated from the converter's own field
list, with tests asserting they round-trip through the real mapper under both
schema versions.
