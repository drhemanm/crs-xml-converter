# Is the concept right? — Strategic and architectural assessment

**Date:** 2026-07-26
**Question asked:** Is the concept sound, and can we build a proper platform that meets OECD (and FATF) expectations without looking vibe-coded?

**Short answer:** The *problem* is real and well-timed. The *product framing* is wrong. "Excel → CRS XML converter" is a feature, not a company — and as currently scoped it cannot complete a filing lifecycle even in principle. There is a genuinely defensible product adjacent to it, and an unusually good 12-month window to build it. But it requires reframing from **converter** to **filing system of record**.

> **Research caveat.** Direct web fetches to authoritative sites (oecd.org, gov.uk, revenue.ie, ditc.ky) were blocked by this environment's egress policy, and the session's search budget was exhausted. Findings below are drawn from search-result summaries of primary documents plus direct verification against this repository. Items are marked **[VERIFIED]**, **[SECONDARY]** (consistent across independent sources but not read from the primary PDF), or **[UNVERIFIED]**.
>
> **Update:** the OECD *Amended CRS XML Schema: User Guide for Tax Administrations* (October 2024) has since been read directly. Every OECD-level rule below — namespaces, DocSpec semantics, the correction chain, reference-id formats, the enumerations, nil-return structure — is confirmed by it, with one correction: the transitional sentinels carry **no OECD cut-off date** (see §2.5). Jurisdiction-specific claims remain SECONDARY/UNVERIFIED.

---

## 1. What's genuinely right about the concept

- **The obligation is real, recurring, and painful.** ~120 jurisdictions run CRS/AEOI. Every reporting FI — banks, trust companies, fund administrators, insurers — must file annually or face penalties.
- **The low end is real and named.** Australia's tax authority defined it explicitly: its free tool serves filers with ≤50 individual and ≤50 organisation accounts. That segment exists as a recognised category.
- **Browser-only processing is a genuine strategic asset.** Processing financial PII entirely client-side, so it never reaches the vendor, is an excellent answer to the biggest go-to-market barrier in this market (vendor due diligence). It is currently an accident of implementation rather than a positioning decision — it should become the centrepiece. See §6.
- **A mandatory global re-tooling is landing right now.** CRS XML Schema v3.0 obsoletes existing pipelines on a fixed date. Every filer must change tools in the same cycle. That is the best possible moment to enter. [SECONDARY]

---

## 2. Three concept-level problems (these are not bugs)

### 2.1 The product targets a schema version that is not yet accepted — and drops the one that is

The app emits CRS v3.0 exclusively (`version="3.0"` hardcoded, `CRSXMLConverter.js:1809`). The actual adoption timeline: **[SECONDARY]**

| Jurisdiction | 2026 filing season (RY2025) | v3.0 mandatory from |
|---|---|---|
| **Mauritius (MRA)** — home market | **v2.0** (MRA: *"CRS User Guide Version 3.0 and CRS XML Schema Version 2.0 are applicable"*), due **31 Jul 2026** | not yet stated by MRA |
| Cayman (DITC) | **v2.0**, due 31 Jul 2026 | RY2026, due 30 Jun 2027 |
| Ireland (ROS) | **v2.0**, due 30 Jun 2026 | 1 Jan 2027 |
| Singapore (IRAS) | **v2.0**, due 31 May 2026 | 1 Jan 2027 |
| UK (HMRC) | **HMRC's own combined FATCA/CDOT/CRS schema** — not OECD CRS at all — due 31 May 2026 | 1 Jan 2027 |

So in the current filing season the product generates output that **no** jurisdiction above accepts: too new for Mauritius, Cayman, Ireland and Singapore; wrong schema family entirely for the UK. First reporting under v3.0 is reporting year 2026, filed in 2027.

**The product would most likely be rejected by its own home regulator.** MRA mandates OECD schema v2.0 and publishes a conformance target at `eservices13.mra.mu/crsreporting/Sample-Valid.xml`; MRA also permits **exactly one consolidated file per FI per reporting year**, covering all reportable jurisdictions — so a converter must aggregate, never split per jurisdiction. The RY2025 deadline of 31 July 2026 is **five days from today**. [SECONDARY — verify the deadline and MRA's v3.0 stance directly at `mra.mu/download/CRSFAQ.pdf`]

One genuinely encouraging home-market data point: MRA reportedly states it **will not provide an XML conversion tool**, leaving that responsibility to FIs. If true, Mauritius has no free government substitute — which is the core of the commercial case and the **single highest-value fact to verify**. [UNVERIFIED]

Two further traps:

- **Both UK and Ireland state the new schema applies from 1 Jan 2027 *including to corrections for earlier years*.** A tool therefore needs v2.0 *and* v3.0 emitters with a date-driven switch — permanently, not as a one-off migration. The OECD's User Guide v4.0 reportedly contains transitional guidance for corrections filed in v3.0 against records originally submitted in v2.0. **That guidance was not readable in this environment and is the single most important document to obtain before building.** [SECONDARY]
- **HMRC's portal accepts only ISO-8859-1 characters.** The app emits UTF-8 and does no character-set restriction. Any non-Latin-1 character in a customer name would fail. [VERIFIED]

### 2.2 A stateless converter is structurally a first-filing-only product

This is the deepest problem, and it is not fixable by better code — it is a missing product dimension.

CRS reference-ID rules. The length limits and the MessageRefId structure below were **[VERIFIED]** by reading the actual OECD XSDs; the lifecycle semantics are **[SECONDARY]** (consistent across every source found, but not read in the primary PDF):

- `MessageRefId` — type `stf:StringMin1Max170_Type`, **max 170 characters** [VERIFIED]. Structure per the OECD-family schema annotation: *"must start with the country code of the sending jurisdiction, then the year of the reportable period, then the receiving country code before a unique identifier."* [VERIFIED]
- `DocRefId` — type `stf:StringMin1Max200_Type`, **max 200 characters** [VERIFIED]. Conventionally prefixed with the sending jurisdiction's ISO-3166 alpha-2 code.
- Both must be unique **"in space and time"** — globally and perpetually, **not per-year**. Any per-year reset is non-compliant. Re-emitting a used `DocRefId` is an explicit hard-rejection condition.
- A correction or deletion carries a **new** unique `DocRefId`, and references the record being corrected via `CorrDocRefId`.
- `CorrDocRefId` must reference the **latest** `DocRefId` sent for that record. A *second* correction references the first correction's DocRefId, not the original — this is what establishes the order in which the receiving authority applies changes.
- `CorrMessageRefId` exists in the schema but is **not used for CRS corrections**. To cancel a message you send a correction message deleting its records — not a message-level cancellation.
- A record is only a valid correction target once the authority has **accepted** it, communicated back via the OECD's separate **CRS Status Message XML Schema**.
- **Messages may not mix new and corrected data.** `MessageTypeIndic` is CRS701 (new), CRS702 (corrections/deletions) or CRS703 (nil return), and a single message must be wholly one kind.
- `DocTypeIndic`: OECD0 (resend ReportingFI), OECD1 (new), OECD2 (corrected), OECD3 (deletion) — plus **OECD10–OECD13 as the test-environment counterparts**. Submitting OECD1x values to production is a named file-level error, and vice versa. A product must never let a test indicator escape into a live filing.

Jurisdictions **narrow** these limits and formats rather than adopting them verbatim: Singapore requires `DocRefId` to begin with the filer's Singapore tax reference (UEN) and caps files at 5 MB; France's DAC7 schema narrows the 170-character MessageRefId to 88. So the limits must be per-jurisdiction configuration, not constants.

Four further mechanics, **[VERIFIED]** against the OECD CTS error-code catalogue and HMRC's live business rules, that a naive implementation gets wrong:

- **Correcting a child requires resending its parent.** To correct an `AccountReport` you must re-transmit the `ReportingFI` in the same message with `DocTypeIndic = OECD0` carrying **the exact DocRefId it had when originally accepted** — a deliberate, documented exception to global uniqueness. Regenerating that ID bounces the *entire file* (CTS 80013 / HMRC 31), not just one record.
- **Deleting a ReportingFI does not cascade.** You must explicitly emit an `OECD3` deletion for **every** live child AccountReport, each with its own new DocRefId and CorrDocRefId (CTS 80009; HMRC 26: *"You can only delete the ReportingFI if you also delete all of the AccountReport sections for this reporting period."*). This is impossible without an inventory of live children.
- **`CorrMessageRefId` is forbidden in CRS** — in both the message header and DocSpec (CTS 80006/80007; HMRC 14/33). There is no "correct a message" operation, only per-record corrections keyed on DocRefId.
- **Record-level rejections are resubmitted as new data, not corrections.** If a file is *accepted* but individual records are rejected, those records never existed to the receiver — sending `OECD2` for them fails with "CorrDocRefId refers to an unknown record" (CTS 80002). They must go back as `OECD1`. Telling the two cases apart requires the `DocRefIDInError` list from the authority's Status Message, which the current product neither requests nor stores.

**And the subtlest trap: a correction replaces the entire record.** An `OECD2` AccountReport must be a complete, schema-valid AccountReport — there is no field-level amendment. So every unchanged value must be re-transmitted **byte-for-byte identical**. Regenerate a correction from a freshly-exported spreadsheet and every field that drifted in the interim — a tidied address, a re-keyed name, a recalculated balance — is filed as a deliberate amendment the institution never authorised. It passes every XSD check and every business rule. It is a reporting-accuracy failure that is invisible to validation and can only be prevented by storing what was actually sent.

What this repository does (`CRSXMLConverter.js:1557-1565`):

```js
const generateUniqueRefId = (prefix = 'MU2024MU') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return prefix + timestamp + random;
};
```

Random IDs, generated at download time, **persisted nowhere**. `DocTypeIndic` is hardcoded `OECD1` (new data) at `:1751` and `:1833`; `MessageTypeIndic` is hardcoded `CRS701` (new information) at `:1818`. The `CRS_MESSAGE_TYPE_INDIC` map defining CRS702 and CRS703 is declared and exported at `:220` but **never used anywhere**.

Both identifiers are also malformed on their face:

- `DocRefId` = `"DOC" + base36 + random`. It must start with the sending jurisdiction's country code — and `"DO"` happens to be the ISO code for the **Dominican Republic**. It also fails Singapore's UEN-prefix rule outright.
- `MessageRefId` = `` `CRS_${Date.now()}` `` (`:2985`, and the field is `readOnly` in the UI at `:3425`). No country code, no reporting year, no receiving country — it satisfies none of the verified structural requirements.

**Consequence: a user who files with this tool and gets records rejected can never correct them using this tool.** There is no `CorrDocRefId`, no stored `DocRefId`, no uniqueness ledger, no void path, and **no nil return** — which several jurisdictions require an FI to file even with zero reportable accounts. Corrections, voids and nil returns are not missing features — they are most of the filing lifecycle, and the architecture forecloses them.

This cuts both ways, though: **it is also the strongest available moat.** Remembering last year's DocRefIds is what turns a disposable tool into a system of record with real switching costs. A competitor can clone the converter in a weekend; they cannot clone three years of a customer's filing history.

### 2.3 The pricing metric doesn't match how the obligation behaves

CRS filing is **annual, bursty and deadline-driven**. An FI files once a year — typically 3–5 attempts (test, fix, final) in one week — then nothing for eleven months. Deadlines cluster: 31 May (UK), 30 June (Ireland), 31 July (Cayman).

The plans sold are "100 conversions/month" ($79) and "1,000 conversions/month" ($299). **Nobody converts 100 times a month.** The unit is meaningless to the buyer, and the quota is simultaneously absurdly generous annually and irrelevant monthly.

On level as well as metric: the one hard competitor price point found is **Trans-World Compliance's CRS/FATCA One from $1,500/yr** [SECONDARY]. The Enterprise tier at $299/mo is **$3,588/yr — roughly 2.4× the entry price of a more established, jurisdiction-proven product.**

Natural units here: **per filing, per reporting entity, or an annual seat**, sold against the filing season.

---

### 2.4 "One generic OECD XML" is not a viable output — but the divergent surface is narrow

Jurisdictions sit on a three-tier gradient: **[SECONDARY]**

- **Tier A — plain OECD CRS accepted.** Mauritius consumes standard OECD v2.0 with no wrapper.
- **Tier B — OECD schema, hard-validated jurisdiction constraints on the same elements.** Cayman requires `ReceivingCountry` to be exactly `"KY"` *regardless of the entity's residence*, and errors on anything else. Singapore requires the UEN-prefixed `DocRefId` and a 5 MB cap. Australia validates country code + reporting year inside both reference IDs.
- **Tier C — a different schema entirely.** The UK's combined FATCA/CDOT/CRS report. A generic OECD-CRS-only converter **cannot file in the UK at all**.

The good news is that the divergence is concentrated. The `AccountReport` payload — names, addresses, TINs, balances, payments — is OECD-defined and roughly **90–95% identical everywhere**. Nearly all variation lives in ~6 header/identifier fields plus transport: reference-ID formats, `ReceivingCountry`, the FI identifier type (GIIN vs local TIN/UEN/TAN), schema family and version by reporting year, one-file-vs-split, and size caps.

That is a **thin, declarative jurisdiction profile** — buildable and maintainable. It is exactly what the incumbents sell, and it is the thing that must be *maintained annually*, which is why it is the moat rather than the converter.

**A concrete instance of getting this wrong.** `CRSXMLConverter.js:1814-1815` binds both `TransmittingCountry` and `ReceivingCountry` to `reportingFI.country` — the FI's **country of residence**. The correct driver is the **filing jurisdiction**. These coincide for a domestic Mauritian FI, so the code is *coincidentally* right at home and breaks precisely on the case Cayman calls out. Worse, that single country dropdown is silently overloading three independent concepts. They must be modelled separately and never derived from one another:

1. `filingJurisdiction` → `TransmittingCountry`, `ReceivingCountry`
2. `fiResidence` → `ReportingFI/ResCountryCode`
3. per-account reportable jurisdiction → `ResCountryCode` inside each `AccountReport`

Relatedly, the code uses the **GIIN** as the CRS identifier in `SendingCompanyIN` and `ReportingFI/IN`. GIIN is a *FATCA* identifier; Singapore requires the local tax reference and Mauritius operates on TAN. Identifier type belongs in the jurisdiction profile.

### 2.5 The most dangerous defect in the codebase: fabricated regulatory attestations

This one outranks every security finding in `AUDIT.md`, because it silently misrepresents facts to a tax authority and nothing in the system would ever flag it.

When a source column is absent, the mapper does not fail and does not mark the value unknown — it **invents a compliant-looking answer** (`CRSXMLConverter.js:1346-1351`, `:1396`, `:1419-1422`):

| Element | Default when data is missing | What that asserts |
|---|---|---|
| `SelfCert` | **`CRS901`** | *"A valid self-certification was obtained."* |
| `DDProcedure` | `CRS1202` | "Pre-existing account" |
| `AccountType` | `CRS1101` | "Depository account" |
| `AcctHolderType` | `CRS102` | "CRS Reportable Person" |
| `CtrlgPersonType` | `CRS801` | "Controlling person by ownership" |
| `ControllingPerson/SelfCert` | `CRS1001` | *"Controlling person self-certification obtained."* |

The self-certification defaults are the serious ones. Self-certification is the cornerstone due-diligence obligation under CRS — whether the FI actually obtained a signed declaration of tax residence. **An FI that uploads a spreadsheet without a `self_cert` column will file a return asserting, for every single account, that it holds a valid self-certification.** If it does not, the institution has made a false statement to its regulator, generated by a tool that told it the output was "100% compliant."

What makes this worse than a bug is that the schema *provides the honest answer and the code ignores it*. CRS v3.0 defines "not reported" sentinels — `CRS900`, `CRS1000`, `CRS1100`, `CRS1200`, `CRS800` — for exactly this situation. They are declared in this codebase (`:206-217`, `:172-217`) and **never used**. Their availability is what lets a v3.0 correction be filed against a 2023 record at all. **[Now VERIFIED against the OECD User Guide v4.0, October 2024]**, each is "available as a transitional measure, in order to facilitate interoperability with the previous version of the schema, particularly in respect of corrections" — with **no cut-off date at OECD level**. Individual authorities impose their own: HMRC rejects them for reporting periods after 2025-12-31. That makes sentinel availability a *jurisdiction* rule, not a universal one, and an emitter that hardcodes either answer will be wrong somewhere.

**Rule for the rebuild: missing data is a hard stop or an explicit "not reported" sentinel, chosen by reporting period. Never a plausible default.** The same principle kills the `"Not Provided"` street/city and `"XX"` country-code substitutions (`:1587-1590`).

---

## 3. On FATF — this is a category error, and it will cost credibility

Stating it plainly, because the question specifically raised OECD *and* FATF:

- **FATF** (Financial Action Task Force) sets **AML/CFT** standards — customer due diligence, beneficial ownership, suspicious activity reporting, record-keeping. It issues Recommendations to *countries*, which implement them in national law binding on FIs.
- **OECD CRS/AEOI** is a **tax transparency** regime — automatic exchange of financial account information between tax authorities.

They are different bodies, different obligations, different regulators, different filings. **There is no such thing as a "FATF compliant" XML converter.** A software product cannot be compliant with FATF any more than it can be compliant with the G20.

Marketing a tax-reporting tool as "FATF compliant" would read to any MLRO or compliance officer as a vendor who does not understand the regimes — exactly the audience whose trust the product needs. Given the app already plasters "100% CRS v3.0 XSD Compliant" across ~40 UI strings without performing any schema validation, adding an unearned FATF claim would compound an existing credibility problem.

Four reasons, in the order a compliance officer will think of them:

1. **FATF operates no certification scheme for anything.** It issues Recommendations to *countries* and assesses *countries* through mutual evaluations. There is no FATF certificate, accreditation or approval for a company or a product. The claim is unfalsifiable by construction, and a practitioner knows that on sight.
2. **Even regulated firms don't use the phrase.** They say they comply with the MLR 2017 / AMLR / FIAMLA / the relevant MAS Notice — the *national law* implementing FATF standards. A vendor saying "FATF compliant" is using vocabulary no practitioner uses, which is itself the tell.
3. **It advertises exactly the confusion you're trying to avoid** — attaching AML branding to an OECD tax deliverable, in front of a buyer whose job is keeping those regimes straight.
4. **It creates a diligence question with no answer.** "Compliant with which Recommendation, assessed by whom, evidenced how?" You end up strictly worse off than having claimed nothing.

**Where the regimes genuinely touch** — and these are worth getting right, because they have product consequences:

- **The CRS Commentary explicitly requires "Controlling Persons" to be interpreted consistently with the FATF Recommendations** — but pinned to the text **as adopted in February 2012**. FATF has since revised R.24 (March 2022) and issued new R.25 guidance (2023). Those revisions do **not** flow into CRS. Divergence between a firm's current AML beneficial-ownership register and its CRS controlling-person determination is therefore *structural, not an error*. [SECONDARY]
- **Never hard-code a 25% threshold.** CRS sets no threshold of its own — it inherits the domestic AML threshold. FATF's 2022 revision reframed 25% as a **maximum**, and many jurisdictions use 10% or lower. It must be per-jurisdiction, per-tenant configuration; a hard-coded 25% is a defect a knowledgeable buyer finds during a demo. [SECONDARY]
- **CRS is mechanically broader than FATF for trusts.** Settlor, trustee, protector and beneficiaries must **always** be treated as Controlling Persons *regardless of whether any of them actually exercises control*. FATF R.25 is risk-based. There is no risk-based discretion to omit a CP under CRS. [SECONDARY]
- **Controlling-person reporting applies only to Passive NFEs** — an Active NFE has beneficial owners under AML but no Controlling Persons to report under CRS.
- **Tax crimes became FATF predicate offences in the February 2012 revision** — the genuine conceptual bridge. But note the limit: failing to comply with CRS is not itself money laundering, and a CRS return is not a suspicious activity report.
- **FATF Recommendation 11 requires ≥5 years' retention** of transaction and CDD records — and it **binds the FI, not the vendor**. The product's job is not to retain those records; it is to avoid being the reason the institution cannot. That means deterministic, reproducible output (same input + settings → same XML), no silent mutation of input values, and an exportable transformation log the FI can put in its own archive. [SECONDARY]

**Honest positioning** — every claim verifiable and falsifiable:

> "Generates OECD CRS XML validated against CRS XML Schema v3.0. Handles Controlling Person data consistent with the CRS definition, with a configurable ownership threshold per jurisdiction. Designed to fit inside your firm's record-keeping obligations under the national regulations implementing FATF Recommendation 11."

Never: *FATF compliant*, *FATF certified*, *FATF approved*, *FATF-aligned*.

**The same objection applies to the bare "GDPR Compliant Processing" badge** rendered at `CRSXMLConverter.js:2867` and listed as a plan feature at `:100`. GDPR has no general certification scheme in force. Replace the badge with a description of the architecture — which is genuinely the strongest asset here (§6.1).

This also exposes a live contradiction in the codebase: audit entries are stamped `retentionPeriod: '7_YEARS'` (`CRSXMLConverter.js:475`) while a scheduled function deletes them at **90 days** (`functions/index.js:284-333`), and the privacy policy promises uploaded files are "deleted within 24 hours" describing a **server-side architecture the product does not have** — files never leave the browser. Three different retention stories, none of them true.

---

## 4. The competitive reality

**The artefact has no moat.** The schema is public, the mapping is mechanical, and an LLM can write a passable converter in an afternoon. Worse:

- **Validation is already free.** A competitor (Novus Compliance) publishes a free FATCA/CRS XML validator as a lead magnet. Schema validation cannot be the paid feature. [SECONDARY]
- **Some governments give the whole product away.** Australia's ATO ships a free "Small Reporter Tool" — a macro spreadsheet that generates conformant CRS XML for filers under 50+50 accounts. Where a jurisdiction does this, the addressable market there is ~zero. [SECONDARY]
- **Portal web-forms eliminate the need entirely.** Regnology's Vizor platform — the *authority-side* portal in ~16 jurisdictions, with 100k+ FIs filing through it — supports data entry via web forms as well as XML upload. A filer with 12 accounts types them in and needs no converter at all. **Which jurisdictions expose web-form entry is the single most important unfinished piece of research; each one subtracts a market.** [SECONDARY]
- **A direct competitor is already on the same wedge.** Novus Compliance runs this exact playbook — Excel template in, OECD XML out, 100+ jurisdictions, free validator funnel, IRS transmitter registration, and a Cayman-DITC-specific landing page. [SECONDARY]
- **The real incumbent is the outsourcer.** Apex, JTC, MUFG Investor Services, Aztec, Charter Group and others already sell CRS filing as a bundled service to exactly this segment — Charter Group advertises "Excel (XLS or CSV) to XML conversion" as a service line. The buyer's administrator already does this for a marginal fee, **and carries the liability**. To become a customer, they must actively choose to take compliance risk back in-house. That is a hard sell at any price. [SECONDARY]

### The one time-sensitive opening

**The Cayman DITC is withdrawing its free CRS XML Generator Tool** as part of the v3.0 transition, reportedly unavailable after **31 July 2026**, with the DITC Portal closing in early August 2026 and reopening with v3.0 support in early 2027. It is telling FIs to "make the necessary arrangements to source a CRS XML Generator Tool." [SECONDARY — reported consistently by Mourant, Maples, Walkers]

That is a dated, named cohort in the world's largest investment-fund domicile losing a free tool **days from now**, who must select a replacement before the RY2026 filing. It is the best available wedge, and the window closes once they choose. It is also visible to every incumbent — Novus already has the landing page up.

---

## 5. What the product should actually be

Not a converter. A **filing-assurance system of record**, where defensibility lives in things that must be *maintained* rather than *written once*:

1. **Maintained jurisdiction rule packs.** Not the OECD schema (free) — the per-jurisdiction deviations: schema family and version by reporting year, DocRefId/MessageRefId conventions, TIN formats, character-set restrictions, national business rules, deadlines. This decays annually and must be re-earned. That is what makes it durable.
2. **The corrections and voids lifecycle, done properly.** DocTypeIndic OECD0–OECD3, DocRefId chains across years, Status Message ingestion. State across reporting years is the moat.
3. **Dual-schema emission** (v2.0 + v3.0 + UK combined) selected by jurisdiction × reporting year, with the transitional rules for correcting v2.0-era records in v3.0.
4. **Audit evidence** — immutable submission records, validation logs, sign-off trail. The buyer's real fear is a regulator, not a malformed file.
5. **Eventually: become the filer.** Transmitter/agent status is what closes the gap against the outsourcers.

CARF (Crypto-Asset Reporting Framework) is a natural adjacency — separate schema, published alongside CRS v3.0, first exchanges 2027, EU DAC8 collection from January 2026 — reachable once the ledger and rule-pack machinery exist. [SECONDARY]

---

## 6. Architecture — what "not vibe-coded" looks like

The single most damaging thing about the current build is not any individual defect; it is that **it asserts rigour it does not have**. "100% XSD Compliant" appears ~40 times and no XSD validation is ever performed; `xmlValidation: 'PASSED'` is a hardcoded string (`CRSXMLConverter.js:1926`). Real compliance products are sober. Every claim must be executed by code or deleted.

### 6.1 The privacy/statefulness tension, and how it resolves

Corrections require persistence. Persistence appears to require holding customer PII, which destroys the browser-only privacy story and triggers the vendor due-diligence barrier.

**A first attempt — "persist references, never payloads" — does not survive contact with the rules.** Storing only `MessageRefId`, the `DocRefId` chain, a keyed HMAC of the account number, the reporting period and the acknowledgement status is enough to compute `CorrDocRefId` and enforce uniqueness. But because **a correction is a full-record replacement** (§2.2), reconstructing an `OECD2` record from a freshly-exported spreadsheet silently files every intervening data drift as an authorised amendment. Correctness genuinely requires the **complete submitted payload, verbatim** — which is exactly the PII the privacy story depends on not holding.

**Resolution: split the store by readability, not by location.**

- **Plaintext on the server — the reference ledger.** `MessageRefId`; the `DocRefId` chain per record with supersession links and lifecycle state (pending / live / superseded-by / deleted / rejected); the parent `ReportingFI` DocRefId; reporting period; filing jurisdiction; schema family and version; and the parsed Status Message including every `DocRefIDInError`. **None of this is personal data** — they are opaque identifiers and status codes. It is enough to enforce global uniqueness, walk correction chains, build the `OECD0` parent resend, enumerate live children before a cascade delete, and route rejected records to the `OECD1` path.
- **Ciphertext on the server — the submitted-payload vault.** The verbatim record payloads, encrypted client-side under a tenant key that **never leaves the browser** (envelope encryption; the server stores only ciphertext and cannot decrypt it). This gives byte-exact correction replay and cross-device continuity without the vendor ever being able to read an account holder's name, TIN or balance.

Net position: the vendor holds no readable account-holder personal data, so the browser-only privacy claim survives intact — while the product gains the persistence the filing lifecycle actually requires. The trade-off is honest and must be stated plainly to customers: **lose the tenant key and prior payloads are unrecoverable**, so key escrow/export is a first-class feature, not an afterthought.

One genuinely good piece of news for implementation: the correction machinery is **identical between schema v2.0 and v3.0** — both import the same `oecdcrstypes_v5.0.xsd` (namespace `urn:oecd:ties:crsstf:v5`) defining `DocSpec_Type` and the `DocTypeIndic` enumeration. **[VERIFIED]** So the lifecycle engine is written once and shared across both emitters; only the payload shape differs.

**The legal argument, stated precisely.** A processor is one who processes personal data *"on behalf of"* a controller (GDPR Art 4(8)). EDPB Guidelines 07/2020 set **two cumulative conditions**: being a separate entity, *and* processing on the controller's behalf. If the code executes in the customer's browser and the vendor never receives, stores or can access account-holder data, the second limb fails — you are supplying a *product*, not performing a *processing operation*. This is the same reasoning that makes an on-premise software licensor not a processor of its licensees' data.

Be careful how this is presented: the two-condition test is verified, but its application to no-access software rests on practitioner consensus rather than a retrievable EDPB paragraph or CJEU holding. Present it to a bank's counsel as *the architecture plus the Art 4(8) reasoning*, not as settled doctrine, and let them agree. **[Confirm with counsel.]**

**Four caveats that actually decide it in practice:**

1. **Support channels break it first.** "Email us the file and we'll debug it" makes you a processor for that activity. This is how the architecture fails in reality — not in the code.
2. **Telemetry, error reporting and server logs.** IP addresses are personal data. But note *whose*: this is data about the FI's **staff**, not its customers — so you are a **controller in your own right** there, not a processor. You may say "we never receive your account-holder data"; you may **not** say "we process no personal data."
3. **Third-party embeds** (Firebase, Google Analytics) can create joint-controllership exposure with the site operator.
4. **Any server-side conversion, queue, or "save my report" feature flips you to processor immediately.** That constrains the roadmap — decide up front whether you accept it.

**Three things in the current code contradict the story and should be fixed before any demo:**

- `CRSXMLConverter.js:1881-1886` hardcodes `containsPII: true` and `processingLawfulBasis: 'LEGITIMATE_INTEREST'` into every audit record. The first **asserts your own logs contain PII**, directly contradicting the architecture you'd be selling. The second is simply wrong: the lawful basis for CRS reporting is the FI's **legal obligation** under Art 6(1)(c) — and it is the FI's to declare, not the vendor's. A sharp reviewer will screenshot this.
- `:1863` logs **raw filenames**, which routinely contain client names. Hash them.
- `PrivacyPolicy.js` declares the vendor a Data Controller and says nothing about the client-side architecture — while elsewhere claiming uploaded files are "deleted within 24 hours," describing a server-side system that doesn't exist.

**Why this matters commercially more than any certificate.** The realistic bar for selling to regulated FIs is SOC 2 Type II (~$25–60k and 6–12 months elapsed, because Type II requires an observation window) and/or ISO 27001 (~$20–50k, 4–9 months) — [estimates, unverified]. The client-side architecture changes the diligence question from *"prove your infrastructure is secure"* (expensive, needs certification) to *"prove the data never leaves"* (cheap, demonstrable). Make that proof concrete: a one-page architecture note, a strict CSP, subresource integrity, and a **customer-runnable network trace showing zero payload egress**. Many firms will drop you into a lighter diligence tier. Some will demand SOC 2 regardless — that's an unavoidable loss of some deals, not something to argue away. Build the evidence pack first; it is worth far more per pound than a premature certification.

Data residency largely evaporates as an objection too — account-holder data never leaves the customer's jurisdiction because it never leaves their browser. That argument plays particularly well in Mauritius and Singapore.

### 6.2 Shape

```
crs-platform/
├── packages/
│   ├── schema/          # vendored OECD XSDs (v2.0, v3.0, Status Message, UK combined)
│   │                    # + codegen: enums and types GENERATED from the XSDs, never hand-typed
│   ├── core/            # pure domain. zero I/O, zero React, exhaustively tested
│   │   ├── model/       #   branded types: Giin, Iso3166Alpha2, Iso4217, Tin, DocRefId
│   │   ├── emit/        #   CrsEmitter interface; V2Emitter, V3Emitter, UkCombinedEmitter
│   │   ├── rules/       #   validation engine; stable error codes; cell-level provenance
│   │   └── lifecycle/   #   DocTypeIndic state machine, DocRefId chains, corrections
│   ├── validate/        # libxml2-wasm XSD validation — same code path in browser and CI
│   ├── ingest/          # spreadsheet → canonical records, retaining row/column provenance
│   └── jurisdictions/   # declarative packs: MU, KY, VG, JE, GG, GB, IE, SG …
└── apps/
    ├── web/             # React + Vite. thin. no domain logic.
    └── api/             # ledger, tenancy, RBAC, metering — holds no account-holder PII
```

### 6.3 The decisions that signal craft

- **TypeScript, strict**, with branded primitive types. A `Iso3166Alpha2` should be unconstructible from an arbitrary string — which alone would have prevented the `'XX'` placeholder country code (`:1587`) reaching generated output.
- **Enums generated from the XSDs**, not hand-maintained. The current code hand-keys CRS501–CRS504, CRS101–CRS103, CRS801–CRS813 and more; hand-maintained mirrors of a published schema drift silently.
- **Real XSD validation, executed.** `libxml2-wasm` (v0.7.1, MIT, published March 2026) performs libxml2 schema validation in both browser and Node. This lets the product validate against the official XSDs **in the user's browser**, keeping PII local while making the compliance claim true. Same validator runs in CI. *(Confirmed the package exists and supports validation in both runtimes; the multi-file XSD import behaviour needs a spike, as CRS imports four dependent schemas.)*
- **A rules layer separate from XSD validation — this is not optional.** Schema validity is necessary and nowhere near sufficient. **None** of the rules that actually get files rejected are expressible in XSD: global "in space and time" DocRefId uniqueness, correction-chain ordering, the new-vs-corrections no-mixing rule, test-vs-production DocTypeIndic segregation, jurisdiction-narrowed length limits, `ReceivingCountry` pinning, UEN prefixes. XSD checks shape; the rules engine checks lawfulness; the ledger checks history. A product that validates only against the XSD and calls itself compliant is making the same category of overclaim the current build makes — just more convincingly. Notably, **the OECD publishes no standalone "business rules" document**; the rules live in user-guide prose plus each jurisdiction's own guide, which is precisely why the rule packs are the maintained asset. (Belgium publishes a genuine element/rule table that is a good template for the internal format.)
- **Golden-file tests** against the OECD's published sample instance documents, plus property-based tests asserting invariants (every emitted document validates; DocRefIds are never reused; a correction always references the latest prior DocRefId).
- **An error taxonomy with provenance.** Every failure carries a stable code, a severity, a **source cell reference** (sheet, row, column) and a remediation string. Pointing at the user's spreadsheet cell is the difference between a tool and a toy — and it is what the current "row 14 has warnings" output fails to do.
- **No fabricated data in regulatory output — the single most important rule.** Missing data is a hard stop or an explicit, period-appropriate "not reported" sentinel. Never a plausible default. See §2.5: the current code substitutes `"Not Provided"` for street/city, `"XX"` for country codes, and — far worse — `CRS901` for self-certification, silently attesting a due-diligence step the institution may never have performed.
- **Configuration where the standard defers to local law.** The controlling-person ownership threshold is set by domestic AML rules, not by CRS — it must be per-jurisdiction configuration, never a hard-coded 25%.
- **Deterministic, jurisdiction-conformant reference IDs**, allocated from the ledger with uniqueness enforced, never `Math.random()`.
- **A sober UI.** Delete the badge spam. State the schema version, the jurisdiction, the validation result, and the record counts.

### 6.4 Environment note

This sandbox permits egress only to package registries (npm, PyPI, crates, Go). The official OECD XSDs, User Guide v4.0, and the Status Message schema **cannot be fetched here** and must be vendored in from an unrestricted machine before `packages/schema` can be populated.

---

## 7. Recommendation

**Keep the domain, change the product.** The CRS mapping work already in this repo — the enum tables, the column inference, the field taxonomy — represents real domain knowledge and is worth carrying forward. Almost everything else should be rebuilt.

Sequence:

1. **Verify the home market first — it is the cheapest and most decisive check.** Open `mra.mu/download/CRSFAQ.pdf` to confirm (a) that MRA really does not provide a conversion tool, (b) the RY2025 deadline, and (c) MRA's schema-version position. Then validate output against MRA's published `Sample-Valid.xml`. If MRA ships no free tool and mandates v2.0, you have a named local market and a concrete conformance target on day one.
2. **Obtain the primary documents** — OECD CRS XML Schema v3.0 + User Guide v4.0 (especially the v2.0→v3.0 transitional correction rules), the Status Message schema, the HMRC combined schema and its user guide. Several load-bearing details here are marked SECONDARY precisely because these could not be read in this environment.
3. **Close the free-tool and web-form enumeration** (HK IRD, HMRC, IRAS, IRS, Jersey, Guernsey, IoM, BVI, Luxembourg). Each free national tool or portal web-form subtracts a market. This determines whether the market is large enough to justify the build — it matters more than build quality.
4. **Stop the fabricated attestations immediately** (§2.5 / `AUDIT.md` C0). Whatever happens to the product direction, no build should ship that silently asserts self-certifications the institution may not hold.
5. **Fix the live security holes regardless** (`AUDIT.md`) — self-upgradable plans and unverified PayPal webhooks are exploitable today.
6. **Clean up the unearned claims** — remove the "100% XSD Compliant" and "GDPR Compliant" badges, the hardcoded `containsPII` / `LEGITIMATE_INTEREST` flags, the non-existent sample template and the unimplemented Enterprise "API access". Never introduce FATF language. Each of these is a credibility liability in front of the only buyers who matter.
7. **Re-price** to per-filing / per-entity / annual seat, below the $1,500/yr competitor floor.
8. **Build the ledger first, converter second.** The ledger is the moat; the converter is table stakes.
9. **Aim at the Cayman DITC cohort for RY2026** — but only if steps 1–3 confirm the economics.

**Bottom line:** the concept is half-right. There is a real, badly-served obligation and an unusually good entry window. But "converter" is the wrong noun — it is a commodity that governments sometimes give away free, that a competitor already sells, and that structurally cannot complete the filing lifecycle. The defensible version is a filing system of record whose value compounds with every year of retained submission history. That is buildable to a high standard, and the browser-only architecture that exists today by accident is exactly the right foundation to build it on.
