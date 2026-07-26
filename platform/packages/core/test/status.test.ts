import { describe, expect, it } from "vitest";
import {
  InMemoryLedger,
  applyStatusMessage,
  parseStatusMessage,
  planNewFiling,
  type FilingPlan,
  type StatusMessage,
} from "../src/index.js";
import { completeRecord, planContext } from "./fixtures.js";

const isPlan = (x: FilingPlan | unknown[]): x is FilingPlan => !Array.isArray(x);
const isStatus = (x: StatusMessage | unknown[]): x is StatusMessage => !Array.isArray(x);

function statusXml(opts: {
  messageRefId: string;
  status: "Accepted" | "Rejected";
  recordErrors?: Array<{ code: string; details: string; docRefId: string; fieldPath?: string }>;
  fileErrors?: Array<{ code: string; details: string }>;
}): string {
  const recordErrors = (opts.recordErrors ?? [])
    .map(
      (r) => `
      <RecordError>
        <Code>${r.code}</Code>
        <Details>${r.details}</Details>
        <DocRefIDInError>${r.docRefId}</DocRefIDInError>
        ${r.fieldPath ? `<FieldsInError><FieldPath>${r.fieldPath}</FieldPath></FieldsInError>` : ""}
      </RecordError>`,
    )
    .join("");
  const fileErrors = (opts.fileErrors ?? [])
    .map((f) => `<FileError><Code>${f.code}</Code><Details>${f.details}</Details></FileError>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0">
  <MessageSpec>
    <TransmittingCountry>MU</TransmittingCountry>
    <ReceivingCountry>MU</ReceivingCountry>
    <MessageType>CRSMessageStatus</MessageType>
    <MessageRefId>StatusMU-1</MessageRefId>
    <Timestamp>2027-06-01T10:00:00Z</Timestamp>
  </MessageSpec>
  <CrsStatusMessage>
    <OriginalMessage>
      <OriginalMessageRefID>${opts.messageRefId}</OriginalMessageRefID>
      <FileMetaData>
        <CTSTransmissionID>CTS-9911</CTSTransmissionID>
        <UncompressedFileSizeKBQty>42</UncompressedFileSizeKBQty>
      </FileMetaData>
    </OriginalMessage>
    <ValidationErrors>${fileErrors}${recordErrors}</ValidationErrors>
    <ValidationResult>
      <Status>${opts.status}</Status>
      <ValidatedBy>OECD CTS v2.1</ValidatedBy>
    </ValidationResult>
  </CrsStatusMessage>
</CRSStatusMessage_OECD>`;
}

describe("parsing", () => {
  it("extracts the original message reference and acceptance status", () => {
    const parsed = parseStatusMessage(statusXml({ messageRefId: "MU2026MU000001", status: "Accepted" }));
    expect(isStatus(parsed)).toBe(true);
    if (!isStatus(parsed)) return;
    expect(parsed.originalMessageRefId).toBe("MU2026MU000001");
    expect(parsed.status).toBe("Accepted");
    expect(parsed.validatedBy).toBe("OECD CTS v2.1");
    expect(parsed.transmissionId).toBe("CTS-9911");
  });

  it("extracts record errors with their DocRefIDInError and field paths", () => {
    const parsed = parseStatusMessage(
      statusXml({
        messageRefId: "MU2026MU000001",
        status: "Accepted",
        recordErrors: [
          {
            code: "70000",
            details: "Missing mandatory element",
            docRefId: "MU2026MUAR000003",
            fieldPath: "/CRS_OECD/CrsBody/ReportingGroup/AccountReport/AccountHolder/SelfCert",
          },
        ],
      }),
    );
    if (!isStatus(parsed)) throw new Error("expected a status message");
    expect(parsed.recordErrors).toHaveLength(1);
    expect(parsed.recordErrors[0]?.docRefIdsInError).toEqual(["MU2026MUAR000003"]);
    expect(parsed.recordErrors[0]?.fieldPaths[0]).toContain("SelfCert");
  });

  it("rejects a document that is not a CRS status message", () => {
    const result = parseStatusMessage("<?xml version='1.0'?><SomethingElse/>");
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result[0]?.remediation).toMatch(/CARF|CRS return/);
  });

  it("reports malformed XML rather than throwing", () => {
    const result = parseStatusMessage("<CRSStatusMessage_OECD><unclosed>");
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("reconciliation with the ledger", () => {
  function filed() {
    const ledger = new InMemoryLedger();
    const plan = planNewFiling(planContext(ledger), [
      completeRecord({ businessKey: "A" }),
      completeRecord({ businessKey: "B" }),
    ]);
    if (!isPlan(plan)) throw new Error("expected a plan");
    ledger.apply(plan.mutations);
    return { ledger, plan };
  }

  it("marks every pending record live when the file is accepted cleanly", () => {
    const { ledger, plan } = filed();
    const status = parseStatusMessage(statusXml({ messageRefId: plan.messageRefId, status: "Accepted" }));
    if (!isStatus(status)) throw new Error("expected a status message");

    const result = applyStatusMessage(ledger, status);
    ledger.apply(result.mutations);

    expect(result.rejectedDocRefIds).toHaveLength(0);
    expect(result.acceptedDocRefIds.length).toBeGreaterThan(0);
    for (const e of ledger.all()) expect(e.state).toBe("live");
  });

  /**
   * A file can be Accepted while carrying RecordErrors. The rejected records
   * never existed to the authority, so they must be resubmitted as OECD1 new
   * data — correcting them fails with CTS 80002.
   */
  it("marks only the named records rejected when the file is otherwise accepted", () => {
    const { ledger, plan } = filed();
    const badDocRef = plan.accountReports[0]!.docRefId;

    const status = parseStatusMessage(
      statusXml({
        messageRefId: plan.messageRefId,
        status: "Accepted",
        recordErrors: [{ code: "70000", details: "Missing mandatory element", docRefId: badDocRef }],
      }),
    );
    if (!isStatus(status)) throw new Error("expected a status message");

    const result = applyStatusMessage(ledger, status);
    ledger.apply(result.mutations);

    expect(result.rejectedDocRefIds).toEqual([badDocRef]);
    expect(ledger.get(badDocRef)?.state).toBe("rejected");
    expect(ledger.get(plan.accountReports[1]!.docRefId)?.state).toBe("live");

    const guidance = result.diagnostics.find((d) => d.authorityCode === "70000");
    expect(guidance?.remediation).toMatch(/new data \(OECD1\)/);
  });

  it("marks the whole submission rejected when the file is rejected", () => {
    const { ledger, plan } = filed();
    const status = parseStatusMessage(
      statusXml({
        messageRefId: plan.messageRefId,
        status: "Rejected",
        fileErrors: [{ code: "50007", details: "Schema validation failed" }],
      }),
    );
    if (!isStatus(status)) throw new Error("expected a status message");

    const result = applyStatusMessage(ledger, status);
    ledger.apply(result.mutations);

    expect(result.acceptedDocRefIds).toHaveLength(0);
    for (const e of ledger.all()) expect(e.state).toBe("rejected");
    expect(result.diagnostics[0]?.authorityCode).toBe("50007");
    expect(result.diagnostics[0]?.remediation).toMatch(/entire file/i);
  });

  it("warns when the status refers to a filing this system did not make", () => {
    const { ledger } = filed();
    const status = parseStatusMessage(statusXml({ messageRefId: "GB2026GBunknown", status: "Accepted" }));
    if (!isStatus(status)) throw new Error("expected a status message");

    const result = applyStatusMessage(ledger, status);
    expect(result.diagnostics.some((d) => d.severity === "warning")).toBe(true);
    expect(result.mutations).toHaveLength(0);
  });
});
