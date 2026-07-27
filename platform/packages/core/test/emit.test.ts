import { describe, expect, it } from "vitest";
import {
  InMemoryLedger,
  notReported,
  planNewFiling,
  planNilReturn,
  v2Emitter,
  v3Emitter,
  findCharsetViolations,
  type FilingPlan,
  type Individual,
} from "../src/index.js";
import { completeRecord, period2025, planContext, recordWithoutSelfCert } from "./fixtures.js";

const isPlan = (x: FilingPlan | unknown[]): x is FilingPlan => !Array.isArray(x);

function planFor(records = [completeRecord()], overrides = {}): FilingPlan {
  const ledger = new InMemoryLedger();
  const plan = planNewFiling(planContext(ledger, overrides), records);
  if (!isPlan(plan)) throw new Error(`expected a plan, got ${JSON.stringify(plan)}`);
  return plan;
}

describe("v3.0 document structure", () => {
  // The legacy generator put targetNamespace — an XSD authoring attribute — on
  // the instance document root, which strict validators reject.
  it("does not emit targetNamespace on the instance root", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).not.toContain("targetNamespace");
  });

  it("does not declare the FATCA namespace, which is irrelevant to CRS", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).not.toContain("urn:oecd:ties:fatca");
  });

  it("declares the v3 namespace and version", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).toContain('xmlns="urn:oecd:ties:crs:v3"');
    expect(xml).toContain('version="3.0"');
    expect(xml).toContain("CrsXML_v3.0.xsd");
  });

  it("emits ReceivingCountry from the filing jurisdiction", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).toContain("<ReceivingCountry>MU</ReceivingCountry>");
    expect(xml).toContain("<TransmittingCountry>MU</TransmittingCountry>");
  });

  // CorrMessageRefId is forbidden in CRS in both positions (CTS 80006/80007).
  it("never emits CorrMessageRefId", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).not.toContain("CorrMessageRefId");
  });

  it("is deterministic — the same plan serialises identically", () => {
    const plan = planFor();
    expect(v3Emitter.emit(plan).xml).toBe(v3Emitter.emit(plan).xml);
  });
});

describe("fabricated data", () => {
  /**
   * The single most dangerous legacy defect: a missing self-certification
   * column defaulted to CRS901, meaning "a valid self-certification was
   * obtained". Institutions filed attestations they may never have held.
   */
  it("refuses to assert a self-certification that was never supplied", () => {
    // Where the jurisdiction does not permit the transitional sentinel, an
    // unsupplied self-certification has to be a hard error.
    const { xml, diagnostics } = v3Emitter.emit(
      planFor([recordWithoutSelfCert()], { sentinelsPermitted: false }),
    );

    expect(xml).not.toContain("CRS901");
    const errors = diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((d) => /Self-certification/i.test(d.message))).toBe(true);
    expect(errors[0]?.remediation).toMatch(/must not be assumed/i);
  });

  it("attaches the offending spreadsheet row to the diagnostic", () => {
    const { diagnostics } = v3Emitter.emit(
      planFor([recordWithoutSelfCert()], { sentinelsPermitted: false }),
    );
    const d = diagnostics.find((x) => /Self-certification/i.test(x.message));
    expect(d?.provenance).toEqual({ sheet: "Accounts", row: 2 });
  });

  /**
   * The sentinels are period-gated: valid on or before 2025-12-31, forbidden
   * after. That gating is exactly what allows a v3.0 correction to an older
   * period.
   */
  /**
   * The OECD describes the sentinels as a transitional measure for
   * interoperability with the previous schema version, "particularly in
   * respect of corrections", and states no cut-off date. Whether they may be
   * used is therefore a jurisdiction decision, carried on the plan.
   */
  it("uses the not-reported sentinel where the jurisdiction permits it", () => {
    const plan = planFor([recordWithoutSelfCert()], {
      reportingPeriod: period2025,
      sentinelsPermitted: true,
    });
    const { xml, diagnostics } = v3Emitter.emit(plan);

    expect(xml).toContain("<SelfCert>CRS900</SelfCert>");
    expect(xml).toContain("<AccountType>CRS1100</AccountType>");
    expect(xml).toContain("<DDProcedure>CRS1200</DDProcedure>");
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("never emits placeholder address text", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).not.toContain("Not Provided");
    expect(xml).not.toContain(">XX<");
  });

  it("omits absent optional elements rather than emitting them empty", () => {
    const { xml } = v3Emitter.emit(planFor());
    expect(xml).not.toContain("<cfc:PostCode>");
    expect(xml).not.toContain("<cfc:PostCode/>");
  });

  /**
   * City is mandatory inside AddressFix in the OECD common types. Emitting an
   * empty <AddressFix/> would be rejected by the authority's validator, so a
   * missing city has to be an error here rather than a silent omission.
   */
  it("reports a missing city instead of emitting an empty AddressFix", () => {
    const base = completeRecord();
    const record = completeRecord({
      holder: {
        ...(base.holder as Individual),
        address: { ...(base.holder as Individual).address, city: notReported },
      },
    });
    const { xml, diagnostics } = v3Emitter.emit(planFor([record]));

    expect(xml).not.toContain("<cfc:AddressFix/>");
    const cityError = diagnostics.find((d) => /City is required/.test(d.message));
    expect(cityError?.severity).toBe("error");
    expect(cityError?.path).toContain("AddressFix/City");
  });
});

describe("message metadata", () => {
  it("uses the plan's generation time as the Timestamp, not the period end", () => {
    const plan = planFor();
    const { xml } = v3Emitter.emit(plan);
    expect(xml).toContain(`<Timestamp>${plan.generatedAt}</Timestamp>`);
    expect(xml).not.toContain("<Timestamp>2026-12-31T00:00:00Z</Timestamp>");
  });
});

describe("v2.0 emitter", () => {
  it("emits the v2 namespace and version", () => {
    const { xml } = v2Emitter.emit(planFor([completeRecord()], { schemaTarget: "crs-v2.0" }));
    expect(xml).toContain('xmlns="urn:oecd:ties:crs:v2"');
    expect(xml).toContain('version="2.0"');
  });

  // v2.0 has no SelfCert / AccountType / DDProcedure elements at all.
  it("omits v3-only elements", () => {
    const { xml } = v2Emitter.emit(planFor([completeRecord()], { schemaTarget: "crs-v2.0" }));
    expect(xml).not.toContain("SelfCert");
    expect(xml).not.toContain("DDProcedure");
    expect(xml).not.toContain("<AccountType>");
  });

  it("says so when it drops due-diligence data the filer supplied", () => {
    const { diagnostics } = v2Emitter.emit(planFor([completeRecord()], { schemaTarget: "crs-v2.0" }));
    const warned = diagnostics.find((d) => d.code === "DATA-007");
    expect(warned).toBeDefined();
    expect(warned?.message).toMatch(/self-certification status/);
    expect(warned?.message).toMatch(/retained in the ledger/);
  });

  it("does not require self-certification, since the schema has no such element", () => {
    const { diagnostics } = v2Emitter.emit(
      planFor([recordWithoutSelfCert()], { schemaTarget: "crs-v2.0" }),
    );
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });
});

describe("charset enforcement", () => {
  // HMRC's AEOI portal accepts only Latin character set 1.
  it("detects characters outside ISO-8859-1", () => {
    const violations = findCharsetViolations("Zoë Ngūyen 日本", "ISO-8859-1");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.map((v) => v.char)).toContain("日");
    // ë is valid Latin-1 and must not be flagged.
    expect(violations.map((v) => v.char)).not.toContain("ë");
  });

  it("flags nothing for UTF-8 targets", () => {
    expect(findCharsetViolations("日本", "UTF-8")).toHaveLength(0);
  });
});

describe("monetary formatting", () => {
  it("preserves decimal precision without float round-tripping", () => {
    const record = completeRecord({ balance: { amount: "99999999999.99", currency: completeRecord().balance.currency } });
    const { xml } = v3Emitter.emit(planFor([record]));
    expect(xml).toContain(">99999999999.99<");
  });

  it("pads to two decimal places", () => {
    const record = completeRecord({ balance: { amount: "100", currency: completeRecord().balance.currency } });
    const { xml } = v3Emitter.emit(planFor([record]));
    expect(xml).toContain(">100.00<");
  });
});

describe("XML escaping", () => {
  it("escapes markup characters in names", () => {
    const base = completeRecord();
    const record = completeRecord({
      holder: {
        ...base.holder,
        kind: "individual",
        name: { ...(base.holder as never as { name: { firstName: string } }).name, firstName: "A & <B>" },
      } as never,
    });
    const { xml } = v3Emitter.emit(planFor([record]));
    expect(xml).toContain("A &amp; &lt;B&gt;");
    expect(xml).not.toContain("A & <B>");
  });
});

describe("nil returns", () => {
  /**
   * Verified against OECD User Guide v4.0: for a domestic FI nil return the
   * AccountReport is omitted "while the CrsBody and ReportingFI will be
   * provided". Omitting CrsBody entirely is only correct for Competent
   * Authority to Competent Authority messages.
   */
  it("retains CrsBody and ReportingFI, omitting only the account reports", () => {
    const ledger = new InMemoryLedger();
    const plan = planNilReturn(planContext(ledger));
    if (Array.isArray(plan)) throw new Error("expected a plan");
    const { xml } = v3Emitter.emit(plan);

    expect(xml).toContain("<MessageTypeIndic>CRS703</MessageTypeIndic>");
    expect(xml).toContain("<CrsBody>");
    expect(xml).toContain("<ReportingFI>");
    expect(xml).not.toContain("<AccountReport>");
    expect(xml).not.toContain("<ReportingGroup>");
  });
});
