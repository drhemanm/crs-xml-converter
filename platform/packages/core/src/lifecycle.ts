/**
 * The filing lifecycle: new data, corrections, voids, nil returns, and
 * resubmission after rejection.
 *
 * This module encodes rules that are *not* expressible in XSD and that account
 * for most real-world CRS rejections. Each is annotated with the OECD CTS
 * error code it exists to prevent.
 *
 * The rules that catch people out:
 *   - Correcting an AccountReport requires resending its parent ReportingFI as
 *     OECD0 carrying the SAME DocRefId it had when accepted (CTS 80013).
 *   - Deleting a ReportingFI does not cascade: every live child must be voided
 *     explicitly (CTS 80009).
 *   - CorrDocRefId must reference the *latest* version, not the original
 *     (CTS 80003).
 *   - A message is all-new or all-corrections, never both (CTS 80010).
 *   - Records the authority *rejected* never existed to it, so they are
 *     resubmitted as OECD1 new data — not OECD2 (CTS 80002).
 *   - CorrMessageRefId is forbidden in CRS entirely (CTS 80006/80007).
 */
import type { DocRefId, Iso3166Alpha2, IsoDate, MessageRefId } from "./brand.js";
import type { AccountRecord, ReportingFinancialInstitution, ReportingPeriod } from "./model.js";
import { reportingYear } from "./model.js";
import type { LedgerEntry, LedgerMutation, LedgerSnapshot, CorrectableKind } from "./ledger.js";
import { type Diagnostic, DiagnosticCode, error as diagError, warning as diagWarning } from "./diagnostics.js";
import type { RefIdAllocator, RefIdSpec, RefIdContext } from "./refid.js";

export type Environment = "production" | "test";

/** Which schema family and version a filing targets. */
export type SchemaTarget = "crs-v2.0" | "crs-v3.0" | "uk-combined";

export const DocTypeIndic = {
  Resent: "OECD0",
  New: "OECD1",
  Corrected: "OECD2",
  Deleted: "OECD3",
  TestResent: "OECD10",
  TestNew: "OECD11",
  TestCorrected: "OECD12",
  TestDeleted: "OECD13",
} as const;
export type DocTypeIndic = (typeof DocTypeIndic)[keyof typeof DocTypeIndic];

export const MessageTypeIndic = {
  New: "CRS701",
  Corrections: "CRS702",
  NilReturn: "CRS703",
} as const;
export type MessageTypeIndic = (typeof MessageTypeIndic)[keyof typeof MessageTypeIndic];

const TEST_INDICATORS: ReadonlySet<string> = new Set([
  DocTypeIndic.TestResent,
  DocTypeIndic.TestNew,
  DocTypeIndic.TestCorrected,
  DocTypeIndic.TestDeleted,
]);

const PRODUCTION_INDICATORS: ReadonlySet<string> = new Set([
  DocTypeIndic.Resent,
  DocTypeIndic.New,
  DocTypeIndic.Corrected,
  DocTypeIndic.Deleted,
]);

export const isTestIndicator = (d: DocTypeIndic): boolean => TEST_INDICATORS.has(d);

/** Map a production indicator to its test-environment counterpart. */
export function forEnvironment(d: DocTypeIndic, env: Environment): DocTypeIndic {
  if (env === "production") return d;
  switch (d) {
    case DocTypeIndic.Resent:
      return DocTypeIndic.TestResent;
    case DocTypeIndic.New:
      return DocTypeIndic.TestNew;
    case DocTypeIndic.Corrected:
      return DocTypeIndic.TestCorrected;
    case DocTypeIndic.Deleted:
      return DocTypeIndic.TestDeleted;
    default:
      return d;
  }
}

/** One correctable record as it will appear in the emitted message. */
export interface PlannedRecord {
  readonly kind: CorrectableKind;
  readonly docRefId: DocRefId;
  readonly docTypeIndic: DocTypeIndic;
  readonly corrDocRefId?: DocRefId;
  /** Absent for a ReportingFI resend, and for the FI record itself. */
  readonly account?: AccountRecord;
  readonly businessKey: string;
}

export interface FilingPlan {
  readonly messageRefId: MessageRefId;
  /** When this plan was produced. Emitted as MessageSpec/Timestamp. */
  readonly generatedAt: string;
  readonly messageTypeIndic: MessageTypeIndic;
  readonly environment: Environment;
  readonly schemaTarget: SchemaTarget;
  readonly reportingPeriod: ReportingPeriod;
  readonly sendingCountry: Iso3166Alpha2;
  readonly receivingCountry: Iso3166Alpha2;
  readonly reportingFi: ReportingFinancialInstitution;
  readonly reportingFiRecord: PlannedRecord;
  readonly accountReports: readonly PlannedRecord[];
  readonly diagnostics: readonly Diagnostic[];
  /** Persist these atomically with the submission — never before. */
  readonly mutations: readonly LedgerMutation[];
}

export interface PlanContext {
  readonly ledger: LedgerSnapshot;
  readonly allocator: RefIdAllocator;
  readonly messageRefSpec: RefIdSpec;
  readonly docRefSpec: RefIdSpec;
  readonly environment: Environment;
  readonly schemaTarget: SchemaTarget;
  readonly reportingPeriod: ReportingPeriod;
  readonly sendingCountry: Iso3166Alpha2;
  readonly receivingCountry: Iso3166Alpha2;
  readonly reportingFi: ReportingFinancialInstitution;
  readonly senderId: string;
  /** Injected so plans are reproducible in tests and audits. */
  readonly now: () => string;
  /** Stable per-tenant identity for an account; production uses a keyed HMAC. */
  readonly businessKeyOf: (record: AccountRecord) => string;
  /** Digest of the exact payload, for detecting unintended amendment. */
  readonly payloadDigestOf: (record: AccountRecord) => string;
}

function refIdContext(ctx: PlanContext): RefIdContext {
  return {
    sendingCountry: ctx.sendingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingYear: reportingYear(ctx.reportingPeriod),
    senderId: ctx.senderId,
  };
}

function entryFor(
  ctx: PlanContext,
  planned: PlannedRecord,
  messageRefId: MessageRefId,
  parentDocRefId: DocRefId | undefined,
  payloadDigest: string,
): LedgerEntry {
  return {
    docRefId: planned.docRefId,
    kind: planned.kind,
    state: "pending",
    messageRefId,
    reportingPeriodEnd: ctx.reportingPeriod.end,
    jurisdiction: ctx.receivingCountry,
    schemaTarget: ctx.schemaTarget,
    docTypeIndic: planned.docTypeIndic,
    ...(planned.corrDocRefId ? { corrDocRefId: planned.corrDocRefId } : {}),
    ...(parentDocRefId ? { parentDocRefId } : {}),
    businessKey: planned.businessKey,
    payloadDigest,
    createdAt: ctx.now(),
  };
}

// ---------------------------------------------------------------------------
// New filing (CRS701)
// ---------------------------------------------------------------------------

export function planNewFiling(ctx: PlanContext, records: readonly AccountRecord[]): FilingPlan | Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const rc = refIdContext(ctx);

  if (records.length === 0) {
    return [
      diagError(
        DiagnosticCode.EMPTY_MESSAGE,
        "A new-data filing must contain at least one account report.",
        { remediation: "If there is nothing to report, file a nil return (CRS703) instead." },
      ),
    ];
  }

  const msgRef = ctx.allocator.allocateMessageRefId(ctx.messageRefSpec, rc);
  if (!msgRef.ok) return [diagError(DiagnosticCode.MESSAGEREFID_FORMAT, msgRef.error.reason)];

  // A ReportingFI already accepted for this period is resent as OECD0 with its
  // original DocRefId; otherwise it is new data (CTS 80013, HMRC code 30).
  const existingFi = ctx.ledger.findLiveReportingFi(ctx.reportingPeriod.end, ctx.receivingCountry);
  let fiRecord: PlannedRecord;
  if (existingFi) {
    fiRecord = {
      kind: "ReportingFI",
      docRefId: existingFi.docRefId,
      docTypeIndic: forEnvironment(DocTypeIndic.Resent, ctx.environment),
      businessKey: existingFi.businessKey,
    };
  } else {
    const fiDoc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, "FI");
    if (!fiDoc.ok) return [diagError(DiagnosticCode.DOCREFID_FORMAT, fiDoc.error.reason)];
    fiRecord = {
      kind: "ReportingFI",
      docRefId: fiDoc.value,
      docTypeIndic: forEnvironment(DocTypeIndic.New, ctx.environment),
      businessKey: "reporting-fi",
    };
  }

  const accountReports: PlannedRecord[] = [];
  const mutations: LedgerMutation[] = [];

  for (const record of records) {
    const businessKey = ctx.businessKeyOf(record);

    // Filing new data for an account that already has a live version is almost
    // certainly a mistake — the filer means to correct it.
    const live = ctx.ledger.findLive(businessKey, ctx.reportingPeriod.end, ctx.receivingCountry);
    if (live) {
      diagnostics.push(
        diagWarning(
          DiagnosticCode.DOCREFID_REUSED,
          `Account already has an accepted report for this period (${live.docRefId}).`,
          {
            provenance: record.provenance,
            remediation: "File this as a correction (OECD2) rather than new data, or the authority will hold two versions.",
          },
        ),
      );
    }

    const doc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, "AR");
    if (!doc.ok) {
      diagnostics.push(
        diagError(DiagnosticCode.DOCREFID_FORMAT, doc.error.reason, { provenance: record.provenance }),
      );
      continue;
    }

    const planned: PlannedRecord = {
      kind: "AccountReport",
      docRefId: doc.value,
      docTypeIndic: forEnvironment(DocTypeIndic.New, ctx.environment),
      account: record,
      businessKey,
    };
    accountReports.push(planned);
    mutations.push({
      op: "append",
      entry: entryFor(ctx, planned, msgRef.value, fiRecord.docRefId, ctx.payloadDigestOf(record)),
    });
  }

  if (!existingFi) {
    mutations.unshift({
      op: "append",
      entry: entryFor(ctx, fiRecord, msgRef.value, undefined, "reporting-fi"),
    });
  }

  return {
    messageRefId: msgRef.value,
    generatedAt: ctx.now(),
    messageTypeIndic: MessageTypeIndic.New,
    environment: ctx.environment,
    schemaTarget: ctx.schemaTarget,
    reportingPeriod: ctx.reportingPeriod,
    sendingCountry: ctx.sendingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingFi: ctx.reportingFi,
    reportingFiRecord: fiRecord,
    accountReports,
    diagnostics,
    mutations,
  };
}

// ---------------------------------------------------------------------------
// Corrections and voids (CRS702)
// ---------------------------------------------------------------------------

export interface CorrectionRequest {
  /** The account as it should now read. A correction replaces the whole record. */
  readonly record: AccountRecord;
  /** Which previously-filed record this supersedes. */
  readonly targetDocRefId: DocRefId;
}

export interface DeletionRequest {
  readonly targetDocRefId: DocRefId;
  /** Retained payload of the record being voided — a void carries full content. */
  readonly record: AccountRecord;
}

export function planCorrection(
  ctx: PlanContext,
  corrections: readonly CorrectionRequest[],
  deletions: readonly DeletionRequest[] = [],
): FilingPlan | Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const rc = refIdContext(ctx);

  if (corrections.length === 0 && deletions.length === 0) {
    return [diagError(DiagnosticCode.EMPTY_MESSAGE, "A correction message must contain at least one record.")];
  }

  // The parent must be resent as OECD0 with its original DocRefId. Without an
  // accepted ReportingFI there is nothing to hang a correction on.
  const existingFi = ctx.ledger.findLiveReportingFi(ctx.reportingPeriod.end, ctx.receivingCountry);
  if (!existingFi) {
    return [
      diagError(
        DiagnosticCode.PARENT_RESEND_MISSING,
        "No accepted ReportingFI exists for this reporting period and jurisdiction.",
        {
          remediation:
            "A correction must resend the ReportingFI as OECD0 using the DocRefId the authority accepted. File the original return first.",
          authorityCode: "CTS 80013",
        },
      ),
    ];
  }

  const msgRef = ctx.allocator.allocateMessageRefId(ctx.messageRefSpec, rc);
  if (!msgRef.ok) return [diagError(DiagnosticCode.MESSAGEREFID_FORMAT, msgRef.error.reason)];

  const fiRecord: PlannedRecord = {
    kind: "ReportingFI",
    docRefId: existingFi.docRefId,
    docTypeIndic: forEnvironment(DocTypeIndic.Resent, ctx.environment),
    businessKey: existingFi.businessKey,
  };

  const accountReports: PlannedRecord[] = [];
  const mutations: LedgerMutation[] = [];
  const correctedInThisMessage = new Set<string>();

  const handle = (
    targetDocRefId: DocRefId,
    record: AccountRecord,
    indic: typeof DocTypeIndic.Corrected | typeof DocTypeIndic.Deleted,
  ): void => {
    const target = ctx.ledger.get(targetDocRefId);

    if (!target) {
      diagnostics.push(
        diagError(DiagnosticCode.CORRDOCREFID_UNKNOWN, `Unknown DocRefId "${targetDocRefId}".`, {
          provenance: record.provenance,
          remediation: "CorrDocRefId must reference a record this sender previously filed.",
          authorityCode: "CTS 80002",
        }),
      );
      return;
    }

    if (target.state === "rejected") {
      diagnostics.push(
        diagError(
          DiagnosticCode.CORRDOCREFID_UNKNOWN,
          `Record "${targetDocRefId}" was rejected by the authority and does not exist to it.`,
          {
            provenance: record.provenance,
            remediation: "Resubmit this account as new data (OECD1) instead of correcting it.",
            authorityCode: "CTS 80002",
          },
        ),
      );
      return;
    }

    if (target.state === "deleted") {
      diagnostics.push(
        diagError(DiagnosticCode.CORRDOCREFID_STALE, `Record "${targetDocRefId}" has already been deleted.`, {
          provenance: record.provenance,
          authorityCode: "CTS 80003",
        }),
      );
      return;
    }

    if (target.state === "superseded") {
      diagnostics.push(
        diagError(
          DiagnosticCode.CORRDOCREFID_STALE,
          `Record "${targetDocRefId}" was already corrected; it is no longer the current version.`,
          {
            provenance: record.provenance,
            remediation: target.supersededBy
              ? `Reference the latest version instead: "${target.supersededBy}".`
              : "Reference the most recent accepted version of this record.",
            authorityCode: "CTS 80003",
          },
        ),
      );
      return;
    }

    // A record may be corrected only once per message (CTS 80011).
    if (correctedInThisMessage.has(targetDocRefId)) {
      diagnostics.push(
        diagError(
          DiagnosticCode.DUPLICATE_CORRECTION_IN_MESSAGE,
          `Record "${targetDocRefId}" is corrected more than once in this message.`,
          { provenance: record.provenance, authorityCode: "CTS 80011" },
        ),
      );
      return;
    }

    if (target.reportingPeriodEnd !== ctx.reportingPeriod.end) {
      diagnostics.push(
        diagError(
          DiagnosticCode.MULTIPLE_REPORTING_PERIODS,
          `Record "${targetDocRefId}" belongs to reporting period ${target.reportingPeriodEnd}, not ${ctx.reportingPeriod.end}.`,
          {
            provenance: record.provenance,
            remediation: "A message may carry only one reporting period.",
            authorityCode: "CTS 80012",
          },
        ),
      );
      return;
    }

    // Silent-amendment guard. A correction replaces the entire record, so any
    // field that drifted since the original is filed as a deliberate change.
    if (indic === DocTypeIndic.Corrected) {
      const digest = ctx.payloadDigestOf(record);
      if (digest === target.payloadDigest) {
        diagnostics.push(
          diagWarning(
            DiagnosticCode.INVALID_VALUE,
            "This correction is byte-identical to the record already on file.",
            {
              provenance: record.provenance,
              remediation: "Nothing would change. Remove it from the correction set.",
            },
          ),
        );
      }
    }

    const doc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, indic === DocTypeIndic.Deleted ? "DEL" : "COR");
    if (!doc.ok) {
      diagnostics.push(
        diagError(DiagnosticCode.DOCREFID_FORMAT, doc.error.reason, { provenance: record.provenance }),
      );
      return;
    }

    correctedInThisMessage.add(targetDocRefId);

    const planned: PlannedRecord = {
      kind: "AccountReport",
      docRefId: doc.value,
      docTypeIndic: forEnvironment(indic, ctx.environment),
      corrDocRefId: targetDocRefId,
      account: record,
      businessKey: target.businessKey,
    };
    accountReports.push(planned);
    mutations.push({
      op: "append",
      entry: entryFor(ctx, planned, msgRef.value, existingFi.docRefId, ctx.payloadDigestOf(record)),
    });
    mutations.push({ op: "supersede", docRefId: targetDocRefId, by: doc.value });
    if (indic === DocTypeIndic.Deleted) {
      mutations.push({ op: "setState", docRefId: doc.value, state: "pending" });
    }
  };

  for (const c of corrections) handle(c.targetDocRefId, c.record, DocTypeIndic.Corrected);
  for (const d of deletions) handle(d.targetDocRefId, d.record, DocTypeIndic.Deleted);

  return {
    messageRefId: msgRef.value,
    generatedAt: ctx.now(),
    messageTypeIndic: MessageTypeIndic.Corrections,
    environment: ctx.environment,
    schemaTarget: ctx.schemaTarget,
    reportingPeriod: ctx.reportingPeriod,
    sendingCountry: ctx.sendingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingFi: ctx.reportingFi,
    reportingFiRecord: fiRecord,
    accountReports,
    diagnostics,
    mutations,
  };
}

/**
 * Void an entire ReportingFI.
 *
 * Deletion does not cascade. Every live child must be voided explicitly, in
 * this message or an earlier one (CTS 80009; HMRC code 26). We refuse to build
 * the message unless the caller supplies payloads for all of them, because a
 * void carries the full record content, not a stub.
 */
export function planReportingFiDeletion(
  ctx: PlanContext,
  childPayloads: ReadonlyMap<string, AccountRecord>,
): FilingPlan | Diagnostic[] {
  const rc = refIdContext(ctx);
  const existingFi = ctx.ledger.findLiveReportingFi(ctx.reportingPeriod.end, ctx.receivingCountry);
  if (!existingFi) {
    return [
      diagError(DiagnosticCode.CORRDOCREFID_UNKNOWN, "No accepted ReportingFI exists for this period to delete."),
    ];
  }

  const liveChildren = ctx.ledger.liveChildren(existingFi.docRefId);
  const missing = liveChildren.filter((c) => !childPayloads.has(c.docRefId));
  if (missing.length > 0) {
    return [
      diagError(
        DiagnosticCode.DELETE_PARENT_WITH_LIVE_CHILDREN,
        `Cannot delete the ReportingFI: ${missing.length} account report(s) are still live.`,
        {
          remediation: `Every live AccountReport must be deleted too. Missing payloads for: ${missing
            .map((m) => m.docRefId)
            .join(", ")}`,
          authorityCode: "CTS 80009",
        },
      ),
    ];
  }

  const msgRef = ctx.allocator.allocateMessageRefId(ctx.messageRefSpec, rc);
  if (!msgRef.ok) return [diagError(DiagnosticCode.MESSAGEREFID_FORMAT, msgRef.error.reason)];

  const mutations: LedgerMutation[] = [];
  const accountReports: PlannedRecord[] = [];

  for (const child of liveChildren) {
    const payload = childPayloads.get(child.docRefId);
    if (!payload) continue;
    const doc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, "DEL");
    if (!doc.ok) return [diagError(DiagnosticCode.DOCREFID_FORMAT, doc.error.reason)];
    const planned: PlannedRecord = {
      kind: "AccountReport",
      docRefId: doc.value,
      docTypeIndic: forEnvironment(DocTypeIndic.Deleted, ctx.environment),
      corrDocRefId: child.docRefId,
      account: payload,
      businessKey: child.businessKey,
    };
    accountReports.push(planned);
    mutations.push({
      op: "append",
      entry: entryFor(ctx, planned, msgRef.value, existingFi.docRefId, ctx.payloadDigestOf(payload)),
    });
    mutations.push({ op: "supersede", docRefId: child.docRefId, by: doc.value });
  }

  const fiDoc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, "FIDEL");
  if (!fiDoc.ok) return [diagError(DiagnosticCode.DOCREFID_FORMAT, fiDoc.error.reason)];

  const fiRecord: PlannedRecord = {
    kind: "ReportingFI",
    docRefId: fiDoc.value,
    docTypeIndic: forEnvironment(DocTypeIndic.Deleted, ctx.environment),
    corrDocRefId: existingFi.docRefId,
    businessKey: existingFi.businessKey,
  };
  mutations.push({ op: "append", entry: entryFor(ctx, fiRecord, msgRef.value, undefined, "reporting-fi") });
  mutations.push({ op: "supersede", docRefId: existingFi.docRefId, by: fiDoc.value });

  return {
    messageRefId: msgRef.value,
    generatedAt: ctx.now(),
    messageTypeIndic: MessageTypeIndic.Corrections,
    environment: ctx.environment,
    schemaTarget: ctx.schemaTarget,
    reportingPeriod: ctx.reportingPeriod,
    sendingCountry: ctx.sendingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingFi: ctx.reportingFi,
    reportingFiRecord: fiRecord,
    accountReports,
    diagnostics: [],
    mutations,
  };
}

/** Nil return (CRS703) — mandatory in several jurisdictions even with nothing to report. */
export function planNilReturn(ctx: PlanContext): FilingPlan | Diagnostic[] {
  const rc = refIdContext(ctx);
  const msgRef = ctx.allocator.allocateMessageRefId(ctx.messageRefSpec, rc);
  if (!msgRef.ok) return [diagError(DiagnosticCode.MESSAGEREFID_FORMAT, msgRef.error.reason)];

  const fiDoc = ctx.allocator.allocateDocRefId(ctx.docRefSpec, rc, "FI");
  if (!fiDoc.ok) return [diagError(DiagnosticCode.DOCREFID_FORMAT, fiDoc.error.reason)];

  const fiRecord: PlannedRecord = {
    kind: "ReportingFI",
    docRefId: fiDoc.value,
    docTypeIndic: forEnvironment(DocTypeIndic.New, ctx.environment),
    businessKey: "reporting-fi",
  };

  return {
    messageRefId: msgRef.value,
    generatedAt: ctx.now(),
    messageTypeIndic: MessageTypeIndic.NilReturn,
    environment: ctx.environment,
    schemaTarget: ctx.schemaTarget,
    reportingPeriod: ctx.reportingPeriod,
    sendingCountry: ctx.sendingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingFi: ctx.reportingFi,
    reportingFiRecord: fiRecord,
    accountReports: [],
    diagnostics: [],
    mutations: [{ op: "append", entry: entryFor(ctx, fiRecord, msgRef.value, undefined, "nil-return") }],
  };
}

// ---------------------------------------------------------------------------
// Plan validation — the invariants, checked independently of how a plan was built
// ---------------------------------------------------------------------------

export function validatePlan(plan: FilingPlan): Diagnostic[] {
  const out: Diagnostic[] = [];
  const all: PlannedRecord[] = [plan.reportingFiRecord, ...plan.accountReports];

  // Environment segregation (CTS 50010 / 50011).
  for (const r of all) {
    if (plan.environment === "production" && TEST_INDICATORS.has(r.docTypeIndic)) {
      out.push(
        diagError(
          DiagnosticCode.TEST_INDICATOR_IN_PRODUCTION,
          `Record ${r.docRefId} carries test indicator ${r.docTypeIndic} in a production filing.`,
          { authorityCode: "CTS 50010" },
        ),
      );
    }
    if (plan.environment === "test" && PRODUCTION_INDICATORS.has(r.docTypeIndic)) {
      out.push(
        diagError(
          DiagnosticCode.PRODUCTION_INDICATOR_IN_TEST,
          `Record ${r.docRefId} carries production indicator ${r.docTypeIndic} in a test filing.`,
          { authorityCode: "CTS 50011" },
        ),
      );
    }
  }

  // CorrDocRefId presence/absence (CTS 80004 / 80005 / 80008).
  const CORRECTION_INDICATORS: ReadonlySet<string> = new Set([
    DocTypeIndic.Corrected,
    DocTypeIndic.Deleted,
    DocTypeIndic.TestCorrected,
    DocTypeIndic.TestDeleted,
  ]);
  const NEW_OR_RESEND_INDICATORS: ReadonlySet<string> = new Set([
    DocTypeIndic.New,
    DocTypeIndic.TestNew,
    DocTypeIndic.Resent,
    DocTypeIndic.TestResent,
  ]);

  for (const r of all) {
    const isCorrectionish = CORRECTION_INDICATORS.has(r.docTypeIndic);
    const isNewish = NEW_OR_RESEND_INDICATORS.has(r.docTypeIndic);

    if (isCorrectionish && !r.corrDocRefId) {
      out.push(
        diagError(DiagnosticCode.CORRDOCREFID_MISSING, `${r.docTypeIndic} record ${r.docRefId} has no CorrDocRefId.`, {
          authorityCode: "CTS 80005",
        }),
      );
    }
    if (isNewish && r.corrDocRefId) {
      out.push(
        diagError(
          DiagnosticCode.CORRDOCREFID_FORBIDDEN,
          `${r.docTypeIndic} record ${r.docRefId} must not carry a CorrDocRefId.`,
          { authorityCode: "CTS 80004" },
        ),
      );
    }
  }

  // No mixing new with corrections/deletions (CTS 80010).
  const childIndics = new Set(plan.accountReports.map((r) => r.docTypeIndic));
  const hasNew = childIndics.has(DocTypeIndic.New) || childIndics.has(DocTypeIndic.TestNew);
  const hasCorr =
    childIndics.has(DocTypeIndic.Corrected) ||
    childIndics.has(DocTypeIndic.Deleted) ||
    childIndics.has(DocTypeIndic.TestCorrected) ||
    childIndics.has(DocTypeIndic.TestDeleted);
  if (hasNew && hasCorr) {
    out.push(
      diagError(
        DiagnosticCode.MIXED_NEW_AND_CORRECTED,
        "A message may contain either new records or corrections/deletions, not both.",
        { authorityCode: "CTS 80010" },
      ),
    );
  }

  // MessageTypeIndic must agree with the record indicators (HMRC code 27).
  if (plan.messageTypeIndic === MessageTypeIndic.New && hasCorr) {
    out.push(
      diagError(
        DiagnosticCode.MESSAGETYPE_MISMATCH,
        "MessageTypeIndic is CRS701 (new information) but the message contains corrections or deletions.",
      ),
    );
  }
  if (plan.messageTypeIndic === MessageTypeIndic.Corrections && hasNew) {
    out.push(
      diagError(
        DiagnosticCode.MESSAGETYPE_MISMATCH,
        "MessageTypeIndic is CRS702 (corrections) but the message contains new records.",
      ),
    );
  }
  if (plan.messageTypeIndic === MessageTypeIndic.NilReturn && plan.accountReports.length > 0) {
    out.push(
      diagError(
        DiagnosticCode.MESSAGETYPE_MISMATCH,
        "MessageTypeIndic is CRS703 (nil return) but the message contains account reports.",
      ),
    );
  }

  // DocRefId uniqueness within the message. The ReportingFI resend legitimately
  // reuses its prior id, so it is excluded from this check.
  const seen = new Set<string>();
  for (const r of plan.accountReports) {
    if (seen.has(r.docRefId)) {
      out.push(
        diagError(DiagnosticCode.DOCREFID_REUSED, `DocRefId "${r.docRefId}" appears more than once in this message.`, {
          authorityCode: "CTS 80000",
        }),
      );
    }
    seen.add(r.docRefId);
  }

  return out;
}
