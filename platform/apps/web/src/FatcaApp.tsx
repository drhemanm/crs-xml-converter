import { useMemo, useState } from "react";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";
import {
  FatcaAccountHolderType,
  FatcaDocTypeIndic,
  FatcaFilerCategory,
  FatcaPaymentType,
  emitFatcaXml,
  type FatcaAccountRecord,
  type FatcaFilingInput,
} from "@aeoi/fatca";
import { validateFatcaStructure } from "./fatca-validator.js";

type Mode = "new" | "corrected" | "void" | "amended" | "nil";

interface Row {
  account_number?: string;
  account_number_type?: string;
  account_closed?: string;
  holder_kind?: string;
  first_name?: string;
  last_name?: string;
  holder_name?: string;
  holder_tin?: string;
  holder_residence_country?: string;
  account_holder_type?: string;
  account_balance?: string;
  currency?: string;
  payment_type?: string;
  payment_amount?: string;
  payment_currency?: string;
  doc_ref_id?: string;
  corr_message_ref_id?: string;
  corr_doc_ref_id?: string;
}

const modeCode: Record<Mode, string> = {
  new: FatcaDocTypeIndic.New,
  corrected: FatcaDocTypeIndic.Corrected,
  void: FatcaDocTypeIndic.Void,
  amended: FatcaDocTypeIndic.Amended,
  nil: FatcaDocTypeIndic.New,
};

function money(value: string, field: string): string {
  const v = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(v)) throw new Error(`${field} must be a decimal amount, e.g. 1234.56`);
  return v;
}

function parseRows(rows: Row[], mode: Exclude<Mode, "nil">): NonNullable<FatcaFilingInput["accounts"]> {
  return rows.map((r, i) => {
    const n = i + 2;
    const holderType = (r.holder_kind || "individual").trim().toLowerCase();
    const organisation = holderType === "organisation" || holderType === "organization";
    const record: FatcaAccountRecord = {
      accountNumber: (r.account_number || "").trim(),
      ...(r.account_number_type?.trim() ? { accountNumberType: r.account_number_type.trim() } : {}),
      ...(r.account_closed?.trim() ? { closed: /^(true|yes|1)$/i.test(r.account_closed.trim()) } : {}),
      holder: organisation
        ? {
            kind: "organisation",
            name: (r.holder_name || "").trim(),
            ...(r.holder_tin?.trim() ? { tin: r.holder_tin.trim() } : {}),
            ...(r.holder_residence_country?.trim()
              ? { residenceCountry: r.holder_residence_country.trim().toUpperCase() }
              : {}),
            holderType:
              (r.account_holder_type?.trim() as FatcaAccountHolderType),
          }
        : {
            kind: "individual",
            firstName: (r.first_name || "").trim(),
            lastName: (r.last_name || "").trim(),
            ...(r.holder_tin?.trim() ? { tin: r.holder_tin.trim() } : {}),
            ...(r.holder_residence_country?.trim()
              ? { residenceCountry: r.holder_residence_country.trim().toUpperCase() }
              : {}),
          },
      balance: money(r.account_balance || "", `Row ${n} account_balance`),
      currency: (r.currency || "").trim().toUpperCase(),
      ...(r.payment_type?.trim() && r.payment_amount?.trim()
        ? {
            payments: [
              {
                type: r.payment_type.trim() as FatcaPaymentType,
                amount: money(r.payment_amount, `Row ${n} payment_amount`),
                currency: (r.payment_currency || r.currency || "").trim().toUpperCase(),
              },
            ],
          }
        : {}),
    };
    if (!record.accountNumber) throw new Error(`Row ${n}: account_number is required`);
    if (!record.currency) throw new Error(`Row ${n}: currency is required`);
    if (record.holder.kind === "individual" && (!record.holder.firstName || !record.holder.lastName)) {
      throw new Error(`Row ${n}: first_name and last_name are required for an individual`);
    }
    if (record.holder.kind === "organisation" && !record.holder.name) {
      throw new Error(`Row ${n}: holder_name is required for an organisation`);
    }
    if (record.holder.kind === "organisation" && !r.account_holder_type?.trim()) {
      throw new Error(
        `Row ${n}: account_holder_type is required for an organisation; the tool will not infer a FATCA classification`,
      );
    }

    const docRefId = (r.doc_ref_id || "").trim();
    if (!docRefId) throw new Error(`Row ${n}: doc_ref_id is required`);
    const correcting = mode !== "new";
    const corrMessageRefId = (r.corr_message_ref_id || "").trim();
    const corrDocRefId = (r.corr_doc_ref_id || "").trim();
    if (correcting && (!corrMessageRefId || !corrDocRefId)) {
      throw new Error(`Row ${n}: correction/amendment/void requires corr_message_ref_id and corr_doc_ref_id`);
    }
    return {
      record,
      docRefId,
      docType: modeCode[mode] as FatcaDocTypeIndic,
      ...(corrMessageRefId ? { corrMessageRefId } : {}),
      ...(corrDocRefId ? { corrDocRefId } : {}),
    };
  });
}

const TEMPLATE = [
  "account_number,account_number_type,holder_kind,first_name,last_name,holder_name,holder_tin,holder_residence_country,account_holder_type,account_balance,currency,payment_type,payment_amount,payment_currency,doc_ref_id,corr_message_ref_id,corr_doc_ref_id",
  "ACC-001,OECD605,individual,Jane,Doe,,123456789,US,,1000.00,USD,FATCA502,25.00,USD,GIIN.REPLACE-ME-001,,",
].join("\n");

export default function FatcaApp() {
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [xml, setXml] = useState("");
  const [error, setError] = useState("");
  const [structuralStatus, setStructuralStatus] = useState<string>("");

  const correcting = mode === "corrected" || mode === "void" || mode === "amended";
  const generatedRefs = useMemo(() => {
    const prefix = giin.trim() || "GIIN";
    return {
      message: `${prefix}.${period.slice(0, 4)}.${crypto.randomUUID()}`,
      fi: `${prefix}.${crypto.randomUUID()}`,
      nil: `${prefix}.${crypto.randomUUID()}`,
    };
  }, [giin, period]);

  const readFile = async (file: File) => {
    setError("");
    setXml("");
    try {
      const text = await file.text();
      const parsed = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
      if (!parsed.length) throw new Error("The file contains no account rows.");
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setRows([]);
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
      setXml(generated);
    } catch (e) {
      setError((e as Error).message);
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
    <div className="shell">
      <header className="masthead">
        <h1>FATCA reporting</h1>
        <p>Prepare Mauritius FATCA XML for submission through MRA eServices.</p>
        <div className="privacy-note">
          <strong>Account data stays in this browser.</strong> The CSV is parsed and the XML is generated locally.
          MRA requires Mauritius FIs to submit FATCA XML to MRA using the FI's GIIN credentials.
        </div>
      </header>

      <main>
        <section className="card">
          <h2>1. Filing type</h2>
          <div className="mode-grid">
            {(["new", "corrected", "amended", "void", "nil"] as Mode[]).map((x) => (
              <button key={x} type="button" className={mode === x ? "active" : ""} onClick={() => { setMode(x); setXml(""); setError(""); }}>
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
              <label className="button">
                Upload CSV
                <input hidden type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
              </label>
            </div>
            {fileName && <p><strong>{fileName}</strong> — {rows.length} row(s) loaded.</p>}
          </section>
        )}

        <section className="card">
          <h2>{mode === "nil" ? "3" : "4"}. Generate</h2>
          <button type="button" className="primary" onClick={() => void generate()}>Generate FATCA XML</button>
          {error && <div className="diagnostic error">{error}</div>}
          {xml && (
            <>
              <div className="diagnostic info">
                {structuralStatus}
              </div>
              <div className="diagnostic warning">
                Pre-validation mode: this file is not yet authorised for production submission. Exact FATCA v2.0.1 validation and an MRA acceptance test remain mandatory.
              </div>
              <div className="actions"><button type="button" onClick={downloadXml}>Download test XML</button></div>
              <pre className="xml">{xml}</pre>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
