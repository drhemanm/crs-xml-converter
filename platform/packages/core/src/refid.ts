/**
 * Reference identifier allocation.
 *
 * Verified constraints: MessageRefId is stf:StringMin1Max170_Type, DocRefId is
 * stf:StringMin1Max200_Type, and the OECD-family schema annotation specifies
 * that a MessageRefId "must start with the country code of the sending
 * jurisdiction, then the year of the reportable period, then the receiving
 * country code before a unique identifier."
 *
 * Jurisdictions narrow this rather than adopting it verbatim — Singapore
 * requires the DocRefId to begin with the filer's UEN; France's DAC7 profile
 * cuts the 170-character MessageRefId to 88. So format is configuration.
 *
 * Allocation is *deterministic given a counter*, never random. The legacy
 * implementation used `Math.random()`, which cannot guarantee the global
 * uniqueness the standard requires and produced DocRefIds beginning "DOC" —
 * where "DO" is the ISO country code for the Dominican Republic.
 */
import { type Result, ok, err } from "./result.js";
import { type DocRefId, type Iso3166Alpha2, type MessageRefId, docRefId, messageRefId } from "./brand.js";
import type { LedgerSnapshot } from "./ledger.js";

export interface RefIdSpec {
  /** Maximum length, if the jurisdiction narrows the schema limit. */
  readonly maxLength: number;
  /** Literal prefix required before the country code, e.g. a Singapore UEN. */
  readonly requiredPrefix?: (ctx: RefIdContext) => string;
  /** Whether the sending jurisdiction's country code must lead. */
  readonly countryCodeFirst: boolean;
  /** Whether the reporting year must appear after the country code. */
  readonly includeReportingYear: boolean;
  /** Whether the receiving country code follows the year (MessageRefId only). */
  readonly includeReceivingCountry: boolean;
  /** Some authorities compare case-insensitively; we then normalise to upper. */
  readonly caseInsensitive: boolean;
}

export interface RefIdContext {
  readonly sendingCountry: Iso3166Alpha2;
  readonly receivingCountry: Iso3166Alpha2;
  readonly reportingYear: number;
  /** The filer's identifier — GIIN, TIN, UEN or TAN depending on jurisdiction. */
  readonly senderId: string;
}

export const DEFAULT_MESSAGE_REF_SPEC: RefIdSpec = {
  maxLength: 170,
  countryCodeFirst: true,
  includeReportingYear: true,
  includeReceivingCountry: true,
  caseInsensitive: false,
};

export const DEFAULT_DOC_REF_SPEC: RefIdSpec = {
  maxLength: 200,
  countryCodeFirst: true,
  includeReportingYear: true,
  includeReceivingCountry: false,
  caseInsensitive: false,
};

/**
 * Monotonic sequence source. Injected so tests are deterministic and so a
 * production implementation can back it with a database sequence rather than
 * a clock — two filings generated in the same millisecond must not collide.
 */
export interface SequenceSource {
  next(): string;
}

export class CounterSequence implements SequenceSource {
  #n: number;
  readonly #width: number;
  constructor(start = 1, width = 6) {
    this.#n = start;
    this.#width = width;
  }
  next(): string {
    return String(this.#n++).padStart(this.#width, "0");
  }
}

function buildRef(spec: RefIdSpec, ctx: RefIdContext, discriminator: string, unique: string): string {
  const parts: string[] = [];
  const prefix = spec.requiredPrefix?.(ctx);
  if (prefix) parts.push(prefix);
  if (spec.countryCodeFirst) parts.push(ctx.sendingCountry);
  if (spec.includeReportingYear) parts.push(String(ctx.reportingYear));
  if (spec.includeReceivingCountry) parts.push(ctx.receivingCountry);
  if (discriminator) parts.push(discriminator);
  parts.push(unique);
  const raw = parts.join("");
  return spec.caseInsensitive ? raw.toUpperCase() : raw;
}

export interface RefIdError {
  readonly kind: "refid";
  readonly reason: string;
}

/**
 * Allocates identifiers that are unique against everything ever filed.
 *
 * Collisions are resolved by drawing a new sequence value rather than by
 * mutating the format — the format is a jurisdiction requirement and is not
 * ours to bend.
 */
export class RefIdAllocator {
  readonly #ledger: LedgerSnapshot;
  readonly #sequence: SequenceSource;
  /** Guards against collisions *within* a single message, before persistence. */
  readonly #issued = new Set<string>();

  constructor(ledger: LedgerSnapshot, sequence: SequenceSource) {
    this.#ledger = ledger;
    this.#sequence = sequence;
  }

  allocateMessageRefId(spec: RefIdSpec, ctx: RefIdContext): Result<MessageRefId, RefIdError> {
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidate = buildRef(spec, ctx, "", this.#sequence.next());
      if (candidate.length > spec.maxLength) {
        return err({
          kind: "refid",
          reason: `MessageRefId would be ${candidate.length} characters, exceeding this jurisdiction's ${spec.maxLength}-character limit`,
        });
      }
      const branded = messageRefId(candidate);
      if (!branded.ok) return err({ kind: "refid", reason: branded.error.reason });
      if (!this.#ledger.hasMessageRefId(branded.value) && !this.#issued.has(candidate)) {
        this.#issued.add(candidate);
        return ok(branded.value);
      }
    }
    return err({ kind: "refid", reason: "exhausted attempts allocating a unique MessageRefId" });
  }

  allocateDocRefId(spec: RefIdSpec, ctx: RefIdContext, discriminator = ""): Result<DocRefId, RefIdError> {
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidate = buildRef(spec, ctx, discriminator, this.#sequence.next());
      if (candidate.length > spec.maxLength) {
        return err({
          kind: "refid",
          reason: `DocRefId would be ${candidate.length} characters, exceeding this jurisdiction's ${spec.maxLength}-character limit`,
        });
      }
      const branded = docRefId(candidate);
      if (!branded.ok) return err({ kind: "refid", reason: branded.error.reason });
      const key = spec.caseInsensitive ? candidate.toUpperCase() : candidate;
      if (!this.#ledger.hasDocRefId(branded.value) && !this.#issued.has(key)) {
        this.#issued.add(key);
        return ok(branded.value);
      }
    }
    return err({ kind: "refid", reason: "exhausted attempts allocating a unique DocRefId" });
  }
}

/** Check an externally-supplied identifier against a jurisdiction spec. */
export function validateRefIdFormat(
  value: string,
  spec: RefIdSpec,
  ctx: RefIdContext,
): Result<true, RefIdError> {
  if (value.length > spec.maxLength) {
    return err({ kind: "refid", reason: `exceeds the ${spec.maxLength}-character limit for this jurisdiction` });
  }
  const prefix = spec.requiredPrefix?.(ctx);
  if (prefix && !value.startsWith(prefix)) {
    return err({ kind: "refid", reason: `must begin with "${prefix}"` });
  }
  const afterPrefix = prefix ? value.slice(prefix.length) : value;
  if (spec.countryCodeFirst && !afterPrefix.toUpperCase().startsWith(ctx.sendingCountry)) {
    return err({
      kind: "refid",
      reason: `must begin with the sending jurisdiction's country code "${ctx.sendingCountry}"`,
    });
  }
  return ok(true);
}
