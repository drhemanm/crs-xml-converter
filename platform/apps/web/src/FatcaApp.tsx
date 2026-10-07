import { useEffect, useMemo, useRef, useState } from "react";
import {
  FatcaDocTypeIndic,
  FatcaFilerCategory,
  emitFatcaXml,
  type FatcaFilingInput,
} from "@aeoi/fatca";
import { modeCode, parseRows, type Mode, type Row } from "./fatca-rows.js";
import { validateFatcaStructure } from "./fatca-validator.js";
import { firstUsableSheet, parseSpreadsheet, type ParsedSheet } from "./spreadsheet.js";
import {
  loadRemoteLedger,
  recordRemoteFiling,
  sha256Hex,
  type WorkspaceSelection,
} from "./backend.js";

const TEMPLATE = [
  "account_number,account_number_type,holder_kind,first_name,last_name,holder_name,holder_tin,holder_residence_country,holder_address_country,holder_address_city,holder_address_street,account_holder_type,account_balance,currency,payment_type,payment_amount,payment_currency,doc_ref_id,corr_message_ref_id,corr_doc_ref_id",
  "ACC-001,OECD605,individual,Jane,Doe,,123456789,US,US,New York,1 Main Street,,1000.00,USD,FATCA502,25.00,USD,GIIN.REPLACE-ME-001,,",
].join("\n");

interface Props {
  workspace: WorkspaceSelection | null;
}

async function keyedDigest(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function FatcaApp({ workspace }: Props) {
  const [mode, setMode] = useState<Mode>("new");
  const [giin, setGiin] = useState("");
  const [tan, setTan] = useState("");
  const [fiName, setFiName] = useState("");
  const [fiCity, setFiCity] = useState("Port Louis");
  const [filerCategory, setFilerCategory] = useState<string>("");
  const [period, setPeriod] = useState("2025-12-31");
  const [messageRefId, setMessageRefId] = useState("");
  const [fiDocRefId, setFiDocRefId] = useState("");
  const [corrMessageRefId, setCorrMessageRefId] = useState("");
  const [corrFiDocRefId, setCorrFiDocRefId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [xml, setXml] = useState("");
  const [error, setError] = useState("");
  const [structuralStatus, setStructuralStatus] = useState<string>("");
  const [lastInput, setLastInput] = useState<FatcaFilingInput | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const fileReadVersion = useRef(0);
  const [workspaceHistoryCount, setWorkspaceHistoryCount] = useState(0);

  useEffect(() => {
    let active = true;
    fileReadVersion.current += 1;
    setError("");
    setGiin("");
    setMessageRefId("");
    setFiDocRefId("");
    setCorrMessageRefId("");
    setCorrFiDocRefId("");
    setFileName(null);
    setRows([]);
    setSheets([]);
    setSelectedSheet("");
    if (!workspace) {
      setWorkspaceBusy(false);
      setWorkspaceHistoryCount(0);
      return;
    }
    setTan(workspace.institution.identifier_type === "TAN" ? workspace.institution.identifier_value : "");
    setFiName(workspace.institution.legal_name);
    setFiCity(workspace.institution.city ?? "Port Louis");
    setWorkspaceBusy(true);
    void loadRemoteLedger(workspace.organization.id, workspace.institution.id, "FATCA")
      .then((rows) => { if (active) setWorkspaceHistoryCount(rows.length); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setWorkspaceBusy(false); });
    return () => { active = false; };
  }, [workspace]);

  useEffect(() => {
    setXml("");
    setLastInput(null);
    setStructuralStatus("");
  }, [mode, giin, tan, fiName, fiCity, filerCategory, period, messageRefId, fiDocRefId, corrMessageRefId, corrFiDocRefId, rows, selectedSheet, workspace]);

  useEffect(() => {
    if (!fileName && !giin && !fiName && !xml) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [fileName, giin, fiName, xml]);

  const correcting = mode === "corrected" || mode === "void" || mode === "amended";
  const generatedRefs = useMemo(() => {
    const prefix = giin.trim() || "GIIN";
    return {
      message: `${prefix}.${period.slice(0, 4)}.${crypto.randomUUID()}`,
      fi: `${prefix}.${crypto.randomUUID()}`,
      nil: `${prefix}.${crypto.randomUUID()}`,
    };
  }, [giin, period]);

  const applySheet = (sheet: ParsedSheet) => {
    if (!sheet.rows.length) throw new Error(`Sheet "${sheet.name}" contains no account rows.`);
    setSelectedSheet(sheet.name);
    setRows(sheet.rows as Row[]);
  };

  const readFile = async (file: File) => {
    const version = ++fileReadVersion.current;
    setRows([]);
    setError("");
    setXml("");
    setLastInput(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (version !== fileReadVersion.current) return;
      const usable = firstUsableSheet(parsed);
      setSheets(parsed);
      applySheet(usable);
      setFileName(file.name);
    } catch (e) {
      if (version !== fileReadVersion.current) return;
      setRows([]);
      setSheets([]);
      setSelectedSheet("");
      setFileName(null);
      setError((e as Error).message);
    }
  };

  const generate = async () => {
    setError("");
    setXml("");
    setStructuralStatus("");
    try {
      const msg = messageRefId.trim() || generatedRefs.message;
      const fiRef = fiDocRefId.trim() || generatedRefs.fi;
      if (!giin.trim()) throw new Error("GIIN is required.");
      if (!fiName.trim()) throw new Error("Financial institution name is required.");
      if (!period) throw new Error("Reporting period is required.");
      if (!filerCategory) throw new Error("FATCA filer category is required; select the institution's actual IRS category.");
      if (correcting && (!corrMessageRefId.trim() || !corrFiDocRefId.trim())) {
        throw new Error("Corrected, amended and void filings require the previous MessageRefId and ReportingFI DocRefId.");
      }

      const input: FatcaFilingInput = {
        reportingFi: {
          giin: giin.trim(),
          name: fiName.trim(),
          residenceCountry: "MU",
          filerCategory: filerCategory as FatcaFilerCategory,
          address: { countryCode: "MU", city: fiCity.trim() || "Port Louis" },
        },
        transmittingCountry: "MU",
        receivingCountry: "US",
        reportingPeriod: period,
        timestamp: new Date().toISOString(),
        messageRefId: msg,
        reportingFiDocRefId: fiRef,
        reportingFiDocType: modeCode[mode] as FatcaDocTypeIndic,
      };

      if (correcting) {
        input.corrMessageRefId = corrMessageRefId.trim();
        input.reportingFiCorrMessageRefId = corrMessageRefId.trim();
        input.reportingFiCorrDocRefId = corrFiDocRefId.trim();
      }

      if (mode === "nil") {
        input.nilReport = {
          docRefId: generatedRefs.nil,
          docType: FatcaDocTypeIndic.New,
        };
      } else {
        input.accounts = parseRows(rows, mode);
      }

      const generated = emitFatcaXml(input);
      const structural = validateFatcaStructure(generated);
      if (!structural.valid) {
        throw new Error(`FATCA structural XSD validation failed: ${structural.message}`);
      }
      setStructuralStatus(structural.message);
      setLastInput(input);
      setXml(generated);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveToWorkspace = async () => {
    if (!workspace || !lastInput || !xml) return;
    setWorkspaceBusy(true);
    setError("");
    try {
      const secret = workspace.institution.pseudonym_key;
      if (!secret) {
        throw new Error("Your workspace role can view this institution but is not authorised to prepare FATCA filings.");
      }
      const entries = [];

      entries.push({
        record_kind: "ReportingFI" as const,
        doc_ref_id: lastInput.reportingFiDocRefId,
        doc_type_indic: lastInput.reportingFiDocType,
        ...(lastInput.reportingFiCorrDocRefId ? { corr_doc_ref_id: lastInput.reportingFiCorrDocRefId } : {}),
        business_key: "reporting-fi",
        payload_digest: await sha256Hex(JSON.stringify(lastInput.reportingFi)),
        record_state: "pending" as const,
      });

      if (lastInput.nilReport) {
        entries.push({
          record_kind: "NilReport" as const,
          doc_ref_id: lastInput.nilReport.docRefId,
          doc_type_indic: lastInput.nilReport.docType,
          ...(lastInput.nilReport.corrDocRefId ? { corr_doc_ref_id: lastInput.nilReport.corrDocRefId } : {}),
          business_key: "nil-report",
          payload_digest: await sha256Hex(JSON.stringify(lastInput.nilReport)),
          record_state: "pending" as const,
        });
      }

      for (const item of lastInput.accounts ?? []) {
        entries.push({
          record_kind: "AccountReport" as const,
          doc_ref_id: item.docRefId,
          doc_type_indic: item.docType,
          ...(item.corrDocRefId ? { corr_doc_ref_id: item.corrDocRefId } : {}),
          business_key: (await keyedDigest(secret, item.record.accountNumber)).slice(0, 32),
          payload_digest: await keyedDigest(secret, JSON.stringify(item.record)),
          record_state: "pending" as const,
        });
      }

      await recordRemoteFiling({
        organizationId: workspace.organization.id,
        institutionId: workspace.institution.id,
        regime: "FATCA",
        reportingPeriodEnd: period,
        schemaVersion: "fatca-v2.0.1-prevalidation",
        filingKind:
          mode === "corrected" ? "correction" :
          mode === "amended" ? "amended" :
          mode === "void" ? "void" :
          mode === "nil" ? "nil" : "new",
        messageRefId: lastInput.messageRefId,
        xmlSha256: await sha256Hex(xml),
        entries,
      });
      const history = await loadRemoteLedger(workspace.organization.id, workspace.institution.id, "FATCA");
      setWorkspaceHistoryCount(history.length);
    } catch (e) {
      setError(`Could not save FATCA filing metadata: ${(e as Error).message}`);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fatca-mauritius-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXml = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fatca-MU-${period}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shell" onChange={() => setError("")}>
      <header className="masthead">
        <h1>FATCA reporting</h1>
        <p>Prepare Mauritius FATCA XML for submission through MRA eServices.</p>
        <div className="privacy-note">
          <strong>Account data stays in this browser.</strong> CSV/XLSX data is parsed and the XML is generated locally.
          MRA requires Mauritius FIs to submit FATCA XML to MRA using the FI's GIIN credentials.
        </div>
      </header>

      <div className="filing-guidance"><strong>Your filing workflow</strong><p>Choose a filing type, confirm the institution and review your account data. Generated files remain in pre-validation until controlled MRA acceptance.</p></div>
      <div>
        <section className="card">
          <h2>1. Filing type</h2>
          <div className="mode-grid">
            {(["new", "corrected", "amended", "void", "nil"] as Mode[]).map((x) => (
              <button key={x} type="button" aria-pressed={mode === x} className={mode === x ? "active" : ""} onClick={() => { setMode(x); setXml(""); setError(""); }}>
                {x[0]!.toUpperCase() + x.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>2. Reporting financial institution</h2>
          <div className="form-grid">
            <label>GIIN<input value={giin} onChange={(e) => setGiin(e.target.value)} placeholder="XXXXXX.XXXXX.XX.480" /></label>
            <label>TAN <span className="muted">(workspace reference, not emitted)</span><input value={tan} onChange={(e) => setTan(e.target.value)} /></label>
            <label>Institution name<input value={fiName} onChange={(e) => setFiName(e.target.value)} /></label>
            <label>Institution city<input value={fiCity} onChange={(e) => setFiCity(e.target.value)} /></label>
            <label>Filer category
              <select value={filerCategory} onChange={(e) => setFilerCategory(e.target.value)}>
                <option value="">Select the actual filer category</option>
                {Object.entries(FatcaFilerCategory).map(([name, value]) => <option key={value} value={value}>{value} — {name}</option>)}
              </select>
            </label>
            <label>Reporting period<input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
            <label>MessageRefId <span className="muted">(auto if blank)</span><input value={messageRefId} onChange={(e) => setMessageRefId(e.target.value)} /></label>
            <label>ReportingFI DocRefId <span className="muted">(auto if blank)</span><input value={fiDocRefId} onChange={(e) => setFiDocRefId(e.target.value)} /></label>
          </div>
          {correcting && (
            <div className="form-grid">
              <label>Previous MessageRefId<input value={corrMessageRefId} onChange={(e) => setCorrMessageRefId(e.target.value)} /></label>
              <label>Previous ReportingFI DocRefId<input value={corrFiDocRefId} onChange={(e) => setCorrFiDocRefId(e.target.value)} /></label>
            </div>
          )}
        </section>

        {mode !== "nil" && (
          <section className="card">
            <h2>3. Account data</h2>
            <p>Use the controlled template. For corrected, amended or void records, include the prior message and document reference IDs in each row.</p>
            <div className="actions">
              <button type="button" onClick={downloadTemplate}>Download FATCA template</button>
              <label className="button upload-button">
                Upload CSV / XLSX
                <input aria-label="Upload FATCA account data" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
              </label>
            </div>
            {fileName && <p><strong>{fileName}</strong> — {rows.length} row(s) loaded.</p>}
            {sheets.length > 1 ? (
              <label>Workbook sheet
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    const sheet = sheets.find((s) => s.name === e.target.value);
                    if (sheet) {
                      try { applySheet(sheet); setError(""); }
                      catch (err) { setError((err as Error).message); }
                    }
                  }}
                >
                  {sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name} disabled={!sheet.rows.length}>
                      {sheet.name}{sheet.rows.length ? ` — ${sheet.rows.length} row(s)` : " (empty)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
        )}

        <section className="card">
          <h2>{mode === "nil" ? "3" : "4"}. Generate</h2>
          <div className="readiness-grid" aria-label="FATCA filing readiness">
            <div className="readiness-item"><span className={giin && fiName && filerCategory ? "state live" : "state pending"}>{giin && fiName && filerCategory ? "ready" : "needed"}</span><strong>FI details</strong></div>
            <div className="readiness-item"><span className={mode === "nil" || rows.length ? "state live" : "state pending"}>{mode === "nil" || rows.length ? "ready" : "needed"}</span><strong>Source data</strong></div>
            <div className="readiness-item"><span className={xml ? "state live" : "state pending"}>{xml ? "passed" : "on generate"}</span><strong>v2.0.1 rules</strong></div>
            <div className="readiness-item"><span className={workspace ? "state live" : "state pending"}>{workspace ? "durable" : "local"}</span><strong>Filing history</strong></div>
            <div className="readiness-item"><span className="state pending">pending</span><strong>MRA acceptance</strong></div>
          </div>
          <p className="hint">{!giin.trim() || !fiName.trim() || !filerCategory ? "Enter the GIIN, institution name and actual filer category." : mode !== "nil" && !rows.length ? "Upload account data, or select Nil if there is nothing to report." : "Ready to run schema and reporting checks."}</p>
          <button type="button" className="primary" disabled={workspaceBusy} onClick={() => void generate()}>Generate FATCA XML</button>
          {error && <div className="diagnostic error" role="alert">{error}</div>}
          {xml && (
            <>
              <div className="diagnostic info">
                {structuralStatus}
              </div>
              <div className="diagnostic warning">
                Pre-validation mode: the FATCA v2.0.1 current-rule schema check passed, but this file is not yet authorised for production submission. A controlled MRA acceptance test remains mandatory.
              </div>
              <div className="actions">
                <button type="button" onClick={downloadXml}>Download test XML</button>
                {workspace ? (
                  <button type="button" disabled={workspaceBusy} onClick={() => void saveToWorkspace()}>
                    Save filing metadata to workspace
                  </button>
                ) : null}
              </div>
              {workspace ? (
                <p className="hint">Connected FATCA history: {workspaceHistoryCount} ledger record(s). No account-holder source data is uploaded.</p>
              ) : null}
              <pre className="xml">{xml}</pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
