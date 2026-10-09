import { InMemoryLedger, type LedgerEntry, type LedgerMutation } from "@crs/core";

// Only pseudonymous reference history and its per-device HMAC key are stored.
// Source spreadsheets, holder details, balances and generated XML stay out.
const DATABASE = "crs-filing-history";
const STORE = "ledger";
const KEY = "current";
const LEGACY_KEY = "crs.ledger.v1";
const LEGACY_HMAC_KEY = "crs.ledger.hmac.v1";

interface StoredLedger {
  version: 2;
  revision: number;
  entries: LedgerEntry[];
  hmacSecret: string;
}
const revisions = new WeakMap<InMemoryLedger, number>();

function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function checkEntries(value: unknown): asserts value is LedgerEntry[] {
  if (!Array.isArray(value) || value.some((e) => !e || typeof e !== "object" ||
    typeof e.docRefId !== "string" || typeof e.messageRefId !== "string" ||
    typeof e.businessKey !== "string" || typeof e.payloadDigest !== "string" ||
    typeof e.reportingPeriodEnd !== "string" || typeof e.jurisdiction !== "string" ||
    typeof e.schemaTarget !== "string" || typeof e.docTypeIndic !== "string" ||
    typeof e.createdAt !== "string" || !["AccountReport", "ReportingFI"].includes(e.kind) ||
    !["pending", "live", "superseded", "deleted", "rejected"].includes(e.state))) {
    throw new Error("Stored filing history is invalid. Restore your exported history before preparing more filings.");
  }
  const ids = new Set(value.map((e) => e.docRefId));
  if (ids.size !== value.length) throw new Error("Stored filing history contains repeated reference IDs.");
}

function initialState(): StoredLedger {
  const raw = localStorage.getItem(LEGACY_KEY);
  const legacySecret = localStorage.getItem(LEGACY_HMAC_KEY);
  let entries: LedgerEntry[] = [];
  if (raw !== null) {
    let parsed: { version?: number; entries?: unknown };
    try { parsed = JSON.parse(raw); } catch { throw new Error("The existing local filing history could not be read. Restore it before continuing."); }
    if (!parsed || parsed.version !== 1) throw new Error("The existing filing history version is unsupported.");
    checkEntries(parsed.entries);
    entries = parsed.entries;
    if (entries.length && !legacySecret) throw new Error("The existing filing history key is missing. Restore the history and its key before preparing corrections.");
  }
  return { version: 2, revision: 0, entries, hmacSecret: legacySecret ?? newSecret() };
}

function checkStored(value: unknown): asserts value is StoredLedger {
  const state = value as Partial<StoredLedger> | null;
  if (!state || state.version !== 2 || !Number.isSafeInteger(state.revision) ||
      state.revision! < 0 || typeof state.hmacSecret !== "string" || state.hmacSecret.length < 32) {
    throw new Error("The stored filing history could not be read. Restore it before continuing.");
  }
  checkEntries(state.entries);
}

/** Read/write transactions serialize tabs. Resolve only after the transaction
 * commits; request success alone is not proof that history was persisted.
 * Never replace corrupt/unavailable history with an apparently empty ledger.
 */
function transaction<R>(operation: (state: StoredLedger) => { result: R; next?: StoredLedger }): Promise<R> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("This browser cannot store filing history. Use a supported browser or a connected workspace.")); return; }
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error ?? new Error("Could not open filing history."));
    opening.onblocked = () => reject(new Error("Close other FilingBridge tabs and retry opening history."));
    opening.onsuccess = () => {
      const db = opening.result;
      db.onversionchange = () => db.close();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let result: R;
      let failure: unknown;
      let migrated = false;
      tx.oncomplete = () => {
        db.close();
        // Keep the old copy until migration has actually committed. Cleanup is
        // best effort: the committed IndexedDB snapshot is authoritative.
        if (migrated) {
          try { localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(LEGACY_HMAC_KEY); } catch { /* committed copy remains intact */ }
        }
        resolve(result);
      };
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("Filing history was not saved. Your previous history is unchanged; retry or export it.")); };
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          const state: StoredLedger = request.result === undefined ? initialState() : request.result;
          checkStored(state);
          const outcome = operation(state);
          result = outcome.result;
          if (outcome.next || request.result === undefined) store.put(outcome.next ?? state, KEY);
          migrated = request.result === undefined;
        } catch (error) { failure = error; tx.abort(); }
      };
    };
  });
}

function snapshot(state: StoredLedger): InMemoryLedger {
  const ledger = new InMemoryLedger(state.entries);
  revisions.set(ledger, state.revision);
  return ledger;
}

export function loadLedger(): Promise<InMemoryLedger> {
  return transaction((state) => ({ result: snapshot(state) }));
}

export function getLocalLedgerHmacSecret(): Promise<string> {
  return transaction((state) => ({ result: state.hmacSecret }));
}

/** Commit a detached candidate; neither a failed write nor a stale browser tab
 * can mutate the displayed snapshot or overwrite another tab's newer history.
 */
export function commitLedgerMutations(base: InMemoryLedger, mutations: readonly LedgerMutation[]): Promise<InMemoryLedger> {
  return transaction((state) => {
    if (revisions.get(base) !== state.revision) {
      throw new Error("Filing history changed in another tab. Reload history and regenerate the return before saving.");
    }
    const candidate = new InMemoryLedger(state.entries);
    candidate.apply(mutations);
    const next: StoredLedger = { ...state, revision: state.revision + 1, entries: [...candidate.all()] };
    checkStored(next);
    return { result: snapshot(next), next };
  });
}

export function clearLedger(): Promise<InMemoryLedger> {
  return transaction((state) => {
    const next: StoredLedger = { ...state, revision: state.revision + 1, entries: [] };
    return { result: snapshot(next), next };
  });
}

export function exportLedger(ledger: InMemoryLedger): string {
  return JSON.stringify({ version: 1, entries: ledger.all() }, null, 2);
}
