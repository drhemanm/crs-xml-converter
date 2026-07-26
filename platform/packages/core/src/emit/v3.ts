/**
 * CRS XML Schema v3.0 emitter (the "amended CRS" / CRS 2.0 schema).
 *
 * Applies to reporting year 2026 onward, first filed in 2027 — and, in
 * jurisdictions including the UK and Ireland, to corrections of *earlier*
 * periods filed from 1 January 2027. That second case is why the sentinel
 * gating below exists.
 *
 * Note on namespaces: the `stf` prefix is bound to `urn:oecd:ties:crsstf:v5`.
 * That matches the legacy implementation and one corroborating source, but a
 * second source suggested `urn:oecd:ties:stf:v5`. It is a one-line change once
 * the official XSD is vendored into packages/schema, and the golden tests will
 * catch it immediately.
 */
import { el, serialize, text, type XmlElement, type XmlNode } from "../xml.js";
import {
  AccountType,
  ControllingPersonSelfCert,
  ControllingPersonType,
  DueDiligence,
  SelfCert,
  sentinelsPermitted,
  valueOf,
  type AccountRecord,
  type ControllingPerson,
} from "../model.js";
import { DiagnosticCode, error as diagError, type Diagnostic } from "../diagnostics.js";
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
  crs: "urn:oecd:ties:crs:v3",
  cfc: "urn:oecd:ties:commontypesfatcacrs:v2",
  stf: "urn:oecd:ties:crsstf:v5",
  iso: "urn:oecd:ties:isocrstypes:v1",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
} as const;

/**
 * Resolve a v3.0-mandatory enum that the filer may not have supplied.
 *
 * This is the single most important function in the emitter. The legacy
 * implementation defaulted a missing self-certification to CRS901 ("obtained"),
 * causing institutions to assert due diligence they may never have performed.
 * Here, a missing value is either the explicit "not reported" sentinel — valid
 * only for periods on or before 2025-12-31 — or a hard error. Never a guess.
 */
function resolveMandatory<T extends string>(
  value: { known: true; value: T } | { known: false },
  sentinel: T,
  periodAllowsSentinel: boolean,
  fieldName: string,
  path: string,
  record: AccountRecord | undefined,
  diagnostics: Diagnostic[],
): T | undefined {
  if (value.known) return value.value;
  if (periodAllowsSentinel) return sentinel;
  diagnostics.push(
    diagError(
      DiagnosticCode.MISSING_REQUIRED_VALUE,
      `${fieldName} is required for reporting periods after 2025-12-31 and was not supplied.`,
      {
        path,
        ...(record ? { provenance: record.provenance } : {}),
        remediation: `Provide ${fieldName} in the source data. The "not reported" sentinel is no longer accepted for this period, and this value must not be assumed.`,
      },
    ),
  );
  return undefined;
}

function buildControllingPerson(
  cp: ControllingPerson,
  allowSentinel: boolean,
  record: AccountRecord,
  index: number,
  diagnostics: Diagnostic[],
): XmlElement {
  const path = `/CRS_OECD/CrsBody/ReportingGroup/AccountReport/ControllingPerson[${index + 1}]`;
  const cpType = resolveMandatory(
    cp.type,
    ControllingPersonType.NotReported,
    allowSentinel,
    "Controlling person type (CtrlgPersonType)",
    `${path}/CtrlgPersonType`,
    record,
    diagnostics,
  );
  const cpSelfCert = resolveMandatory(
    cp.selfCert,
    ControllingPersonSelfCert.NotReported,
    allowSentinel,
    "Controlling person self-certification (SelfCert)",
    `${path}/SelfCert`,
    record,
    diagnostics,
  );

  return el("ControllingPerson", {}, [
    buildIndividual(cp.individual, { includeNationality: true }),
    cpType ? el("CtrlgPersonType", {}, [text(cpType)]) : undefined,
    cpSelfCert ? el("SelfCert", {}, [text(cpSelfCert)]) : undefined,
  ]);
}

function buildAccountHolder(
  record: AccountRecord,
  allowSentinel: boolean,
  diagnostics: Diagnostic[],
): XmlElement {
  const path = "/CRS_OECD/CrsBody/ReportingGroup/AccountReport/AccountHolder";
  const selfCert = resolveMandatory(
    record.selfCert,
    SelfCert.NotReported,
    allowSentinel,
    "Self-certification status (SelfCert)",
    `${path}/SelfCert`,
    record,
    diagnostics,
  );

  const children: Array<XmlNode | undefined> = [
    selfCert ? el("SelfCert", {}, [text(selfCert)]) : undefined,
  ];

  if (record.holder.kind === "individual") {
    children.push(buildIndividual(record.holder, { includeNationality: true }));
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
            path: `${path}/AcctHolderType`,
            provenance: record.provenance,
            remediation:
              "Supply CRS101, CRS102 or CRS103. This classification determines whether controlling persons must be reported and must not be assumed.",
          },
        ),
      );
    }
  }

  return el("AccountHolder", {}, children);
}

function buildAccountReport(
  planned: PlannedRecord,
  allowSentinel: boolean,
  diagnostics: Diagnostic[],
): XmlElement | undefined {
  const record = planned.account;
  if (!record) return undefined;

  const path = "/CRS_OECD/CrsBody/ReportingGroup/AccountReport";
  const accountType = resolveMandatory(
    record.accountType,
    AccountType.NotReported,
    allowSentinel,
    "Account type (AccountType)",
    `${path}/AccountType`,
    record,
    diagnostics,
  );
  const dd = resolveMandatory(
    record.dueDiligence,
    DueDiligence.NotReported,
    allowSentinel,
    "Due diligence procedure (DDProcedure)",
    `${path}/DDProcedure`,
    record,
    diagnostics,
  );

  const jointCount = valueOf(record.jointHolderCount);

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
    buildAccountHolder(record, allowSentinel, diagnostics),
    ...record.controllingPersons.map((cp, i) =>
      buildControllingPerson(cp, allowSentinel, record, i, diagnostics),
    ),
    el("AccountBalance", { currCode: record.balance.currency }, [text(formatAmount(record.balance))]),
    ...record.payments.map((p) =>
      el("Payment", {}, [
        el("Type", {}, [text(p.type)]),
        el("PaymentAmnt", { currCode: p.amount.currency }, [text(formatAmount(p.amount))]),
      ]),
    ),
    dd ? el("DDProcedure", {}, [text(dd)]) : undefined,
    accountType ? el("AccountType", {}, [text(accountType)]) : undefined,
    jointCount !== undefined ? el("JointAccount", {}, [el("Number", {}, [text(String(jointCount))])]) : undefined,
  ]);
}

export const v3Emitter: Emitter = {
  target: "crs-v3.0",

  emit(plan: FilingPlan, options: EmitOptions = {}): EmitResult {
    const diagnostics: Diagnostic[] = [];
    const allowSentinel = sentinelsPermitted(plan.reportingPeriod);

    const sendingCompanyIn = plan.reportingFi.identifiers[0]?.value;
    const timestamp = `${plan.reportingPeriod.end}T00:00:00Z`;

    const fiDocSpec = buildDocSpec(
      plan.reportingFiRecord.docTypeIndic,
      plan.reportingFiRecord.docRefId,
      plan.reportingFiRecord.corrDocRefId,
    );

    const accountReports = plan.accountReports
      .map((r) => buildAccountReport(r, allowSentinel, diagnostics))
      .filter((x): x is XmlElement => x !== undefined);

    // CrsBody may be omitted only for a nil return with no SendingCompanyIN
    // (CTS 80015). We always emit it, which is correct for FI-to-authority
    // domestic reporting where the FI identifies itself.
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
        "xsi:schemaLocation": `${NS.crs} CrsXML_v3.0.xsd`,
        version: "3.0",
      },
      [buildMessageSpec(plan, sendingCompanyIn, timestamp), crsBody],
    );

    return {
      xml: serialize(root, options),
      document: root,
      diagnostics,
    };
  },
};

/** Re-exported for tests that assert on namespace bindings. */
export const V3_NAMESPACES = NS;
