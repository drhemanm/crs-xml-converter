/**
 * Jurisdiction profiles.
 *
 * The OECD payload — names, addresses, TINs, balances — is roughly 90-95%
 * identical everywhere. Essentially all divergence concentrates in about six
 * header/identifier fields plus transport. That narrow surface is what a
 * profile captures, and because it decays annually it is the part of the
 * product that must be *maintained* rather than merely written. That is the
 * moat.
 *
 * Every pack carries a `verification` block. A compliance product that cannot
 * say which of its own rules are confirmed against a primary source has the
 * same credibility problem as one that claims "100% compliant" without
 * validating anything.
 */
import type { Iso3166Alpha2, IsoDate } from "@crs/core";
import type { RefIdSpec, SchemaTarget } from "@crs/core";

export type Confidence = "verified" | "secondary" | "unverified";

export interface Verification {
  /** Where the rule came from. */
  readonly source: string;
  readonly confidence: Confidence;
  /** ISO date this was last checked against the source. */
  readonly checkedOn: string;
  readonly note?: string;
}

export interface FilingDeadline {
  /** Month (1-12) and day of the year *following* the reporting period end. */
  readonly month: number;
  readonly day: number;
}

export interface JurisdictionPack {
  readonly code: Iso3166Alpha2;
  readonly name: string;
  readonly authority: string;
  readonly portal?: string;

  /**
   * Which schema a filing must use.
   *
   * Takes the filing date as well as the period because several authorities
   * (UK, Ireland) require the amended schema from 1 January 2027 for *all*
   * submissions, "including submissions relating to previous calendar years".
   * A correction to a 2024 record filed in 2027 is therefore v3.0, not v2.0.
   */
  schemaFor(periodEnd: IsoDate, filingDate: IsoDate): SchemaTarget;

  readonly messageRefSpec: RefIdSpec;
  readonly docRefSpec: RefIdSpec;

  /**
   * What goes in ReceivingCountry. For domestic FI-to-authority reporting this
   * is the filing jurisdiction — NOT the institution's country of residence.
   * Cayman hard-validates it to "KY" regardless of where the entity resides.
   */
  readonly receivingCountry: Iso3166Alpha2;

  /** Which identifier the authority expects for the reporting FI. */
  readonly fiIdentifierType: "GIIN" | "TIN" | "UEN" | "TAN";

  readonly charset: "UTF-8" | "ISO-8859-1";
  readonly maxFileBytes?: number;

  /** Mauritius permits exactly one consolidated file per FI per year. */
  readonly singleConsolidatedFile: boolean;

  readonly deadline: FilingDeadline;

  /** Whether a nil return is required when there is nothing to report. */
  readonly nilReturnRequired: boolean;

  /**
   * Whether the "not reported" sentinels (CRS900, CRS1000, CRS1100, CRS1200,
   * CRS800) may be used for a given reporting period.
   *
   * The OECD sets no cut-off — User Guide v4.0 describes them as a transitional
   * measure for interoperability with the previous schema version, especially
   * for corrections. Individual authorities do impose cut-offs, so this is a
   * per-jurisdiction decision rather than a universal rule.
   */
  sentinelsPermitted(periodEnd: IsoDate): boolean;

  readonly verification: readonly Verification[];
  readonly notes: readonly string[];
}

/** Deadline as a concrete date for a given reporting period. */
export function deadlineFor(pack: JurisdictionPack, periodEnd: IsoDate): string {
  const year = Number(periodEnd.slice(0, 4)) + 1;
  const mm = String(pack.deadline.month).padStart(2, "0");
  const dd = String(pack.deadline.day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
