/**
 * The filing ledger — the part a competitor cannot clone in a weekend.
 *
 * CRS corrections are keyed on DocRefIds that must be unique "in space and
 * time" and must chain: a second correction references the *first correction's*
 * DocRefId, not the original. None of that is expressible in XSD, and none of
 * it survives a stateless converter. Remembering what you filed is the product.
 *
 * Design: the core is pure. It reads a `LedgerSnapshot` (a synchronous read
 * model the caller has already loaded) and returns `LedgerMutation`s for the
 * caller to persist atomically alongside the submission. That keeps planning
 * testable without a database, and keeps persistence honest — mutations are
 * applied only once a filing is actually produced.
 */
import type { DocRefId, Iso3166Alpha2, IsoDate, MessageRefId } from "./brand.js";
import type { DocTypeIndic, SchemaTarget } from "./lifecycle.js";

/**
 * Lifecycle of one correctable record.
 *
 *   pending    — emitted in a message, authority has not yet acknowledged
 *   live       — accepted; this is the version a correction must reference
 *   superseded — replaced by a later correction (see `supersededBy`)
 *   deleted    — voided via OECD3; terminal, nothing may reference it again
 *   rejected   — the authority refused it; it never existed to them, so a
 *                resubmission is OECD1 *new data*, not OECD2
 */
export type RecordState = "pending" | "live" | "superseded" | "deleted" | "rejected";

export type CorrectableKind = "ReportingFI" | "AccountReport";

export interface LedgerEntry {
  readonly docRefId: DocRefId;
  readonly kind: CorrectableKind;
  readonly state: RecordState;
  readonly messageRefId: MessageRefId;
  readonly reportingPeriodEnd: IsoDate;
  readonly jurisdiction: Iso3166Alpha2;
  readonly schemaTarget: SchemaTarget;
  readonly docTypeIndic: DocTypeIndic;
  /** What this record corrected, if it is itself a correction. */
  readonly corrDocRefId?: DocRefId;
  /** Set when a later correction replaced this version. */
  readonly supersededBy?: DocRefId;
  /** For AccountReport: the ReportingFI it was filed under. */
  readonly parentDocRefId?: DocRefId;
  /**
   * Stable cross-year identity of the underlying account, independent of
   * DocRefId. In production this is an HMAC of the account number under a
   * per-tenant key, so the ledger holds no account identifiers in clear.
   */
  readonly businessKey: string;
  /**
   * Digest of the exact payload submitted. A correction is a full-record
   * replacement, so comparing digests is how we detect that a "correction"
   * would silently amend fields the filer never intended to touch.
   */
  readonly payloadDigest: string;
  readonly createdAt: string;
}

/** Synchronous read model over everything this tenant has ever filed. */
export interface LedgerSnapshot {
  /** Global, perpetual uniqueness — not per-year. */
  hasDocRefId(id: DocRefId): boolean;
  hasMessageRefId(id: MessageRefId): boolean;
  get(id: DocRefId): LedgerEntry | undefined;
  /** The currently-correctable version of a record, if any. */
  findLive(businessKey: string, periodEnd: IsoDate, jurisdiction: Iso3166Alpha2): LedgerEntry | undefined;
  /** Live AccountReports filed under a ReportingFI — needed before a cascade delete. */
  liveChildren(parentDocRefId: DocRefId): readonly LedgerEntry[];
  /** The accepted ReportingFI for a period, whose DocRefId an OECD0 resend must reuse. */
  findLiveReportingFi(periodEnd: IsoDate, jurisdiction: Iso3166Alpha2): LedgerEntry | undefined;
  all(): readonly LedgerEntry[];
}

export type LedgerMutation =
  | { readonly op: "append"; readonly entry: LedgerEntry }
  | { readonly op: "setState"; readonly docRefId: DocRefId; readonly state: RecordState }
  | { readonly op: "supersede"; readonly docRefId: DocRefId; readonly by: DocRefId };

/**
 * Reference in-memory implementation. Production backs this with a database,
 * but the semantics — and the tests — are identical.
 */
export class InMemoryLedger implements LedgerSnapshot {
  readonly #byDocRef = new Map<string, LedgerEntry>();
  readonly #messageRefIds = new Set<string>();

  constructor(entries: readonly LedgerEntry[] = []) {
    for (const e of entries) this.#index(e);
  }

  #index(e: LedgerEntry): void {
    this.#byDocRef.set(e.docRefId, e);
    this.#messageRefIds.add(e.messageRefId);
  }

  hasDocRefId(id: DocRefId): boolean {
    return this.#byDocRef.has(id);
  }

  hasMessageRefId(id: MessageRefId): boolean {
    return this.#messageRefIds.has(id);
  }

  get(id: DocRefId): LedgerEntry | undefined {
    return this.#byDocRef.get(id);
  }

  findLive(businessKey: string, periodEnd: IsoDate, jurisdiction: Iso3166Alpha2): LedgerEntry | undefined {
    for (const e of this.#byDocRef.values()) {
      if (
        e.kind === "AccountReport" &&
        e.businessKey === businessKey &&
        e.reportingPeriodEnd === periodEnd &&
        e.jurisdiction === jurisdiction &&
        e.state === "live"
      ) {
        return e;
      }
    }
    return undefined;
  }

  liveChildren(parentDocRefId: DocRefId): readonly LedgerEntry[] {
    const out: LedgerEntry[] = [];
    for (const e of this.#byDocRef.values()) {
      if (e.kind === "AccountReport" && e.parentDocRefId === parentDocRefId && e.state === "live") {
        out.push(e);
      }
    }
    return out.sort((a, b) => a.docRefId.localeCompare(b.docRefId));
  }

  findLiveReportingFi(periodEnd: IsoDate, jurisdiction: Iso3166Alpha2): LedgerEntry | undefined {
    for (const e of this.#byDocRef.values()) {
      if (
        e.kind === "ReportingFI" &&
        e.reportingPeriodEnd === periodEnd &&
        e.jurisdiction === jurisdiction &&
        e.state === "live"
      ) {
        return e;
      }
    }
    return undefined;
  }

  all(): readonly LedgerEntry[] {
    return [...this.#byDocRef.values()];
  }

  /** Apply mutations. Real implementations do this in one transaction. */
  apply(mutations: readonly LedgerMutation[]): void {
    for (const m of mutations) {
      switch (m.op) {
        case "append":
          this.#index(m.entry);
          break;
        case "setState": {
          const existing = this.#byDocRef.get(m.docRefId);
          if (existing) this.#byDocRef.set(m.docRefId, { ...existing, state: m.state });
          break;
        }
        case "supersede": {
          const existing = this.#byDocRef.get(m.docRefId);
          if (existing) {
            this.#byDocRef.set(m.docRefId, { ...existing, state: "superseded", supersededBy: m.by });
          }
          break;
        }
      }
    }
  }

  /**
   * Walk a correction chain from any version to the current one. Returns the
   * chain in submission order; the last element is what a new correction must
   * reference in CorrDocRefId.
   */
  chain(from: DocRefId): readonly LedgerEntry[] {
    const out: LedgerEntry[] = [];
    const seen = new Set<string>();
    let cursor: DocRefId | undefined = from;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const entry: LedgerEntry | undefined = this.#byDocRef.get(cursor);
      if (!entry) break;
      out.push(entry);
      cursor = entry.supersededBy;
    }
    return out;
  }
}
