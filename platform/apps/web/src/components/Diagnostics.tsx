import { formatProvenance, sortDiagnostics, type Diagnostic } from "@crs/core";

/**
 * Diagnostics are the product's main output surface. Each one names the cell it
 * came from and what to do about it — "Sheet1!F14: self-certification status is
 * required" rather than "row 14 has warnings".
 */
export function Diagnostics({
  diagnostics,
  emptyMessage = "No issues found.",
}: {
  diagnostics: readonly Diagnostic[];
  emptyMessage?: string;
}) {
  if (diagnostics.length === 0) return <p className="empty">{emptyMessage}</p>;

  const sorted = sortDiagnostics(diagnostics);
  const errors = sorted.filter((d) => d.severity === "error").length;
  const warnings = sorted.filter((d) => d.severity === "warning").length;

  return (
    <div>
      {sorted.map((d, i) => {
        const where = d.provenance ? formatProvenance(d.provenance) : d.path;
        return (
          <div key={`${d.code}-${i}`} className={`diagnostic ${d.severity}`}>
            <span className="sev">{d.severity}</span>
            <span className="body">
              {where ? <span className="where">{where}</span> : null}
              {d.message}
              <span className="code">{d.code}</span>
              {d.authorityCode ? <span className="code">· {d.authorityCode}</span> : null}
              {d.remediation ? <span className="fix">{d.remediation}</span> : null}
            </span>
          </div>
        );
      })}
      <p className="summary-line">
        {errors} error{errors === 1 ? "" : "s"}, {warnings} warning{warnings === 1 ? "" : "s"}
      </p>
    </div>
  );
}
