/**
 * CRS Status Message ingestion.
 *
 * The OECD publishes a separate schema (`urn:oecd:ties:csm:v1`, root
 * `CRSStatusMessage_OECD`) by which an authority reports, per file, whether it
 * was accepted and which individual records failed — each annotated with the
 * `DocRefIDInError` at fault.
 *
 * This is the load-bearing artefact for corrections. A file can be *Accepted*
 * while still carrying RecordErrors, and the distinction decides the recovery
 * path:
 *
 *   accepted record → correct it with OECD2 (it exists to the authority)
 *   rejected record → resubmit as OECD1  (it never existed to them; sending
 *                     OECD2 fails with CTS 80002, "unknown record")
 *
 * A tool that discards status messages is guessing at CorrDocRefId, and
 * guessing produces exactly the 80000-series errors this module prevents.
 */
import { XMLParser } from "fast-xml-parser";
import type { DocRefId, MessageRefId } from "./brand.js";
import { unsafeBrand } from "./brand.js";
import type { LedgerMutation, LedgerSnapshot } from "./ledger.js";
import { DiagnosticCode, type Diagnostic, error as diagError, info as diagInfo, warning as diagWarning } from "./diagnostics.js";

export type FileAcceptanceStatus = "Accepted" | "Rejected";

export interface FileError {
  readonly code: string;
  readonly details?: string;
}

export interface RecordError {
  readonly code: string;
  readonly details?: string;
  readonly docRefIdsInError: readonly DocRefId[];
  readonly fieldPaths: readonly string[];
}

export interface StatusMessage {
  readonly originalMessageRefId: MessageRefId;
  readonly status: FileAcceptanceStatus;
  readonly fileErrors: readonly FileError[];
  readonly recordErrors: readonly RecordError[];
  readonly validatedBy?: string;
  readonly transmissionId?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Strip namespace prefixes so `crs:MessageRefId` and `MessageRefId` both work;
  // authorities differ in how they prefix, and the shape is unambiguous.
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

/** Normalise fast-xml-parser's "one or many" into always-an-array. */
function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

const asString = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return undefined;
};

export function parseStatusMessage(xml: string): StatusMessage | Diagnostic[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (cause) {
    return [
      diagError(DiagnosticCode.XSD_VALIDATION_FAILED, `Status message is not well-formed XML: ${String(cause)}`),
    ];
  }

  const root = doc["CRSStatusMessage_OECD"] as Record<string, unknown> | undefined;
  if (!root) {
    return [
      diagError(
        DiagnosticCode.XSD_VALIDATION_FAILED,
        "Expected a CRSStatusMessage_OECD root element.",
        { remediation: "Check that this is a CRS Status Message and not a CRS return or a CARF status message." },
      ),
    ];
  }

  const body = root["CrsStatusMessage"] as Record<string, unknown> | undefined;
  const original = body?.["OriginalMessage"] as Record<string, unknown> | undefined;
  const originalRef = asString(original?.["OriginalMessageRefID"] ?? original?.["OriginalMessageRefId"]);
  if (!originalRef) {
    return [
      diagError(
        DiagnosticCode.XSD_VALIDATION_FAILED,
        "Status message does not identify the original MessageRefId it refers to.",
      ),
    ];
  }

  const validation = body?.["ValidationResult"] as Record<string, unknown> | undefined;
  const statusRaw = asString(validation?.["Status"]);
  const status: FileAcceptanceStatus = statusRaw === "Rejected" ? "Rejected" : "Accepted";

  const errors = body?.["ValidationErrors"] as Record<string, unknown> | undefined;

  const fileErrors: FileError[] = toArray(errors?.["FileError"] as unknown).map((e) => {
    const rec = e as Record<string, unknown>;
    const details = asString(rec["Details"]);
    return { code: asString(rec["Code"]) ?? "unknown", ...(details ? { details } : {}) };
  });

  const recordErrors: RecordError[] = toArray(errors?.["RecordError"] as unknown).map((e) => {
    const rec = e as Record<string, unknown>;
    const details = asString(rec["Details"]);
    const docRefs = toArray(rec["DocRefIDInError"] as unknown)
      .map((d) => asString(d))
      .filter((d): d is string => !!d)
      .map(unsafeBrand.docRefId);
    const fields = rec["FieldsInError"] as Record<string, unknown> | undefined;
    const fieldPaths = toArray(fields?.["FieldPath"] as unknown)
      .map((f) => asString(f))
      .filter((f): f is string => !!f);
    return {
      code: asString(rec["Code"]) ?? "unknown",
      ...(details ? { details } : {}),
      docRefIdsInError: docRefs,
      fieldPaths,
    };
  });

  const validatedBy = asString(validation?.["ValidatedBy"]);
  const meta = original?.["FileMetaData"] as Record<string, unknown> | undefined;
  const transmissionId = asString(meta?.["CTSTransmissionID"]);

  return {
    originalMessageRefId: unsafeBrand.messageRefId(originalRef),
    status,
    fileErrors,
    recordErrors,
    ...(validatedBy ? { validatedBy } : {}),
    ...(transmissionId ? { transmissionId } : {}),
  };
}

export interface StatusApplication {
  readonly mutations: readonly LedgerMutation[];
  readonly diagnostics: readonly Diagnostic[];
  /** Records the authority refused. Resubmit these as OECD1, not OECD2. */
  readonly rejectedDocRefIds: readonly DocRefId[];
  /** Records now accepted and therefore correctable. */
  readonly acceptedDocRefIds: readonly DocRefId[];
}

/**
 * Reconcile a status message against the ledger.
 *
 * File rejected  → nothing was recorded; every pending record goes to
 *                  `rejected` and the whole file is resubmitted.
 * File accepted  → pending records become `live` except those named in
 *                  RecordErrors, which become `rejected`.
 */
export function applyStatusMessage(
  ledger: LedgerSnapshot,
  status: StatusMessage,
): StatusApplication {
  const mutations: LedgerMutation[] = [];
  const diagnostics: Diagnostic[] = [];
  const rejected: DocRefId[] = [];
  const accepted: DocRefId[] = [];

  const pending = ledger.all().filter((e) => e.messageRefId === status.originalMessageRefId);

  if (pending.length === 0) {
    diagnostics.push(
      diagWarning(
        DiagnosticCode.MESSAGEREFID_FORMAT,
        `No ledger entries found for MessageRefId "${status.originalMessageRefId}".`,
        { remediation: "This status message may belong to a filing made outside this system." },
      ),
    );
  }

  if (status.status === "Rejected") {
    for (const e of pending) {
      mutations.push({ op: "setState", docRefId: e.docRefId, state: "rejected" });
      rejected.push(e.docRefId);
    }
    for (const fe of status.fileErrors) {
      diagnostics.push(
        diagError(DiagnosticCode.XSD_VALIDATION_FAILED, fe.details ?? `File rejected with code ${fe.code}`, {
          authorityCode: fe.code,
          remediation: "The entire file was rejected; nothing was recorded. Correct the cause and resubmit as a new message.",
        }),
      );
    }
    return { mutations, diagnostics, rejectedDocRefIds: rejected, acceptedDocRefIds: [] };
  }

  const inError = new Set<string>();
  for (const re of status.recordErrors) {
    for (const id of re.docRefIdsInError) inError.add(id);
    diagnostics.push(
      diagError(
        DiagnosticCode.INVALID_VALUE,
        re.details ?? `Record rejected with code ${re.code}`,
        {
          authorityCode: re.code,
          ...(re.fieldPaths[0] ? { path: re.fieldPaths[0] } : {}),
          remediation:
            "This record was not recorded by the authority. Resubmit it as new data (OECD1) — correcting it will fail with 'unknown record'.",
        },
      ),
    );
  }

  for (const e of pending) {
    if (inError.has(e.docRefId)) {
      mutations.push({ op: "setState", docRefId: e.docRefId, state: "rejected" });
      rejected.push(e.docRefId);
    } else {
      mutations.push({ op: "setState", docRefId: e.docRefId, state: "live" });
      accepted.push(e.docRefId);
    }
  }

  if (rejected.length === 0 && pending.length > 0) {
    diagnostics.push(
      diagInfo(
        DiagnosticCode.COLUMN_INFERRED,
        `File accepted. ${accepted.length} record(s) are now live and correctable.`,
      ),
    );
  }

  return { mutations, diagnostics, rejectedDocRefIds: rejected, acceptedDocRefIds: accepted };
}
