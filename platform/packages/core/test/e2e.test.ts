/**
 * End-to-end: CSV rows → canonical records → filing plan → XML → authority
 * status → correction → second correction.
 *
 * This encodes the whole reason the platform is stateful. Every assertion here
 * is something a stateless converter cannot do at all.
 */
import { describe, expect, it } from "vitest";
import { inferColumns, mapRows, type Row } from "@crs/ingest";
import { packFor } from "@crs/jurisdictions";
import {
  CounterSequence,
  InMemoryLedger,
  RefIdAllocator,
  applyStatusMessage,
  emitterFor,
  hasErrors,
  parseStatusMessage,
  planCorrection,
  planNewFiling,
  unsafeBrand,
  validatePlan,
  type FilingPlan,
  type PlanContext,
  type StatusMessage,
} from "../src/index.js";

const isPlan = (x: FilingPlan | unknown[]): x is FilingPlan => !Array.isArray(x);
const isStatus = (x: StatusMessage | unknown[]): x is StatusMessage => !Array.isArray(x);

const HEADERS = [
  "account_number",
  "account_balance",
  "currency_code",
  "holder_type",
  "residence_country",
  "first_name",
  "last_name",
  "address_street",
  "address_city",
  "self_cert",
  "account_type",
  "dd_procedure",
];

const row = (accountNumber: string, balance: string): Row => ({
  account_number: accountNumber,
  account_balance: balance,
  currency_code: "USD",
  holder_type: "individual",
  residence_country: "FR",
  first_name: "Camille",
  last_name: "Deschamps",
  address_street: "14 Rue de Rivoli",
  address_city: "Paris",
  self_cert: "true",
  account_type: "depository",
  dd_procedure: "preexisting",
});

const MU = packFor("MU")!;

function context(ledger: InMemoryLedger, periodEnd: string, filingDate: string): PlanContext {
  const target = MU.schemaFor(unsafeBrand.isoDate(periodEnd), unsafeBrand.isoDate(filingDate));
  return {
    ledger,
    allocator: new RefIdAllocator(ledger, new CounterSequence(ledger.all().length + 1)),
    messageRefSpec: MU.messageRefSpec,
    docRefSpec: MU.docRefSpec,
    environment: "production",
    schemaTarget: target,
    reportingPeriod: { end: unsafeBrand.isoDate(periodEnd) },
    sendingCountry: MU.code,
    receivingCountry: MU.receivingCountry,
    senderId: "MU10203040",
    reportingFi: {
      name: "Banque des Mascareignes Ltd",
      residenceCountry: MU.code,
      identifiers: [{ value: "MU10203040", type: "TIN", issuedBy: { known: true, value: MU.code } }],
      address: {
        countryCode: MU.code,
        type: "OECD304",
        street: { known: true, value: "12 Rue Royale" },
        city: { known: true, value: "Port Louis" },
        postCode: { known: false },
        countrySubentity: { known: false },
      },
      giin: { known: false },
    },
    now: () => "2026-07-26T00:00:00.000Z",
    businessKeyOf: (r) => r.accountNumber,
    payloadDigestOf: (r) => `${r.accountNumber}:${r.balance.amount}`,
  };
}

function statusXml(messageRefId: string, rejected: string[] = []): string {
  const errors = rejected
    .map((d) => `<RecordError><Code>70000</Code><Details>Missing TIN</Details><DocRefIDInError>${d}</DocRefIDInError></RecordError>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0">
  <MessageSpec><MessageRefId>StatusMU</MessageRefId></MessageSpec>
  <CrsStatusMessage>
    <OriginalMessage><OriginalMessageRefID>${messageRefId}</OriginalMessageRefID></OriginalMessage>
    <ValidationErrors>${errors}</ValidationErrors>
    <ValidationResult><Status>Accepted</Status><ValidatedBy>test</ValidatedBy></ValidationResult>
  </CrsStatusMessage>
</CRSStatusMessage_OECD>`;
}

function accept(ledger: InMemoryLedger, messageRefId: string, rejected: string[] = []): void {
  const status = parseStatusMessage(statusXml(messageRefId, rejected));
  if (!isStatus(status)) throw new Error("bad status fixture");
  ledger.apply(applyStatusMessage(ledger, status).mutations);
}

describe("full filing lifecycle", () => {
  it("files, accepts, corrects, and chains a second correction", () => {
    const ledger = new InMemoryLedger();
    const mapping = inferColumns(HEADERS);

    // --- 1. Ingest and file ------------------------------------------------
    const first = mapRows([row("ACC-1", "1000.00"), row("ACC-2", "2000.00")], mapping, { sheet: "Accounts" });
    expect(hasErrors(first.diagnostics)).toBe(false);

    const ctx1 = context(ledger, "2025-12-31", "2026-07-26");
    // Mauritius accepts v2.0 for the 2025 period filed in 2026.
    expect(ctx1.schemaTarget).toBe("crs-v2.0");

    const plan1 = planNewFiling(ctx1, first.records);
    if (!isPlan(plan1)) throw new Error("expected a plan");
    expect(validatePlan(plan1)).toHaveLength(0);

    const emitter = emitterFor(plan1.schemaTarget)!;
    const xml1 = emitter.emit(plan1).xml;
    expect(xml1).toContain("<MessageTypeIndic>CRS701</MessageTypeIndic>");
    expect(xml1).toContain('version="2.0"');
    ledger.apply(plan1.mutations);

    // --- 2. Authority accepts the file but rejects one record --------------
    const rejectedDocRef = plan1.accountReports[1]!.docRefId;
    accept(ledger, plan1.messageRefId, [rejectedDocRef]);

    const liveDocRef = plan1.accountReports[0]!.docRefId;
    expect(ledger.get(liveDocRef)?.state).toBe("live");
    expect(ledger.get(rejectedDocRef)?.state).toBe("rejected");

    // --- 3. Correct the accepted record -----------------------------------
    const corrected = mapRows([row("ACC-1", "1500.00")], mapping, { sheet: "Accounts" });
    const ctx2 = context(ledger, "2025-12-31", "2026-07-26");
    const plan2 = planCorrection(ctx2, [
      { record: corrected.records[0]!, targetDocRefId: liveDocRef },
    ]);
    if (!isPlan(plan2)) throw new Error(`expected a plan: ${JSON.stringify(plan2)}`);
    expect(plan2.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(validatePlan(plan2)).toHaveLength(0);

    const xml2 = emitterFor(plan2.schemaTarget)!.emit(plan2).xml;
    expect(xml2).toContain("<MessageTypeIndic>CRS702</MessageTypeIndic>");
    // The parent is resent as OECD0 with the DocRefId the authority accepted.
    expect(xml2).toContain("<stf:DocTypeIndic>OECD0</stf:DocTypeIndic>");
    expect(xml2).toContain(`<stf:DocRefId>${plan1.reportingFiRecord.docRefId}</stf:DocRefId>`);
    // The correction carries a new DocRefId and points at what it supersedes.
    expect(xml2).toContain("<stf:DocTypeIndic>OECD2</stf:DocTypeIndic>");
    expect(xml2).toContain(`<stf:CorrDocRefId>${liveDocRef}</stf:CorrDocRefId>`);

    ledger.apply(plan2.mutations);
    accept(ledger, plan2.messageRefId);

    const firstCorrectionRef = plan2.accountReports[0]!.docRefId;
    expect(ledger.get(liveDocRef)?.state).toBe("superseded");
    expect(ledger.get(firstCorrectionRef)?.state).toBe("live");

    // --- 4. A second correction must chain from the first (CTS 80003) -----
    const corrected2 = mapRows([row("ACC-1", "1750.00")], mapping, { sheet: "Accounts" });
    const ctx3 = context(ledger, "2025-12-31", "2026-07-26");
    const plan3 = planCorrection(ctx3, [
      { record: corrected2.records[0]!, targetDocRefId: firstCorrectionRef },
    ]);
    if (!isPlan(plan3)) throw new Error("expected a plan");
    expect(plan3.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const xml3 = emitterFor(plan3.schemaTarget)!.emit(plan3).xml;
    expect(xml3).toContain(`<stf:CorrDocRefId>${firstCorrectionRef}</stf:CorrDocRefId>`);
    expect(xml3).not.toContain(`<stf:CorrDocRefId>${liveDocRef}</stf:CorrDocRefId>`);

    // --- 5. Every DocRefId ever emitted is unique -------------------------
    const allRefs = ledger
      .all()
      .filter((e) => e.kind === "AccountReport")
      .map((e) => e.docRefId);
    expect(new Set(allRefs).size).toBe(allRefs.length);
  });

  it("selects v3.0 for the same period once filed after the 2027 cutover", () => {
    const ledger = new InMemoryLedger();
    // Same 2025 period — but filed in 2027, when the amended schema applies to
    // everything, including corrections of earlier years.
    const ctx = context(ledger, "2025-12-31", "2027-03-01");
    expect(ctx.schemaTarget).toBe("crs-v3.0");

    const mapping = inferColumns(HEADERS);
    const { records } = mapRows([row("ACC-9", "500.00")], mapping, { sheet: "Accounts" });
    const plan = planNewFiling(ctx, records);
    if (!isPlan(plan)) throw new Error("expected a plan");

    const { xml, diagnostics } = emitterFor("crs-v3.0")!.emit(plan);
    expect(xml).toContain('version="3.0"');
    // The 2025 period still permits the transitional sentinels, so v3.0-only
    // fields the filer never supplied do not become a hard error.
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("refuses to file at all for a jurisdiction whose schema is not implemented", () => {
    const GB = packFor("GB")!;
    // Before 2027 HMRC requires its own combined FATCA/CDOT/CRS schema.
    expect(GB.schemaFor(unsafeBrand.isoDate("2025-12-31"), unsafeBrand.isoDate("2026-05-01"))).toBe("uk-combined");
    expect(emitterFor("uk-combined")).toBeUndefined();
  });
});
