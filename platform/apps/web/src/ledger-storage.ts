/**
 * Browser-side ledger persistence.
 *
 * Note what is stored: DocRefIds, states, periods, digests. No names, no TINs,
 * no balances. The reference ledger contains no personal data, which is what
 * lets it be synchronised to a server later without the vendor becoming a
 * processor of account-holder data.
 *
 * The submitted-payload vault described in CONCEPT.md §6.1 — needed for
 * byte-exact correction replay — is not implemented here. Until it is, a
 * correction is rebuilt from the spreadsheet the user supplies, which is why
 * the planner warns when a correction would change nothing.
 */
import { InMemoryLedger, type LedgerEntry } from "@crs/core";

const KEY = "crs.ledger.v1";
const HMAC_KEY = "crs.ledger.hmac.v1";

export function loadLedger(): InMemoryLedger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new InMemoryLedger();
    const parsed = JSON.parse(raw) as { entries?: LedgerEntry[] };
    return new InMemoryLedger(parsed.entries ?? []);
  } catch {
    // A corrupt ledger must not be silently discarded — reusing a DocRefId is
    // a hard rejection, so we surface it rather than starting fresh.
    throw new Error(
      "The stored filing ledger could not be read. Filing without it risks reusing DocRefIds, which authorities reject. Export or clear it before continuing.",
    );
  }
}

export function saveLedger(ledger: InMemoryLedger): void {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, entries: ledger.all() }));
}

export function clearLedger(): void {
  localStorage.removeItem(KEY);
}

export function exportLedger(ledger: InMemoryLedger): string {
  return JSON.stringify({ version: 1, entries: ledger.all() }, null, 2);
}


/**
 * Evaluation-mode per-device HMAC key.
 *
 * Never derive this from TAN/GIIN or another public identifier. A predictable
 * HMAC key turns the ledger's pseudonymous business keys into guessable data.
 * Production replaces this with a per-tenant key managed outside the account
 * data plane.
 */
export function getLocalLedgerHmacSecret(): string {
  const existing = localStorage.getItem(HMAC_KEY);
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = btoa(String.fromCharCode(...bytes));
  localStorage.setItem(HMAC_KEY, secret);
  return secret;
}
