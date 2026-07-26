#!/usr/bin/env node
/**
 * CRS filing CLI.
 *
 * Exists to demonstrate the whole pipeline end to end — ingest, plan, emit,
 * validate, persist — and to make the correction lifecycle tangible: file a
 * return, then correct it in a separate process, and watch the tool derive
 * CorrDocRefId from the ledger rather than asking the user to type a
 * 200-character identifier.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import {
  CounterSequence,
  InMemoryLedger,
  RefIdAllocator,
  applyStatusMessage,
  emitterFor,
  formatDiagnostic,
  hasErrors,
  parseStatusMessage,
  planCorrection,
  planNewFiling,
  planNilReturn,
  sortDiagnostics,
  unsafeBrand,
  validatePlan,
  type AccountRecord,
  type Diagnostic,
  type FilingPlan,
  type PlanContext,
  type ReportingFinancialInstitution,
} from "@crs/core";
import { inferColumns, mapRows, type Row } from "@crs/ingest";
import { deadlineFor, packFor, type JurisdictionPack } from "@crs/jurisdictions";
import { SchemaValidator, describeOutcome } from "@crs/validate";
import { loadLedger, saveLedger } from "./ledger-store.js";

const DEFAULT_LEDGER = ".crs-ledger.json";

// --- tiny argument parser ---------------------------------------------------

interface Args {
  readonly command: string;
  readonly positional: string[];
  readonly flags: Record<string, string | boolean>;
}

function parseArgs(argv: readonly string[]): Args {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { command, positional, flags };
}

const str = (flags: Args["flags"], key: string): string | undefined =>
  typeof flags[key] === "string" ? (flags[key] as string) : undefined;

function required(flags: Args["flags"], key: string): string {
  const v = str(flags, key);
  if (!v) fail(`Missing required flag --${key}`);
  return v;
}

function fail(message: string): never {
  process.stderr.write(`\nError: ${message}\n\n`);
  process.exit(1);
}

// --- reporting --------------------------------------------------------------

const useColour = process.stdout.isTTY === true && !process.env["NO_COLOR"];
const sgr = (code: string): string => (useColour ? `\u001b[${code}m` : "");
const RESET = sgr("0");
const RED = sgr("31");
const YELLOW = sgr("33");
const DIM = sgr("2");
const GREEN = sgr("32");

function printDiagnostics(diagnostics: readonly Diagnostic[]): void {
  if (diagnostics.length === 0) return;
  const sorted = sortDiagnostics(diagnostics);
  process.stdout.write("\n");
  for (const d of sorted) {
    const colour = d.severity === "error" ? RED : d.severity === "warning" ? YELLOW : DIM;
    process.stdout.write(`  ${colour}${d.severity.toUpperCase()}${RESET} ${formatDiagnostic(d)}\n`);
    if (d.authorityCode) process.stdout.write(`        ${DIM}authority code: ${d.authorityCode}${RESET}\n`);
  }
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  process.stdout.write(`\n  ${errors} error(s), ${warnings} warning(s)\n`);
}

// --- shared setup -----------------------------------------------------------

function readRecords(path: string): { records: readonly AccountRecord[]; diagnostics: readonly Diagnostic[] } {
  const source = readFileSync(path, "utf8");
  const rows = parseCsv(source, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
  if (rows.length === 0) fail(`${path} contains no data rows.`);
  const headers = Object.keys(rows[0] ?? {});
  const mapping = inferColumns(headers);
  return mapRows(rows, mapping, { sheet: path });
}

function buildContext(
  ledger: InMemoryLedger,
  pack: JurisdictionPack,
  flags: Args["flags"],
): { ctx: PlanContext; pack: JurisdictionPack } {
  const periodEnd = unsafeBrand.isoDate(str(flags, "period") ?? "2025-12-31");
  const filingDate = unsafeBrand.isoDate(str(flags, "filing-date") ?? new Date().toISOString().slice(0, 10));
  const senderId = required(flags, "fi-id");

  const target = pack.schemaFor(periodEnd, filingDate);

  const fi: ReportingFinancialInstitution = {
    name: required(flags, "fi-name"),
    residenceCountry: pack.code,
    identifiers: [{ value: senderId, type: pack.fiIdentifierType === "GIIN" ? "GIIN" : "TIN", issuedBy: { known: true, value: pack.code } }],
    address: {
      countryCode: pack.code,
      type: "OECD304",
      street: str(flags, "fi-street") ? { known: true, value: str(flags, "fi-street")! } : { known: false },
      city: str(flags, "fi-city") ? { known: true, value: str(flags, "fi-city")! } : { known: false },
      postCode: { known: false },
      countrySubentity: { known: false },
    },
    giin: { known: false },
  };

  // Per-tenant key for the business-key HMAC. In production this is managed;
  // here it is derived from the FI identifier so runs are reproducible.
  const tenantKey = createHmac("sha256", "crs-cli").update(senderId).digest();

  const ctx: PlanContext = {
    ledger,
    allocator: new RefIdAllocator(ledger, new CounterSequence(ledger.all().length + 1)),
    messageRefSpec: pack.messageRefSpec,
    docRefSpec: pack.docRefSpec,
    environment: flags["test"] ? "test" : "production",
    schemaTarget: target,
    reportingPeriod: { end: periodEnd },
    sendingCountry: pack.code,
    receivingCountry: pack.receivingCountry,
    reportingFi: fi,
    senderId,
    now: () => new Date().toISOString(),
    businessKeyOf: (r) => createHmac("sha256", tenantKey).update(r.accountNumber).digest("hex").slice(0, 32),
    payloadDigestOf: (r) => createHmac("sha256", tenantKey).update(JSON.stringify(r)).digest("hex"),
  };

  return { ctx, pack };
}

function emitAndValidate(plan: FilingPlan, pack: JurisdictionPack, outPath: string): boolean {
  const emitter = emitterFor(plan.schemaTarget);
  if (!emitter) {
    fail(
      `No emitter for schema target "${plan.schemaTarget}". ` +
        `${pack.name} requires it for this period, and it has not been implemented — ` +
        `emitting a guessed schema shape would be worse than failing.`,
    );
  }

  const invariants = validatePlan(plan);
  const { xml, diagnostics: emitDiagnostics } = emitter.emit(plan, { encoding: pack.charset });

  const validator = new SchemaValidator();
  const outcome = validator.validate(xml, plan.schemaTarget);

  const all = [...plan.diagnostics, ...invariants, ...emitDiagnostics, ...outcome.diagnostics];
  printDiagnostics(all);

  if (hasErrors(all)) {
    process.stdout.write(`\n  ${RED}Not written.${RESET} Fix the errors above and re-run.\n\n`);
    return false;
  }

  writeFileSync(outPath, xml, "utf8");
  process.stdout.write(`\n  ${GREEN}Wrote${RESET} ${outPath}`);
  process.stdout.write(` ${DIM}(${plan.schemaTarget}, ${describeOutcome(outcome)})${RESET}\n`);
  process.stdout.write(`  MessageRefId: ${plan.messageRefId}\n`);
  process.stdout.write(`  Records: ${plan.accountReports.length}\n\n`);
  return true;
}

// --- commands ---------------------------------------------------------------

function cmdFile(args: Args): void {
  const input = args.positional[0] ?? fail("Usage: file <input.csv> --jurisdiction MU --fi-name ... --fi-id ...");
  const pack = packFor(required(args.flags, "jurisdiction")) ?? fail("Unknown jurisdiction.");
  const ledgerPath = str(args.flags, "ledger") ?? DEFAULT_LEDGER;
  const ledger = loadLedger(ledgerPath);

  const { records, diagnostics: ingestDiagnostics } = readRecords(input);
  if (hasErrors(ingestDiagnostics)) {
    printDiagnostics(ingestDiagnostics);
    process.stdout.write(`\n  ${RED}Ingest failed.${RESET} No filing was produced.\n\n`);
    process.exit(1);
  }

  const { ctx } = buildContext(ledger, pack, args.flags);
  const plan = planNewFiling(ctx, records);
  if (Array.isArray(plan)) {
    printDiagnostics([...ingestDiagnostics, ...plan]);
    process.exit(1);
  }

  const out = str(args.flags, "out") ?? `crs-${pack.code}-${plan.reportingPeriod.end}.xml`;
  printDiagnostics(ingestDiagnostics);
  if (emitAndValidate(plan, pack, out)) {
    ledger.apply(plan.mutations);
    saveLedger(ledgerPath, ledger);
    process.stdout.write(`  ${DIM}Ledger updated: ${ledgerPath}. Records are 'pending' until you record the authority's status message.${RESET}\n`);
    process.stdout.write(`  ${DIM}Deadline for this period: ${deadlineFor(pack, plan.reportingPeriod.end)}${RESET}\n\n`);
  }
}

function cmdCorrect(args: Args): void {
  const input = args.positional[0] ?? fail("Usage: correct <input.csv> --jurisdiction MU --fi-name ... --fi-id ...");
  const pack = packFor(required(args.flags, "jurisdiction")) ?? fail("Unknown jurisdiction.");
  const ledgerPath = str(args.flags, "ledger") ?? DEFAULT_LEDGER;
  const ledger = loadLedger(ledgerPath);

  const { records, diagnostics: ingestDiagnostics } = readRecords(input);
  if (hasErrors(ingestDiagnostics)) {
    printDiagnostics(ingestDiagnostics);
    process.exit(1);
  }

  const { ctx } = buildContext(ledger, pack, args.flags);

  // This is the payoff: the user supplies corrected rows, and the tool finds
  // which DocRefId each one supersedes. Nobody types an identifier.
  const corrections = [];
  const unmatched: string[] = [];
  for (const record of records) {
    const businessKey = ctx.businessKeyOf(record);
    const live = ledger.findLive(businessKey, ctx.reportingPeriod.end, ctx.receivingCountry);
    if (!live) {
      unmatched.push(record.accountNumber);
      continue;
    }
    corrections.push({ record, targetDocRefId: live.docRefId });
  }

  if (unmatched.length > 0) {
    process.stdout.write(
      `\n  ${YELLOW}WARNING${RESET} No accepted record found for: ${unmatched.join(", ")}\n` +
        `  ${DIM}These accounts have no live version to correct. File them as new data instead.${RESET}\n`,
    );
  }
  if (corrections.length === 0) fail("Nothing to correct.");

  const plan = planCorrection(ctx, corrections);
  if (Array.isArray(plan)) {
    printDiagnostics(plan);
    process.exit(1);
  }

  const out = str(args.flags, "out") ?? `crs-${pack.code}-${plan.reportingPeriod.end}-correction.xml`;
  if (emitAndValidate(plan, pack, out)) {
    ledger.apply(plan.mutations);
    saveLedger(ledgerPath, ledger);
    process.stdout.write(`  ${DIM}Corrected ${corrections.length} record(s); each references the version it supersedes.${RESET}\n\n`);
  }
}

function cmdNil(args: Args): void {
  const pack = packFor(required(args.flags, "jurisdiction")) ?? fail("Unknown jurisdiction.");
  const ledgerPath = str(args.flags, "ledger") ?? DEFAULT_LEDGER;
  const ledger = loadLedger(ledgerPath);
  const { ctx } = buildContext(ledger, pack, args.flags);

  const plan = planNilReturn(ctx);
  if (Array.isArray(plan)) {
    printDiagnostics(plan);
    process.exit(1);
  }
  const out = str(args.flags, "out") ?? `crs-${pack.code}-${plan.reportingPeriod.end}-nil.xml`;
  if (emitAndValidate(plan, pack, out)) {
    ledger.apply(plan.mutations);
    saveLedger(ledgerPath, ledger);
  }
}

function cmdStatus(args: Args): void {
  const input = args.positional[0] ?? fail("Usage: status <status-message.xml>");
  const ledgerPath = str(args.flags, "ledger") ?? DEFAULT_LEDGER;
  const ledger = loadLedger(ledgerPath);

  const parsed = parseStatusMessage(readFileSync(input, "utf8"));
  if (Array.isArray(parsed)) {
    printDiagnostics(parsed);
    process.exit(1);
  }

  const result = applyStatusMessage(ledger, parsed);
  printDiagnostics(result.diagnostics);
  ledger.apply(result.mutations);
  saveLedger(ledgerPath, ledger);

  process.stdout.write(`\n  File status: ${parsed.status}\n`);
  process.stdout.write(`  Now correctable (live): ${result.acceptedDocRefIds.length}\n`);
  process.stdout.write(`  Rejected — resubmit as NEW data, not corrections: ${result.rejectedDocRefIds.length}\n\n`);
}

function cmdLedger(args: Args): void {
  const ledgerPath = str(args.flags, "ledger") ?? DEFAULT_LEDGER;
  const ledger = loadLedger(ledgerPath);
  const entries = ledger.all();
  if (entries.length === 0) {
    process.stdout.write("\n  Ledger is empty — nothing has been filed yet.\n\n");
    return;
  }
  process.stdout.write(`\n  ${entries.length} record(s) in ${ledgerPath}\n\n`);
  process.stdout.write(`  ${"STATE".padEnd(11)}${"KIND".padEnd(15)}${"INDIC".padEnd(8)}${"PERIOD".padEnd(12)}DOCREFID\n`);
  for (const e of [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const colour = e.state === "live" ? GREEN : e.state === "rejected" || e.state === "deleted" ? RED : DIM;
    process.stdout.write(
      `  ${colour}${e.state.padEnd(11)}${RESET}${e.kind.padEnd(15)}${e.docTypeIndic.padEnd(8)}${e.reportingPeriodEnd.padEnd(12)}${e.docRefId}\n`,
    );
    if (e.supersededBy) process.stdout.write(`  ${DIM}${"".padEnd(11)}└─ superseded by ${e.supersededBy}${RESET}\n`);
  }
  process.stdout.write("\n");
}

function cmdJurisdictions(): void {
  process.stdout.write("\n  Installed jurisdiction packs:\n\n");
  for (const code of ["MU", "KY", "SG", "IE", "GB"]) {
    const p = packFor(code);
    if (!p) continue;
    const unverified = p.verification.filter((v) => v.confidence === "unverified").length;
    const secondary = p.verification.filter((v) => v.confidence === "secondary").length;
    process.stdout.write(`  ${p.code}  ${p.name.padEnd(18)} ${p.authority}\n`);
    process.stdout.write(
      `      ${DIM}deadline ${String(p.deadline.day).padStart(2, "0")}/${String(p.deadline.month).padStart(2, "0")} · ` +
        `${p.charset} · ${p.fiIdentifierType} · ${secondary} secondary / ${unverified} unverified rule(s)${RESET}\n`,
    );
  }
  process.stdout.write(
    `\n  ${YELLOW}Rules marked secondary or unverified must be confirmed against the primary source before production use.${RESET}\n\n`,
  );
}

function cmdHelp(): void {
  process.stdout.write(`
  CRS filing tool

  Commands
    file <input.csv>      Produce a new-data return (CRS701)
    correct <input.csv>   Produce a correction (CRS702), deriving CorrDocRefId from the ledger
    nil                   Produce a nil return (CRS703)
    status <status.xml>   Record an authority status message and update record states
    ledger                Show what has been filed and its current state
    jurisdictions         List installed jurisdiction packs and rule confidence

  Required flags
    --jurisdiction <CC>   MU, KY, SG, IE, GB
    --fi-name <name>      Reporting financial institution name
    --fi-id <id>          FI identifier (TAN/TIN/UEN/GIIN, per jurisdiction)

  Optional flags
    --period <YYYY-MM-DD> Reporting period end (default 2025-12-31)
    --filing-date <date>  Date of filing; selects the schema (default today)
    --out <path>          Output file
    --ledger <path>       Ledger file (default ${DEFAULT_LEDGER})
    --test                Emit test DocTypeIndic values (OECD10-13)

  Example
    file accounts.csv --jurisdiction MU --fi-name "Banque X" --fi-id MU10203040

`);
}

// --- entry point ------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "file":
      return cmdFile(args);
    case "correct":
      return cmdCorrect(args);
    case "nil":
      return cmdNil(args);
    case "status":
      return cmdStatus(args);
    case "ledger":
      return cmdLedger(args);
    case "jurisdictions":
      return cmdJurisdictions();
    default:
      return cmdHelp();
  }
}

main();
