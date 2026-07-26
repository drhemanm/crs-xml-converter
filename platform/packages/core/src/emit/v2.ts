/**
 * CRS XML Schema v2.0 emitter.
 *
 * This is the version actually accepted for the 2026 filing season in
 * Mauritius, Cayman, Ireland and Singapore. A product that emits only v3.0
 * cannot file anywhere this year — which is the single most consequential
 * defect in the legacy implementation.
 *
 * v2.0 has no SelfCert, AccountType, DDProcedure or JointAccount elements.
 * Where the canonical record carries those values we drop them, but we say so:
 * silently discarding due-diligence data the filer supplied is exactly the kind
 * of invisible loss this platform exists to prevent.
 */
import { el, serialize, text, type XmlElement, type XmlNode } from "../xml.js";
import { valueOf, type AccountRecord, type ControllingPerson } from "../model.js";
import { DiagnosticCode, error as diagError, warning as diagWarning, type Diagnostic } from "../diagnostics.js";
import type { FilingPlan, PlannedRecord } from "../lifecycle.js";
import { MessageTypeIndic } from "../lifecycle.js";
import {
  buildAddress,
  buildDocSpec,
  buildIndividual,
  buildMessageSpec,
  buildOrganisationIdentifiers,
  buildReportingFi,
  formatAmount,
  type EmitOptions,
  type EmitResult,
  type Emitter,
} from "./common.js";

const NS = {
  crs: "urn:oecd:ties:crs:v2",
  cfc: "urn:oecd:ties:commontypesfatcacrs:v2",
  stf: "urn:oecd:ties:crsstf:v5",
  iso: "urn:oecd:ties:isocrstypes:v1",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
} as const;

function buildControllingPerson(cp: ControllingPerson): XmlElement {
  // v2.0 carries CtrlgPersonType but has no per-CP SelfCert element.
  const cpType = valueOf(cp.type);
  return el("ControllingPerson", {}, [
    buildIndividual(cp.individual, { includeNationality: false }),
    cpType ? el("CtrlgPersonType", {}, [text(cpType)]) : undefined,
  ]);
}

function buildAccountHolder(record: AccountRecord, diagnostics: Diagnostic[]): XmlElement {
  const children: Array<XmlNode | undefined> = [];

  if (record.holder.kind === "individual") {
    children.push(buildIndividual(record.holder, { includeNationality: false }));
  } else {
    const org = record.holder;
    children.push(
      el("Organisation", {}, [
        ...org.residenceCountries.map((c) => el("ResCountryCode", {}, [text(c)])),
        ...buildOrganisationIdentifiers(org.identifiers),
        el("Name", {}, [text(org.name)]),
        buildAddress(org.address),
      ]),
    );
    const holderType = valueOf(org.holderType);
    if (holderType) {
      children.push(el("AcctHolderType", {}, [text(holderType)]));
    } else {
      diagnostics.push(
        diagError(
          DiagnosticCode.MISSING_REQUIRED_VALUE,
          "Account holder type (AcctHolderType) is required for organisation account holders.",
          {
            path: "/CRS_OECD/CrsBody/ReportingGroup/AccountReport/AccountHolder/AcctHolderType",
            provenance: record.provenance,
            remediation: "Supply CRS101, CRS102 or CRS103.",
          },
        ),
      );
    }
  }

  return el("AccountHolder", {}, children);
}

/** Warn once per record about v3.0-only data that this schema cannot carry. */
function reportDroppedFields(record: AccountRecord, diagnostics: Diagnostic[]): void {
  const dropped: string[] = [];
  if (record.selfCert.known) dropped.push("self-certification status");
  if (record.accountType.known) dropped.push("account type");
  if (record.dueDiligence.known) dropped.push("due diligence procedure");
  if (record.jointHolderCount.known) dropped.push("joint account holder count");
  for (const cp of record.controllingPersons) {
    if (cp.selfCert.known) {
      dropped.push("controlling person self-certification");
      break;
    }
  }
  if (dropped.length === 0) return;

  diagnostics.push(
    diagWarning(
      DiagnosticCode.VALUE_TRUNCATED,
      `CRS v2.0 has no element for: ${dropped.join(", ")}. This data is retained in the ledger but not transmitted.`,
      {
        provenance: record.provenance,
        remediation:
          "This is expected for the 2026 season. The values will be carried when this period is next filed or corrected under v3.0.",
      },
    ),
  );
}

function buildAccountReport(planned: PlannedRecord, diagnostics: Diagnostic[]): XmlElement | undefined {
  const record = planned.account;
  if (!record) return undefined;

  reportDroppedFields(record, diagnostics);

  return el("AccountReport", {}, [
    buildDocSpec(planned.docTypeIndic, planned.docRefId, planned.corrDocRefId),
    el(
      "AccountNumber",
      {
        AcctNumberType: record.accountNumberType,
        UndocumentedAccount: String(record.undocumented),
        ClosedAccount: String(record.closed),
        DormantAccount: String(record.dormant),
      },
      [text(record.accountNumber)],
    ),
    buildAccountHolder(record, diagnostics),
    ...record.controllingPersons.map((cp) => buildControllingPerson(cp)),
    el("AccountBalance", { currCode: record.balance.currency }, [text(formatAmount(record.balance))]),
    ...record.payments.map((p) =>
      el("Payment", {}, [
        el("Type", {}, [text(p.type)]),
        el("PaymentAmnt", { currCode: p.amount.currency }, [text(formatAmount(p.amount))]),
      ]),
    ),
  ]);
}

export const v2Emitter: Emitter = {
  target: "crs-v2.0",

  emit(plan: FilingPlan, options: EmitOptions = {}): EmitResult {
    const diagnostics: Diagnostic[] = [];
    const sendingCompanyIn = plan.reportingFi.identifiers[0]?.value;
    const timestamp = `${plan.reportingPeriod.end}T00:00:00Z`;

    const fiDocSpec = buildDocSpec(
      plan.reportingFiRecord.docTypeIndic,
      plan.reportingFiRecord.docRefId,
      plan.reportingFiRecord.corrDocRefId,
    );

    const accountReports = plan.accountReports
      .map((r) => buildAccountReport(r, diagnostics))
      .filter((x): x is XmlElement => x !== undefined);

    const crsBody = el("CrsBody", {}, [
      buildReportingFi(plan.reportingFi, fiDocSpec),
      plan.messageTypeIndic === MessageTypeIndic.NilReturn && accountReports.length === 0
        ? undefined
        : el("ReportingGroup", {}, accountReports),
    ]);

    const root = el(
      "CRS_OECD",
      {
        xmlns: NS.crs,
        "xmlns:cfc": NS.cfc,
        "xmlns:stf": NS.stf,
        "xmlns:iso": NS.iso,
        "xmlns:xsi": NS.xsi,
        "xsi:schemaLocation": `${NS.crs} CrsXML_v2.0.xsd`,
        version: "2.0",
      },
      [buildMessageSpec(plan, sendingCompanyIn, timestamp), crsBody],
    );

    return { xml: serialize(root, options), document: root, diagnostics };
  },
};

export const V2_NAMESPACES = NS;
