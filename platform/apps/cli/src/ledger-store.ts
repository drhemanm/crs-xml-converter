/**
 * File-backed ledger persistence for the CLI.
 *
 * Deliberately trivial — a JSON file — because the point it demonstrates is
 * architectural, not technological: once the DocRefIds you filed survive the
 * process that filed them, corrections become possible. In production this is
 * a database table with the same shape.
 *
 * Note what is stored: identifiers, states and payload digests. No names, no
 * TINs, no balances. The reference ledger holds no personal data.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { InMemoryLedger, type LedgerEntry } from "@crs/core";

export interface StoredLedger {
  readonly version: 1;
  readonly entries: LedgerEntry[];
}

export function loadLedger(path: string): InMemoryLedger {
  if (!existsSync(path)) return new InMemoryLedger();
  const raw = readFileSync(path, "utf8");
  try {
    const parsed = JSON.parse(raw) as StoredLedger;
    return new InMemoryLedger(parsed.entries ?? []);
  } catch {
    throw new Error(`Ledger at ${path} is corrupt. Refusing to continue — filing without it would risk reusing DocRefIds.`);
  }
}

export function saveLedger(path: string, ledger: InMemoryLedger): void {
  const payload: StoredLedger = { version: 1, entries: [...ledger.all()] };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
