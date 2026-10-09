import type { AccountRecord } from "./model.js";
import { DiagnosticCode, error, type Diagnostic } from "./diagnostics.js";

/** Compare the reportable payload, not its spreadsheet location or local key.
 * Distinct holders of a joint account remain distinct reports. Property order
 * does not change equality; array order is retained rather than guessed at.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function duplicateAccountDiagnostics(records: readonly AccountRecord[]): Diagnostic[] {
  const firstByPayload = new Map<string, AccountRecord>();
  const diagnostics: Diagnostic[] = [];
  for (const record of records) {
    const { provenance: _provenance, businessKey: _businessKey, ...payload } = record;
    const key = canonical(payload);
    const first = firstByPayload.get(key);
    if (first) {
      diagnostics.push(error(DiagnosticCode.DUPLICATE_ACCOUNT_RECORD,
        `Identical account and holder record already appears at ${first.provenance.sheet}, row ${first.provenance.row}.`,
        { provenance: record.provenance, remediation: "Remove the repeated row before generating the return. Distinct joint holders may be reported separately." }));
    } else firstByPayload.set(key, record);
  }
  return diagnostics;
}
