/**
 * The error taxonomy.
 *
 * Every diagnostic carries a stable code, a severity, and — where the problem
 * originated in user data — a pointer back to the exact spreadsheet cell.
 * "Row 14 has warnings" is a toy; "Sheet1!F14: self-certification status is
 * required for reporting periods after 2025-12-31" is a tool.
 */

export type Severity = "error" | "warning" | "info";

/** Where a value came from, so a diagnostic can point at the user's own file. */
export interface Provenance {
  readonly sheet: string;
  /** 1-based, counting the header as row 1 — matches what the user sees. */
  readonly row: number;
  readonly column?: string;
  readonly header?: string;
}

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: Severity;
  readonly message: string;
  /** What the user should do about it. Absent when there is nothing actionable. */
  readonly remediation?: string;
  readonly provenance?: Provenance;
  /** XPath-ish location inside the generated document, when applicable. */
  readonly path?: string;
  /** Authority error code this maps to, when we are mirroring a published rule. */
  readonly authorityCode?: string;
}

/**
 * Stable codes. These are API: they appear in exports, get filtered in the UI,
 * and are referenced in support tickets. Never renumber one.
 *
 * Ranges mirror the OECD CTS families so a diagnostic can be traced to the
 * rejection it is designed to prevent:
 *   DATA-*      our own ingest/mapping problems (no CTS equivalent)
 *   REF-*       reference-id format and uniqueness      (CTS 80000-80001)
 *   CORR-*      correction graph integrity              (CTS 80002-80014)
 *   MSG-*       message-level composition               (CTS 80010-80012, 50009)
 *   JUR-*       jurisdiction profile violations         (varies)
 *   SCHEMA-*    XSD validation failures                 (CTS 50007)
 */
export const DiagnosticCode = {
  // --- ingest / mapping -------------------------------------------------
  MISSING_REQUIRED_COLUMN: "DATA-001",
  MISSING_REQUIRED_VALUE: "DATA-002",
  INVALID_VALUE: "DATA-003",
  AMBIGUOUS_DATE: "DATA-004",
  UNKNOWN_ENUM_VALUE: "DATA-005",
  COLUMN_INFERRED: "DATA-006",
  VALUE_TRUNCATED: "DATA-007",
  NOT_REPORTED_SENTINEL_USED: "DATA-008",

  // --- reference ids ----------------------------------------------------
  DOCREFID_REUSED: "REF-001",
  DOCREFID_FORMAT: "REF-002",
  MESSAGEREFID_REUSED: "REF-003",
  MESSAGEREFID_FORMAT: "REF-004",

  // --- correction graph -------------------------------------------------
  CORRDOCREFID_MISSING: "CORR-001",
  CORRDOCREFID_UNKNOWN: "CORR-002",
  CORRDOCREFID_STALE: "CORR-003",
  CORRDOCREFID_FORBIDDEN: "CORR-004",
  PARENT_RESEND_MISSING: "CORR-005",
  PARENT_RESEND_WRONG_ID: "CORR-006",
  DELETE_PARENT_WITH_LIVE_CHILDREN: "CORR-007",
  DUPLICATE_CORRECTION_IN_MESSAGE: "CORR-008",
  CORRMESSAGEREFID_FORBIDDEN: "CORR-009",

  // --- message composition ---------------------------------------------
  MIXED_NEW_AND_CORRECTED: "MSG-001",
  MULTIPLE_REPORTING_PERIODS: "MSG-002",
  TEST_INDICATOR_IN_PRODUCTION: "MSG-003",
  PRODUCTION_INDICATOR_IN_TEST: "MSG-004",
  MESSAGETYPE_MISMATCH: "MSG-005",
  EMPTY_MESSAGE: "MSG-006",

  // --- jurisdiction profile --------------------------------------------
  RECEIVING_COUNTRY_PINNED: "JUR-001",
  UNSUPPORTED_SCHEMA_FOR_PERIOD: "JUR-002",
  FILE_SIZE_EXCEEDED: "JUR-003",
  CHARSET_VIOLATION: "JUR-004",
  IDENTIFIER_TYPE_MISMATCH: "JUR-005",
  SENTINEL_FORBIDDEN_FOR_PERIOD: "JUR-006",

  // --- schema -----------------------------------------------------------
  XSD_VALIDATION_FAILED: "SCHEMA-001",
  XSD_UNAVAILABLE: "SCHEMA-002",
} as const;

export type DiagnosticCode = (typeof DiagnosticCode)[keyof typeof DiagnosticCode];

export function diagnostic(
  code: DiagnosticCode,
  severity: Severity,
  message: string,
  extra: Omit<Diagnostic, "code" | "severity" | "message"> = {},
): Diagnostic {
  return { code, severity, message, ...extra };
}

export const error = (
  code: DiagnosticCode,
  message: string,
  extra?: Omit<Diagnostic, "code" | "severity" | "message">,
) => diagnostic(code, "error", message, extra);

export const warning = (
  code: DiagnosticCode,
  message: string,
  extra?: Omit<Diagnostic, "code" | "severity" | "message">,
) => diagnostic(code, "warning", message, extra);

export const info = (
  code: DiagnosticCode,
  message: string,
  extra?: Omit<Diagnostic, "code" | "severity" | "message">,
) => diagnostic(code, "info", message, extra);

export const hasErrors = (ds: readonly Diagnostic[]): boolean => ds.some((d) => d.severity === "error");

export function formatProvenance(p: Provenance | undefined): string {
  if (!p) return "";
  const cell = p.column ? `${p.column}${p.row}` : `row ${p.row}`;
  return `${p.sheet}!${cell}`;
}

export function formatDiagnostic(d: Diagnostic): string {
  const where = d.provenance ? `${formatProvenance(d.provenance)}: ` : d.path ? `${d.path}: ` : "";
  const fix = d.remediation ? ` — ${d.remediation}` : "";
  return `[${d.code}] ${where}${d.message}${fix}`;
}

/** Sort errors before warnings, then by source row, for stable report output. */
export function sortDiagnostics(ds: readonly Diagnostic[]): Diagnostic[] {
  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return [...ds].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      (a.provenance?.row ?? 0) - (b.provenance?.row ?? 0) ||
      a.code.localeCompare(b.code),
  );
}
