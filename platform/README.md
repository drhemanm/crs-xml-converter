# CRS filing platform

A CRS/AEOI **filing system of record** — not a converter.

Conversion is the easy part and governments sometimes give it away free. The
hard, valuable parts are validating against jurisdiction rules *before* you
file, managing the correction lifecycle across reporting years, and being able
to prove what you filed and when. Those require state, and state is what a
stateless "Excel → XML" tool structurally cannot provide.

See [`../CONCEPT.md`](../CONCEPT.md) for the strategic assessment this
implementation follows from, and [`../AUDIT.md`](../AUDIT.md) for the defects in
the legacy application it replaces.

## Status

Working end to end: 100 unit/integration tests plus 11 browser tests covering
every filing mode — new information, correction, void, nil return — including
the paths that must fail. Not production-ready; see
[Before production](#before-production).

## Why it is built this way

Four decisions drive everything else.

**1. Missing data is never a plausible default.** Every optional regulatory
attribute is `Reported<T>` — known, or explicitly not reported. There is no
third state. The legacy application defaulted a missing self-certification to
`CRS901` ("a valid self-certification was obtained"), so an institution
uploading a spreadsheet without that column filed an attestation for every
account it may never have held. Here, a missing value is either the
period-appropriate "not reported" sentinel or a hard error.

**2. Placeholders are unconstructible.** `Iso3166Alpha2` cannot be built from
`"XX"`. Ambiguous dates like `03/04/2025` are rejected rather than guessed as
day-first or month-first. The type system, not developer discipline, prevents
placeholder data reaching a tax authority.

**3. Schema validity is necessary and nowhere near sufficient.** None of the
rules that actually get files rejected are expressible in XSD — global DocRefId
uniqueness "in space and time", correction-chain ordering, the new-vs-corrections
no-mixing rule, test/production segregation. XSD checks shape; the rules engine
checks lawfulness; the ledger checks history.

**4. Nothing claims to have been validated unless it was.** If the OECD schemas
are not installed, `SchemaValidator` returns `available: false` and the CLI
prints "not schema-validated". There is no code path that reports success
without validating.

## Layout

```
packages/
  core/           Domain. Zero I/O, zero framework. Pure and exhaustively tested.
    brand.ts        Branded primitives with smart constructors
    model.ts        Canonical, schema-neutral record model
    xml.ts          Typed XML tree + deterministic serializer
    ledger.ts       Filing ledger: DocRefId chains, lifecycle states
    lifecycle.ts    New filings, corrections, voids, nil returns
    refid.ts        Reference-ID allocation against jurisdiction specs
    status.ts       Authority Status Message parsing and reconciliation
    emit/           v2.0 and v3.0 emitters
  jurisdictions/  Declarative per-jurisdiction packs (MU, KY, SG, IE, GB)
  ingest/         Spreadsheet → canonical records, with cell-level provenance
  validate/       XSD validation via libxml2-wasm (browser and Node, same path)
apps/
  cli/            End-to-end reference implementation
  web/            React + Vite front end over the same packages
```

Both apps are thin. All domain logic lives in `packages/`, which is why the CLI
and the browser produce byte-identical output from the same input.

The core returns `LedgerMutation`s rather than writing anything, so planning is
testable without a database and mutations are persisted only once a filing is
actually produced.

## The correction lifecycle

This is the part worth understanding, because it is where filers get hurt and
what makes the product defensible.

- `CorrDocRefId` must reference the **latest** version of a record. A second
  correction points at the *first correction*, not the original (CTS 80003).
- Correcting an account requires **resending its parent `ReportingFI` as OECD0
  carrying the DocRefId the authority accepted** (CTS 80013). Regenerating it
  bounces the entire file.
- Deleting a `ReportingFI` **does not cascade** — every live child must be
  voided explicitly (CTS 80009).
- A record the authority **rejected** never existed to it, so it is resubmitted
  as `OECD1` new data, not corrected (CTS 80002).
- A message is all-new or all-corrections, **never both** (CTS 80010).
- `CorrMessageRefId` is **forbidden in CRS** entirely (CTS 80006/80007).
- A correction **replaces the whole record**, so unchanged fields must be
  reproduced exactly. Rebuilding one from a fresh export silently files every
  intervening data drift as an authorised amendment — a reporting-accuracy
  failure invisible to every validator.

Each rule is enforced in `lifecycle.ts` and annotated with the OECD CTS error
code it prevents.

All of the above are **verified against the OECD *Amended Common Reporting Standard XML Schema: User Guide for Tax Administrations*, October 2024**, which states them
directly — including that `CorrDocRefID` "must always refer to the latest
reference of this Account-report (DocRefID) that was sent", that "a series of
corrections … each correction completely replaces the previous version", that
`OECD0` is "only to be used for resending the Reporting FI element", and that
`CorrMessageRefID` "is not used for CRS at the DocSpec level".

### Transitional sentinels are a jurisdiction decision

The guide describes `CRS900` / `CRS1000` / `CRS1100` / `CRS1200` / `CRS800` as
"available as a transitional measure, in order to facilitate interoperability
with the previous version of the schema, particularly in respect of
corrections" — and sets **no cut-off date**. Some authorities do: HMRC rejects
them for reporting periods after 2025-12-31.

So `sentinelsPermitted` lives on the jurisdiction pack, not in the core. An
earlier version of this code applied the HMRC cut-off universally, which would
have blocked legitimate corrections of older periods in every other
jurisdiction.

## Try it

```bash
pnpm install
pnpm test:all      # typecheck + unit/integration + browser end-to-end

# What columns does it accept?
pnpm cli fields
pnpm cli template --out accounts.csv

# File a return. Mauritius takes v2.0 for a 2025 period filed in 2026.
pnpm cli file examples/accounts.csv \
  --jurisdiction MU --fi-name "Banque X" --fi-id MU10203040 --fi-city "Port Louis" \
  --period 2025-12-31

pnpm cli ledger          # records are 'pending' until the authority responds
pnpm cli status resp.xml # apply the authority's Status Message
pnpm cli correct fixed.csv --jurisdiction MU --fi-name "Banque X" --fi-id MU10203040
```

The correction command derives `CorrDocRefId` from the ledger. Nobody types a
200-character identifier.

For the web app:

```bash
pnpm --filter @crs/web dev
```

Account data never leaves the browser, and that is verifiable rather than
asserted: a CSP with `connect-src 'self'` blocks any other origin, and a
headless run driving upload through generation records zero external requests.
Open the network panel and check.

## Jurisdiction packs

Packs carry per-rule `verification` metadata — `verified`, `secondary` or
`unverified` — because a compliance product that cannot say which of its own
rules are confirmed against a primary source has the same credibility problem as
one claiming "100% compliant" without validating anything.

`pnpm cli jurisdictions` prints the confidence breakdown.

`schemaFor()` takes both the reporting period **and the filing date**, because
the UK and Ireland require the amended schema from 1 January 2027 for all
submissions *including corrections relating to previous calendar years*.

The UK is modelled as `uk-combined` with **no emitter**. HMRC requires its own
combined FATCA/CDOT/CRS schema, which we have not read. Failing loudly is
correct; emitting a guessed shape would be worse.

## Before production

1. **Vendor the OECD XSDs** into `packages/schema` (published as a ZIP on the
   OECD Tax Transparency Resource Centre). Confirm the OECD's terms of use for
   redistribution. Until then nothing is schema-validated.
2. **Verify the rules marked `secondary` / `unverified`** in the jurisdiction
   packs against primary sources. The OECD-level rules are now verified against
   the User Guide (see below); the outstanding ones are jurisdiction-specific. Start with `mra.mu/download/CRSFAQ.pdf` — the
   home market — and validate output against MRA's published `Sample-Valid.xml`.
3. **Add golden-file tests** against the OECD's published sample instance
   documents once the schemas are available.
5. **XLSX ingestion.** Only CSV is wired up (`pnpm cli template` generates a
   conforming file, and a test asserts it round-trips). `xlsx@0.18.5` has known
   CVEs and is unmaintained on npm — use a patched SheetJS build or a vetted
   alternative.
5. **Replace the in-memory ledger** with a database, and implement the
   client-side-encrypted payload vault described in `CONCEPT.md` §6.1.
