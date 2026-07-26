/**
 * The correction lifecycle. These tests encode rules that are not expressible
 * in XSD and that account for most real-world CRS rejections; each references
 * the OECD CTS error code it prevents.
 */
import { describe, expect, it } from "vitest";
import {
  DocTypeIndic,
  InMemoryLedger,
  MessageTypeIndic,
  planCorrection,
  planNewFiling,
  planNilReturn,
  planReportingFiDeletion,
  validatePlan,
  type FilingPlan,
  type LedgerEntry,
} from "../src/index.js";
import { completeRecord, planContext } from "./fixtures.js";

const isPlan = (x: FilingPlan | unknown[]): x is FilingPlan => !Array.isArray(x);

/** Simulate the authority accepting everything in a plan. */
function accept(ledger: InMemoryLedger, plan: FilingPlan): void {
  ledger.apply(plan.mutations);
  for (const e of ledger.all()) {
    if (e.state === "pending") ledger.apply([{ op: "setState", docRefId: e.docRefId, state: "live" }]);
  }
}

describe("new filing", () => {
  it("produces OECD1 records under a CRS701 message", () => {
    const ledger = new InMemoryLedger();
    const plan = planNewFiling(planContext(ledger), [completeRecord()]);
    expect(isPlan(plan)).toBe(true);
    if (!isPlan(plan)) return;

    expect(plan.messageTypeIndic).toBe(MessageTypeIndic.New);
    expect(plan.reportingFiRecord.docTypeIndic).toBe(DocTypeIndic.New);
    expect(plan.accountReports).toHaveLength(1);
    expect(plan.accountReports[0]?.docTypeIndic).toBe(DocTypeIndic.New);
    expect(plan.accountReports[0]?.corrDocRefId).toBeUndefined();
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("allocates a MessageRefId starting with the sending country code", () => {
    const ledger = new InMemoryLedger();
    const plan = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    // The legacy implementation emitted `CRS_<timestamp>` — no country, no year.
    expect(plan.messageRefId.startsWith("MU")).toBe(true);
    expect(plan.messageRefId).toContain("2026");
  });

  it("never reuses a DocRefId across filings", () => {
    const ledger = new InMemoryLedger();
    const first = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(first)) throw new Error("expected a plan");
    accept(ledger, first);

    const second = planNewFiling(planContext(ledger), [
      completeRecord({ businessKey: "ACC-9999" }),
    ]);
    if (!isPlan(second)) throw new Error("expected a plan");

    const firstIds = new Set(first.accountReports.map((r) => r.docRefId));
    for (const r of second.accountReports) expect(firstIds.has(r.docRefId)).toBe(false);
  });

  it("refuses an empty new-data filing and points at nil returns", () => {
    const ledger = new InMemoryLedger();
    const result = planNewFiling(planContext(ledger), []);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result[0]?.remediation).toMatch(/nil return/i);
  });

  it("resends an already-accepted ReportingFI as OECD0 with its original DocRefId", () => {
    const ledger = new InMemoryLedger();
    const first = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(first)) throw new Error("expected a plan");
    const originalFiDocRef = first.reportingFiRecord.docRefId;
    accept(ledger, first);

    const second = planNewFiling(planContext(ledger), [completeRecord({ businessKey: "ACC-0002" })]);
    if (!isPlan(second)) throw new Error("expected a plan");

    // CTS 80013 / HMRC code 30: the resend must carry the accepted DocRefId.
    expect(second.reportingFiRecord.docTypeIndic).toBe(DocTypeIndic.Resent);
    expect(second.reportingFiRecord.docRefId).toBe(originalFiDocRef);
    expect(second.reportingFiRecord.corrDocRefId).toBeUndefined();
  });
});

describe("corrections", () => {
  function setup() {
    const ledger = new InMemoryLedger();
    const original = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(original)) throw new Error("expected a plan");
    accept(ledger, original);
    return { ledger, original };
  }

  it("emits OECD2 with CorrDocRefId pointing at the accepted record", () => {
    const { ledger, original } = setup();
    const target = original.accountReports[0]!.docRefId;

    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "22000.00", currency: original.accountReports[0]!.account!.balance.currency } }), targetDocRefId: target },
    ]);
    if (!isPlan(plan)) throw new Error(`expected a plan, got ${JSON.stringify(plan)}`);

    expect(plan.messageTypeIndic).toBe(MessageTypeIndic.Corrections);
    expect(plan.accountReports[0]?.docTypeIndic).toBe(DocTypeIndic.Corrected);
    expect(plan.accountReports[0]?.corrDocRefId).toBe(target);
    // The correction itself gets a NEW DocRefId for future reference.
    expect(plan.accountReports[0]?.docRefId).not.toBe(target);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("resends the parent ReportingFI as OECD0 alongside the correction", () => {
    const { ledger, original } = setup();
    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "1.00", currency: original.accountReports[0]!.account!.balance.currency } }), targetDocRefId: original.accountReports[0]!.docRefId },
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");

    expect(plan.reportingFiRecord.docTypeIndic).toBe(DocTypeIndic.Resent);
    expect(plan.reportingFiRecord.docRefId).toBe(original.reportingFiRecord.docRefId);
  });

  // CTS 80003. This is the rule stateless converters get wrong: a second
  // correction must reference the FIRST CORRECTION, not the original record.
  it("requires the second correction to chain from the first, not the original", () => {
    const { ledger, original } = setup();
    const originalDocRef = original.accountReports[0]!.docRefId;
    const currency = original.accountReports[0]!.account!.balance.currency;

    const firstCorrection = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "22000.00", currency } }), targetDocRefId: originalDocRef },
    ]);
    if (!isPlan(firstCorrection)) throw new Error("expected a plan");
    accept(ledger, firstCorrection);
    const firstCorrectionDocRef = firstCorrection.accountReports[0]!.docRefId;

    // Referencing the superseded original must fail, and say what to use.
    const stale = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "33000.00", currency } }), targetDocRefId: originalDocRef },
    ]);
    if (!isPlan(stale)) throw new Error("expected a plan with diagnostics");
    const staleErrors = stale.diagnostics.filter((d) => d.severity === "error");
    expect(staleErrors).toHaveLength(1);
    expect(staleErrors[0]?.code).toBe("CORR-003");
    expect(staleErrors[0]?.authorityCode).toBe("CTS 80003");
    expect(staleErrors[0]?.remediation).toContain(firstCorrectionDocRef);

    // Referencing the latest version succeeds.
    const good = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "33000.00", currency } }), targetDocRefId: firstCorrectionDocRef },
    ]);
    if (!isPlan(good)) throw new Error("expected a plan");
    expect(good.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  // CTS 80002. A record the authority rejected never existed to it, so it must
  // go back as new data, not as a correction.
  it("refuses to correct a record the authority rejected", () => {
    const { ledger, original } = setup();
    const target = original.accountReports[0]!.docRefId;
    ledger.apply([{ op: "setState", docRefId: target, state: "rejected" }]);

    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord(), targetDocRefId: target },
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    const errors = plan.diagnostics.filter((d) => d.severity === "error");
    expect(errors[0]?.authorityCode).toBe("CTS 80002");
    expect(errors[0]?.remediation).toMatch(/new data \(OECD1\)/);
  });

  it("rejects an unknown CorrDocRefId", () => {
    const { ledger } = setup();
    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord(), targetDocRefId: "MU2026MUnope" as never },
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    expect(plan.diagnostics.some((d) => d.code === "CORR-002")).toBe(true);
  });

  // CTS 80011.
  it("refuses to correct the same record twice in one message", () => {
    const { ledger, original } = setup();
    const target = original.accountReports[0]!.docRefId;
    const currency = original.accountReports[0]!.account!.balance.currency;

    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "1.00", currency } }), targetDocRefId: target },
      { record: completeRecord({ balance: { amount: "2.00", currency } }), targetDocRefId: target },
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    expect(plan.diagnostics.some((d) => d.code === "CORR-008")).toBe(true);
  });

  // The silent-amendment guard: a correction replaces the whole record, so an
  // identical payload means nothing would change and the filer is confused.
  it("warns when a correction is byte-identical to what is already on file", () => {
    const { ledger, original } = setup();
    const plan = planCorrection(planContext(ledger), [
      { record: completeRecord(), targetDocRefId: original.accountReports[0]!.docRefId },
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    expect(plan.diagnostics.some((d) => d.severity === "warning" && /identical/.test(d.message))).toBe(true);
  });

  it("cannot correct anything before an original filing has been accepted", () => {
    const ledger = new InMemoryLedger();
    const result = planCorrection(planContext(ledger), [
      { record: completeRecord(), targetDocRefId: "MU2026MUanything" as never },
    ]);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result[0]?.authorityCode).toBe("CTS 80013");
  });
});

describe("ReportingFI deletion", () => {
  // CTS 80009 / HMRC code 26: deletion does not cascade.
  it("refuses to delete a ReportingFI while children are still live", () => {
    const ledger = new InMemoryLedger();
    const original = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(original)) throw new Error("expected a plan");
    accept(ledger, original);

    const result = planReportingFiDeletion(planContext(ledger), new Map());
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result[0]?.code).toBe("CORR-007");
    expect(result[0]?.authorityCode).toBe("CTS 80009");
  });

  it("voids every live child explicitly when payloads are supplied", () => {
    const ledger = new InMemoryLedger();
    const original = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(original)) throw new Error("expected a plan");
    accept(ledger, original);

    const childDocRef = original.accountReports[0]!.docRefId;
    const payloads = new Map([[childDocRef, completeRecord()]]);
    const plan = planReportingFiDeletion(planContext(ledger), payloads);
    if (!isPlan(plan)) throw new Error(`expected a plan, got ${JSON.stringify(plan)}`);

    expect(plan.accountReports).toHaveLength(1);
    expect(plan.accountReports[0]?.docTypeIndic).toBe(DocTypeIndic.Deleted);
    expect(plan.accountReports[0]?.corrDocRefId).toBe(childDocRef);
    // A void carries a full record, not a stub referencing an id.
    expect(plan.accountReports[0]?.account).toBeDefined();
    expect(plan.reportingFiRecord.docTypeIndic).toBe(DocTypeIndic.Deleted);
    expect(validatePlan(plan)).toHaveLength(0);
  });
});

describe("nil returns", () => {
  it("produces a CRS703 message with no account reports", () => {
    const ledger = new InMemoryLedger();
    const plan = planNilReturn(planContext(ledger));
    if (!isPlan(plan)) throw new Error("expected a plan");
    expect(plan.messageTypeIndic).toBe(MessageTypeIndic.NilReturn);
    expect(plan.accountReports).toHaveLength(0);
    expect(validatePlan(plan)).toHaveLength(0);
  });
});

describe("plan invariants", () => {
  it("rejects a message mixing new records with corrections", () => {
    const ledger = new InMemoryLedger();
    const base = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(base)) throw new Error("expected a plan");

    const mixed: FilingPlan = {
      ...base,
      accountReports: [
        ...base.accountReports,
        {
          kind: "AccountReport",
          docRefId: "MU2026MUcorr" as never,
          docTypeIndic: DocTypeIndic.Corrected,
          corrDocRefId: "MU2026MUorig" as never,
          account: completeRecord(),
          businessKey: "ACC-0003",
        },
      ],
    };
    const errors = validatePlan(mixed);
    expect(errors.some((d) => d.code === "MSG-001" && d.authorityCode === "CTS 80010")).toBe(true);
  });

  it("rejects test indicators in a production filing", () => {
    const ledger = new InMemoryLedger();
    const base = planNewFiling(planContext(ledger, { environment: "test" }), [completeRecord()]);
    if (!isPlan(base)) throw new Error("expected a plan");
    // Test plan is internally consistent...
    expect(validatePlan(base)).toHaveLength(0);
    // ...but the same records declared as production are not.
    const mislabelled: FilingPlan = { ...base, environment: "production" };
    const errors = validatePlan(mislabelled);
    expect(errors.some((d) => d.code === "MSG-003" && d.authorityCode === "CTS 50010")).toBe(true);
  });

  it("uses test DocTypeIndic values in a test filing", () => {
    const ledger = new InMemoryLedger();
    const plan = planNewFiling(planContext(ledger, { environment: "test" }), [completeRecord()]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    expect(plan.accountReports[0]?.docTypeIndic).toBe(DocTypeIndic.TestNew);
  });

  it("rejects a CorrDocRefId on a new record", () => {
    const ledger = new InMemoryLedger();
    const base = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(base)) throw new Error("expected a plan");
    const bad: FilingPlan = {
      ...base,
      accountReports: [{ ...base.accountReports[0]!, corrDocRefId: "MU2026MUx" as never }],
    };
    expect(validatePlan(bad).some((d) => d.code === "CORR-004")).toBe(true);
  });
});

describe("ledger chain", () => {
  it("walks from any version to the current one", () => {
    const ledger = new InMemoryLedger();
    const original = planNewFiling(planContext(ledger), [completeRecord()]);
    if (!isPlan(original)) throw new Error("expected a plan");
    accept(ledger, original);
    const originalRef = original.accountReports[0]!.docRefId;
    const currency = original.accountReports[0]!.account!.balance.currency;

    const c1 = planCorrection(planContext(ledger), [
      { record: completeRecord({ balance: { amount: "2.00", currency } }), targetDocRefId: originalRef },
    ]);
    if (!isPlan(c1)) throw new Error("expected a plan");
    accept(ledger, c1);

    const chain = ledger.chain(originalRef);
    expect(chain.map((e: LedgerEntry) => e.docRefId)).toEqual([originalRef, c1.accountReports[0]!.docRefId]);
    expect(chain[0]?.state).toBe("superseded");
    expect(chain[chain.length - 1]?.state).toBe("live");
  });
});
