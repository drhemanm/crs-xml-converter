import { useCallback, useRef, useState } from "react";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";
import {
  InMemoryLedger,
  RefIdAllocator,
  CounterSequence,
  applyStatusMessage,
  emitterFor,
  hasErrors,
  parseStatusMessage,
  planCorrection,
  planNewFiling,
  planNilReturn,
  unsafeBrand,
  validatePlan,
  type AccountRecord,
  type Diagnostic,
  type FilingPlan,
  type PlanContext,
} from "@crs/core";
import { inferColumns, mapRows, specFor, templateCsv, type ColumnMapping, type Row } from "@crs/ingest";
import { PACKS, deadlineFor, packFor, type JurisdictionPack } from "@crs/jurisdictions";
import { Diagnostics } from "./components/Diagnostics.js";
import { clearLedger, exportLedger, loadLedger, saveLedger } from "./ledger-storage.js";

type Mode = "new" | "correct" | "nil";

interface Settings {
  jurisdiction: string;
  fiName: string;
  fiId: string;
  fiCity: string;
  fiStreet: string;
  periodEnd: string;
  filingDate: string;
}

const today = new Date().toISOString().slice(0, 10);

const DEFAULT_SETTINGS: Settings = {
  jurisdiction: "MU",
  fiName: "",
  fiId: "",
  fiCity: "",
  fiStreet: "",
  periodEnd: "2025-12-31",
  filingDate: today,
};

/**
 * Stable per-account identity, computed with a keyed HMAC via Web Crypto so the
 * ledger never stores an account number in clear. Computed ahead of planning
 * because SubtleCrypto is async and the planner is deliberately synchronous.
 */
async function deriveKeys(
  records: readonly AccountRecord[],
  secret: string,
): Promise<{ businessKeys: Map<string, string>; digests: Map<string, string> }> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret || "unkeyed"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hex = async (input: string): Promise<string> => {
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const businessKeys = new Map<string, string>();
  const digests = new Map<string, string>();
  for (const r of records) {
    businessKeys.set(r.accountNumber, (await hex(r.accountNumber)).slice(0, 32));
    digests.set(r.accountNumber, await hex(JSON.stringify(r)));
  }
  return { businessKeys, digests };
}

export default function App() {
  const [tab, setTab] = useState<"prepare" | "history">("prepare");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<Mode>("new");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [records, setRecords] = useState<readonly AccountRecord[]>([]);
  const [ingestDiagnostics, setIngestDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [output, setOutput] = useState<{ xml: string; plan: FilingPlan; note: string } | null>(null);
  const [outputDiagnostics, setOutputDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [ledgerState, setLedgerState] = useState<{ ledger: InMemoryLedger; error: string | null }>(() => {
    try {
      return { ledger: loadLedger(), error: null };
    } catch (e) {
      return { ledger: new InMemoryLedger(), error: (e as Error).message };
    }
  });
  const [fatal, setFatal] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const statusInput = useRef<HTMLInputElement>(null);

  const ledger = ledgerState.ledger;

  /** Re-read from storage so the view reflects what was actually persisted. */
  const reloadLedger = useCallback(() => {
    try {
      setLedgerState({ ledger: loadLedger(), error: null });
    } catch (e) {
      setLedgerState({ ledger: new InMemoryLedger(), error: (e as Error).message });
    }
  }, []);

  const pack: JurisdictionPack | undefined = packFor(settings.jurisdiction);
  const schemaTarget = pack
    ? pack.schemaFor(unsafeBrand.isoDate(settings.periodEnd), unsafeBrand.isoDate(settings.filingDate))
    : undefined;
  const emitterAvailable = schemaTarget ? emitterFor(schemaTarget) !== undefined : false;

  const readFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setOutput(null);
    setOutputDiagnostics([]);
    try {
      const text = await file.text();
      const rows = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
      if (rows.length === 0) {
        setFatal(`${file.name} contains no data rows.`);
        return;
      }
      const m = inferColumns(Object.keys(rows[0] ?? {}));
      const result = mapRows(rows, m, { sheet: file.name });
      setMapping(m);
      setRecords(result.records);
      setIngestDiagnostics(result.diagnostics);
      setFatal(null);
    } catch (e) {
      setFatal(`Could not read ${file.name}: ${(e as Error).message}`);
    }
  }, []);

  const buildContext = useCallback(
    (
      p: JurisdictionPack,
      businessKeys: Map<string, string>,
      digests: Map<string, string>,
    ): PlanContext => ({
      ledger,
      allocator: new RefIdAllocator(ledger, new CounterSequence(ledger.all().length + 1)),
      messageRefSpec: p.messageRefSpec,
      docRefSpec: p.docRefSpec,
      environment: "production",
      schemaTarget: p.schemaFor(unsafeBrand.isoDate(settings.periodEnd), unsafeBrand.isoDate(settings.filingDate)),
      reportingPeriod: { end: unsafeBrand.isoDate(settings.periodEnd) },
      sendingCountry: p.code,
      receivingCountry: p.receivingCountry,
      senderId: settings.fiId,
      reportingFi: {
        name: settings.fiName,
        residenceCountry: p.code,
        identifiers: [
          {
            value: settings.fiId,
            type: p.fiIdentifierType === "GIIN" ? "GIIN" : "TIN",
            issuedBy: { known: true, value: p.code },
          },
        ],
        address: {
          countryCode: p.code,
          type: "OECD304",
          street: settings.fiStreet ? { known: true, value: settings.fiStreet } : { known: false },
          city: settings.fiCity ? { known: true, value: settings.fiCity } : { known: false },
          postCode: { known: false },
          countrySubentity: { known: false },
        },
        giin: { known: false },
      },
      now: () => new Date().toISOString(),
      businessKeyOf: (r) => businessKeys.get(r.accountNumber) ?? r.accountNumber,
      payloadDigestOf: (r) => digests.get(r.accountNumber) ?? "",
    }),
    [ledger, settings],
  );

  const generate = useCallback(async () => {
    if (!pack) return;
    setFatal(null);

    const { businessKeys, digests } = await deriveKeys(records, settings.fiId);
    const ctx = buildContext(pack, businessKeys, digests);

    let plan: FilingPlan | Diagnostic[];
    let note = "";

    if (mode === "nil") {
      plan = planNilReturn(ctx);
      note = "Nil return — no reportable accounts for this period.";
    } else if (mode === "correct") {
      const corrections = [];
      const unmatched: string[] = [];
      for (const record of records) {
        const key = ctx.businessKeyOf(record);
        const live = ledger.findLive(key, ctx.reportingPeriod.end, ctx.receivingCountry);
        if (!live) unmatched.push(record.accountNumber);
        else corrections.push({ record, targetDocRefId: live.docRefId });
      }
      if (corrections.length === 0) {
        setOutputDiagnostics([
          {
            code: "CORR-002",
            severity: "error",
            message: `No accepted records found to correct${unmatched.length ? `: ${unmatched.join(", ")}` : ""}.`,
            remediation:
              "These accounts have no live version. File them as new data instead — an authority cannot correct a record it never accepted.",
          },
        ]);
        setOutput(null);
        return;
      }
      plan = planCorrection(ctx, corrections);
      note =
        `Correcting ${corrections.length} record(s).` +
        (unmatched.length ? ` ${unmatched.length} had no accepted version and were skipped.` : "");
    } else {
      plan = planNewFiling(ctx, records);
      note = `New information for ${records.length} account(s).`;
    }

    if (Array.isArray(plan)) {
      setOutputDiagnostics(plan);
      setOutput(null);
      return;
    }

    const emitter = emitterFor(plan.schemaTarget);
    if (!emitter) {
      setOutputDiagnostics([
        {
          code: "JUR-002",
          severity: "error",
          message: `${pack.name} requires the "${plan.schemaTarget}" schema for this period, which is not implemented.`,
          remediation:
            "HMRC's combined FATCA/CDOT/CRS schema is a different schema family. Emitting a guessed shape would produce confidently wrong filings, so this fails deliberately.",
        },
      ]);
      setOutput(null);
      return;
    }

    const invariants = validatePlan(plan);
    const { xml, diagnostics: emitDiagnostics } = emitter.emit(plan, { encoding: pack.charset });

    // The libxml2 WebAssembly module is ~1 MB and is only needed once a
    // document exists, so it is loaded on demand rather than at startup.
    const { SchemaValidator, describeOutcome } = await import("@crs/validate");
    const outcome = new SchemaValidator().validate(xml, plan.schemaTarget);
    const all = [...plan.diagnostics, ...invariants, ...emitDiagnostics, ...outcome.diagnostics];

    setOutputDiagnostics(all);
    setOutput(hasErrors(all) ? null : { xml, plan, note: `${note} ${describeOutcome(outcome)}.` });
  }, [pack, records, settings, mode, buildContext, ledger]);

  const recordAsFiled = useCallback(() => {
    if (!output) return;
    ledger.apply(output.plan.mutations);
    saveLedger(ledger);
    reloadLedger();
    setOutput(null);
    setOutputDiagnostics([]);
    setTab("history");
  }, [output, ledger, reloadLedger]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crs-${settings.jurisdiction}-${settings.periodEnd}-${output.plan.messageRefId}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, settings]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([templateCsv({ withExampleRows: true })], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crs-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const applyStatus = useCallback(
    async (file: File) => {
      const parsed = parseStatusMessage(await file.text());
      if (Array.isArray(parsed)) {
        setOutputDiagnostics(parsed);
        return;
      }
      const result = applyStatusMessage(ledger, parsed);
      ledger.apply(result.mutations);
      saveLedger(ledger);
      reloadLedger();
      setOutputDiagnostics(result.diagnostics);
    },
    [ledger, reloadLedger],
  );

  const settingsComplete = settings.fiName.trim() !== "" && settings.fiId.trim() !== "";
  const canGenerate = Boolean(pack) && settingsComplete && (mode === "nil" || records.length > 0);
  const entries = ledger.all();

  return (
    <div className="shell">
      <header className="masthead">
        <h1>CRS filing</h1>
        <p>Prepare, validate and correct CRS/AEOI returns.</p>
        <div className="privacy-note">
          <strong>Account data stays in this browser.</strong> Spreadsheets are parsed, mapped and converted
          locally; the generated XML is produced on this device and never uploaded. You can verify this — open
          your browser's network panel and observe that no request is made while you work.
        </div>
      </header>

      {fatal || ledgerState.error ? (
        <div className="diagnostic error" role="alert">
          <span className="sev">error</span>
          <span className="body">{fatal ?? ledgerState.error}</span>
        </div>
      ) : null}

      <div className="tabs" role="tablist">
        <button role="tab" aria-current={tab === "prepare"} onClick={() => setTab("prepare")}>
          Prepare filing
        </button>
        <button role="tab" aria-current={tab === "history"} onClick={() => setTab("history")}>
          Filing history{entries.length ? ` (${entries.length})` : ""}
        </button>
      </div>

      {tab === "prepare" ? (
        <>
          <section className="step">
            <h2>1 · Reporting institution</h2>
            <div className="panel">
              <div className="grid">
                <div className="field">
                  <label htmlFor="jurisdiction">Filing jurisdiction</label>
                  <select
                    id="jurisdiction"
                    value={settings.jurisdiction}
                    onChange={(e) => setSettings({ ...settings, jurisdiction: e.target.value })}
                  >
                    {PACKS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} — {p.authority}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fi-name">Institution name</label>
                  <input
                    id="fi-name"
                    type="text"
                    value={settings.fiName}
                    onChange={(e) => setSettings({ ...settings, fiName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fi-id">
                    {pack ? `Institution ${pack.fiIdentifierType}` : "Institution identifier"}
                  </label>
                  <input
                    id="fi-id"
                    type="text"
                    value={settings.fiId}
                    onChange={(e) => setSettings({ ...settings, fiId: e.target.value })}
                  />
                  {pack ? <p className="hint">{pack.name} identifies filers by {pack.fiIdentifierType}.</p> : null}
                </div>
                <div className="field">
                  <label htmlFor="fi-city">Institution city</label>
                  <input
                    id="fi-city"
                    type="text"
                    value={settings.fiCity}
                    onChange={(e) => setSettings({ ...settings, fiCity: e.target.value })}
                  />
                  <p className="hint">Required — City is mandatory in the OECD address type.</p>
                </div>
                <div className="field">
                  <label htmlFor="period-end">Reporting period end</label>
                  <input
                    id="period-end"
                    type="date"
                    value={settings.periodEnd}
                    onChange={(e) => setSettings({ ...settings, periodEnd: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="filing-date">Filing date</label>
                  <input
                    id="filing-date"
                    type="date"
                    value={settings.filingDate}
                    onChange={(e) => setSettings({ ...settings, filingDate: e.target.value })}
                  />
                  <p className="hint">Determines the schema — several authorities switch on 1 Jan 2027.</p>
                </div>
              </div>

              {pack && schemaTarget ? (
                <dl className="kv">
                  <div>
                    <dt>Schema</dt>
                    <dd>{schemaTarget}{emitterAvailable ? "" : " (not implemented)"}</dd>
                  </div>
                  <div>
                    <dt>ReceivingCountry</dt>
                    <dd>{pack.receivingCountry}</dd>
                  </div>
                  <div>
                    <dt>Character set</dt>
                    <dd>{pack.charset}</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{deadlineFor(pack, unsafeBrand.isoDate(settings.periodEnd))}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </section>

          <section className="step">
            <h2>2 · Filing type</h2>
            <div className="panel">
              <div className="actions" style={{ marginTop: 0 }}>
                {(["new", "correct", "nil"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    className={mode === m ? "primary" : ""}
                    onClick={() => {
                      setMode(m);
                      setOutput(null);
                      setOutputDiagnostics([]);
                    }}
                  >
                    {m === "new" ? "New information" : m === "correct" ? "Correction" : "Nil return"}
                  </button>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                {mode === "new"
                  ? "CRS701. Accounts not previously reported for this period."
                  : mode === "correct"
                    ? "CRS702. Upload the corrected rows — the DocRefId each one supersedes is derived from your filing history, so you never type an identifier."
                    : "CRS703. Declares that there is nothing to report."}
              </p>
            </div>
          </section>

          {mode !== "nil" ? (
            <section className="step">
              <h2>3 · Account data</h2>
              <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
                <button onClick={downloadTemplate}>Download CSV template</button>
                <span className="hint">
                  Every recognised column, with two worked example rows. Column names are matched
                  case-insensitively and ignore spaces, underscores and hyphens.
                </span>
              </div>
              <div
                className={`dropzone${dragOver ? " over" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void readFile(f);
                }}
              >
                {fileName ? (
                  <p>
                    <span className="file">{fileName}</span> — {records.length} record(s) mapped
                  </p>
                ) : (
                  <p>Drop a CSV file here, or click to choose one</p>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                }}
              />

              {mapping ? (
                <>
                  <h2 style={{ marginTop: 24 }}>Column mapping</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Your column</th>
                          <th>Mapped to</th>
                          <th>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...mapping.matches.values()].map((m) => (
                          <tr key={m.header}>
                            <td className="mono">{m.header}</td>
                            <td>{specFor(m.field)?.label ?? m.field}</td>
                            <td>{m.kind}</td>
                          </tr>
                        ))}
                        {mapping.unmatchedHeaders.map((h) => (
                          <tr key={h}>
                            <td className="mono">{h}</td>
                            <td style={{ color: "var(--fg-muted)" }}>not mapped — ignored</td>
                            <td>—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h2 style={{ marginTop: 24 }}>Data review</h2>
                  <Diagnostics diagnostics={ingestDiagnostics} emptyMessage="All rows mapped cleanly." />
                </>
              ) : null}
            </section>
          ) : null}

          <section className="step">
            <h2>{mode === "nil" ? "3" : "4"} · Generate</h2>
            <div className="panel">
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="primary" disabled={!canGenerate} onClick={() => void generate()}>
                  Generate return
                </button>
                {!settingsComplete ? (
                  <span className="hint">Institution name and identifier are required.</span>
                ) : null}
              </div>

              {outputDiagnostics.length > 0 ? (
                <div style={{ marginTop: 18 }}>
                  <Diagnostics diagnostics={outputDiagnostics} />
                </div>
              ) : null}

              {output ? (
                <div style={{ marginTop: 18 }}>
                  <dl className="kv">
                    <div>
                      <dt>MessageRefId</dt>
                      <dd data-testid="message-ref-id">{output.plan.messageRefId}</dd>
                    </div>
                    <div>
                      <dt>Message type</dt>
                      <dd data-testid="message-type">{output.plan.messageTypeIndic}</dd>
                    </div>
                    <div>
                      <dt>Records</dt>
                      <dd data-testid="record-count">{output.plan.accountReports.length}</dd>
                    </div>
                  </dl>
                  <p className="summary-line">{output.note}</p>
                  <pre className="xml">{output.xml}</pre>
                  <div className="actions">
                    <button className="primary" onClick={download}>
                      Download XML
                    </button>
                    <button onClick={recordAsFiled}>Record as submitted</button>
                    <span className="hint">
                      Recording writes the DocRefIds to your filing history so this return can be corrected later.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <section className="step">
          <h2>Filing history</h2>
          {entries.length === 0 ? (
            <div className="panel">
              <p className="empty">
                Nothing filed yet. Once you record a return, its DocRefIds appear here — that history is what
                makes corrections possible.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>Kind</th>
                      <th>Indicator</th>
                      <th>Period</th>
                      <th>DocRefId</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...entries]
                      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                      .map((e) => (
                        <tr key={e.docRefId}>
                          <td>
                            <span className={`state ${e.state}`}>{e.state}</span>
                          </td>
                          <td>{e.kind}</td>
                          <td className="mono">{e.docTypeIndic}</td>
                          <td className="mono">{e.reportingPeriodEnd}</td>
                          <td className="mono">
                            {e.docRefId}
                            {e.supersededBy ? (
                              <>
                                <br />
                                <span style={{ color: "var(--fg-muted)" }}>→ {e.supersededBy}</span>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="actions">
                <button onClick={() => statusInput.current?.click()}>Apply authority status message</button>
                <input
                  ref={statusInput}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void applyStatus(f);
                  }}
                />
                <button
                  onClick={() => {
                    const blob = new Blob([exportLedger(ledger)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "crs-filing-history.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export history
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Clear filing history? Corrections to past returns will no longer be possible, and DocRefIds may be reused — which authorities reject. Export first.",
                      )
                    ) {
                      clearLedger();
                      reloadLedger();
                    }
                  }}
                >
                  Clear
                </button>
              </div>

              <p className="summary-line">
                Records are <em>pending</em> until you apply the authority's status message. Only <em>live</em>{" "}
                records can be corrected; <em>rejected</em> ones never reached the authority and must be
                re-filed as new information.
              </p>

              {outputDiagnostics.length > 0 ? (
                <div style={{ marginTop: 18 }}>
                  <Diagnostics diagnostics={outputDiagnostics} />
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}
