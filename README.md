# CRS XML Converter

Prepares OECD Common Reporting Standard returns from a spreadsheet, in the
browser, and keeps the record of what was filed so the next correction can
reference it.

Built by [Evologics Ltd](mailto:contacts@evologics.ai).

---

## What it does

**Converts.** Excel or CSV in, CRS XML out. Schema **v2.0** (what Mauritius,
Cayman, Ireland and Singapore accept today) or **v3.0** (the amended CRS
schema, reporting year 2026 onward). Individuals, organisations, controlling
persons, all four payment types, joint accounts.

**Files the whole lifecycle.** Not just a first return:

| Mode | Emits |
|---|---|
| **New return** | `CRS701`, every record `OECD1`. |
| **Correction** | `CRS702`, `OECD2`, `CorrDocRefId` naming the record replaced. |
| **Void** | `CRS702`, `OECD3`. |
| **Nil return** | `CRS703`, institution record only, no upload needed. |

A correction is impossible without knowing the DocRefId of the record it
replaces, so the app keeps a filing ledger. Corrections chain: correcting a
correction references the correction, not the original.

**Refuses to invent data.** This is the principle the rest follows from. A
missing self-certification is reported as the OECD "not reported" sentinel,
never as `CRS901` ("a valid self-certification was obtained"). A value that is
present but unrecognised rejects the row rather than falling through to a
default. An ambiguous date — `03/04/1980`, which parses both ways — is rejected
rather than guessed at. Every row left out of the file is listed with its
reason, and every value written on the filer's behalf is named.

**Keeps customer data in the browser.** Spreadsheets are parsed client-side and
never uploaded. The ledger stores references and hashes only — DocRefIds,
`OECD` indicators, and a SHA-256 of each account number scoped to the
institution and period. No account numbers, names, balances, TINs, addresses or
dates of birth reach the server, and the security rules use `hasOnly()` so an
extra field cannot arrive even by accident.

## What it does not do

Stated plainly, because a compliance tool that overstates itself is worse than
one that does less.

- **No XSD validation.** The OECD schemas are not bundled and the browser
  cannot fetch them, so the audit trail records `xmlValidation: NOT_PERFORMED`.
  Validate against the schema, or your authority's published sample, before you
  submit. Output from this tool has not yet been through a real portal.
- **No UK filing.** HMRC uses its own combined FATCA/CDOT/CRS schema, not OECD
  CRS. A UK filer cannot use this.
- **No payments.** Plans are defined in `PRICING_PLANS` and nothing charges for
  them. Quotas are enforced client-side; the security rules stop a user
  resetting their counter or raising their limit, but a tampered client can
  still decline to increment it.
- **No CRS Status Message handling.** Authority error files must be read by
  hand.

See `AUDIT.md` for the full findings list with current status, and `CONCEPT.md`
for the strategic assessment this was built against.

---

## Running it

```bash
npm ci
npm start              # http://localhost:3000
```

Environment variables — move these into your host's settings rather than
committing them:

```
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
REACT_APP_FIREBASE_MEASUREMENT_ID=
REACT_APP_PAYPAL_CLIENT_ID=

# Optional: error monitoring. Off when unset.
REACT_APP_SENTRY_DSN=
REACT_APP_SENTRY_ENVIRONMENT=   # e.g. production, preview; defaults to NODE_ENV
```

**Error monitoring (Sentry).** Create a Sentry project (platform: React). Set
`REACT_APP_SENTRY_DSN` in Vercel for Production and Preview, then redeploy:
`REACT_APP_*` values are fixed at build time. In the Sentry project's security
settings, turn on **Prevent Storing of IP Addresses**. The client sends no IP,
but Sentry otherwise records the one a report arrives from. `src/monitoring.js`
scrubs every event before it leaves the browser:
- user, extra data, headers and query strings are removed;
- quoted values, digit runs and email addresses are redacted from messages;
- every breadcrumb except page navigation is dropped.

Refused rows are not reported, because they are the filer's to fix. Database
refusals and programming errors are reported.

The filing ledger needs Web Crypto, which browsers expose only over HTTPS or on
`localhost`. Conversion itself works anywhere.

## Verifying a change

```bash
npm run verify          # lint exactly as the deploy does, then tests, then build
npm run lint:ci         # just the lint gate
npm test                # watch mode
npm run test:e2e        # browser tests against the production build (build first)
```

`npm run test:e2e` drives the built app in Chromium (`e2e/`, Playwright). It
serves the build with the production headers from `vercel.json`, CSP included,
and covers:
- the filing flows end to end, with v3.0 output validated against the
  official XSD (needs `xmllint`);
- WCAG 2.2 AA via axe on every route;
- the security headers, and that the CSP blocks injected scripts;
- no horizontal scroll at 390, 768 and 1280px;
- a 5,000-account performance budget.

CI runs it on every push. Where a browser is already installed, point at it
with `CHROMIUM_PATH=/path/to/chrome`.

`npm run verify` exists because a plain `react-scripts build` **cannot** lint in
this toolchain — the repo's ESLint config extends `react-app/jest` and the
installed `eslint-plugin-jest` fails to register its environment, so the build
aborts before linting anything. Building with `DISABLE_ESLINT_PLUGIN=true` hides
exactly the check that gates the deploy, and did, twice. `.eslintrc.ci.js` drops
only the jest half.

Security rules run against the Firestore emulator (needs a JDK):

```bash
cd firestore-tests && npm install && npm test
```

## Deploying

**Two targets, and forgetting the second is a security problem.**

| What | How | Automatic? |
|---|---|---|
| Web app | Vercel, on push to `main` | yes |
| Firestore rules, indexes, Cloud Functions | `firebase deploy` | via `.github/workflows/firebase-deploy.yml` |

Vercel does **not** deploy `firestore.rules`. Rules fixes sitting in the
repository do nothing for production. The workflow closes that and needs
one-time setup:

1. Create a service account with **Firebase Rules Admin**, **Cloud Datastore
   Index Admin**, **Cloud Functions Admin** and **Service Account User**.
2. Add its JSON key as the repository secret `FIREBASE_SERVICE_ACCOUNT`.
3. Add your project id as the repository variable `FIREBASE_PROJECT_ID`.

It runs the rules tests before deploying, never after: a rule that denies a
write the app depends on takes the product down silently.

Manually, if you prefer:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Granting an admin — admin is a signed custom claim, not a writable field:

```bash
node functions/scripts/set-admin-claim.js someone@example.com
```

---

## Layout

```
src/
  crs/
    lifecycle.js        filing modes, DocTypeIndic/CorrDocRefId rules, ledger index
    refs.js             DocRefId and MessageRefId minting
    ledger.js           Firestore persistence for filings and their records
  components/
    CRSXMLConverter.js  code tables, validation, mapping, XML generation, auth, UI
  pages/                privacy, terms, documentation, cookies, GDPR requests
firestore.rules         access control, tested in firestore-tests/
functions/              scheduled jobs, admin callable, PayPal webhook (not wired)
platform/               a separate, stricter TypeScript implementation — see below
```

`CRSXMLConverter.js` is far too large and should be split; new work goes in
`src/crs/` for that reason.

### `platform/`

A ground-up TypeScript rebuild — branded types, `Result`, jurisdiction rule
packs, real XSD validation via libxml2-wasm, its own CI. It is where the
architecture is right; the live app is where the users are, and has been
catching up to it. Not deployed.

---

## Working on the CRS format

Two rules cause most of the mistakes:

1. **`CorrDocRefId` references the latest version of a record**, not the
   original. Correcting a correction points at the correction.
2. **A correction's parent `ReportingFI` is resent as `OECD0` under its
   original DocRefId.** A fresh DocRefId makes it a different institution
   record and orphans every correction hanging off it.

Both are encoded in `src/crs/lifecycle.js` with the reasoning in comments, and
asserted in `src/crs/lifecycle.test.js` and `src/crs/filing.test.js`.
`CorrMessageRefId` is never emitted — CRS forbids it.

## Support

<contacts@evologics.ai>
