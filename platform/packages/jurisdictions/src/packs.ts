/**
 * Jurisdiction packs.
 *
 * Confidence labels are load-bearing. Direct fetches to oecd.org, gov.uk,
 * revenue.ie, mra.mu and ditc.ky were blocked during research, so several
 * rules below are marked `secondary` (consistent across independent sources
 * but not read from the primary document) or `unverified`. Nothing here should
 * drive a production filing until the corresponding source has been opened.
 */
import {
  DEFAULT_DOC_REF_SPEC,
  DEFAULT_MESSAGE_REF_SPEC,
  unsafeBrand,
  type IsoDate,
  type RefIdContext,
  type SchemaTarget,
} from "@crs/core";
import type { JurisdictionPack } from "./types.js";

const CHECKED = "2026-07-26";

/** The date from which several authorities require the amended schema for everything. */
const AMENDED_SCHEMA_CUTOVER: IsoDate = unsafeBrand.isoDate("2027-01-01");

/**
 * Shared transition rule: a filing made on or after the cutover uses v3.0
 * regardless of which period it covers; before that, periods from RY2026
 * onward are v3.0 and everything earlier is v2.0.
 */
function standardSchemaFor(periodEnd: IsoDate, filingDate: IsoDate): SchemaTarget {
  if (filingDate >= AMENDED_SCHEMA_CUTOVER) return "crs-v3.0";
  return periodEnd >= "2026-01-01" ? "crs-v3.0" : "crs-v2.0";
}

/** Mauritius — the vendor's home market. */
export const MU: JurisdictionPack = {
  code: unsafeBrand.iso3166("MU"),
  name: "Mauritius",
  authority: "Mauritius Revenue Authority (MRA)",
  portal: "https://eservices13.mra.mu/crsreporting/",
  schemaFor: standardSchemaFor,
  messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
  docRefSpec: DEFAULT_DOC_REF_SPEC,
  receivingCountry: unsafeBrand.iso3166("MU"),
  fiIdentifierType: "TAN",
  charset: "UTF-8",
  singleConsolidatedFile: true,
  deadline: { month: 7, day: 31 },
  nilReturnRequired: true,
  verification: [
    {
      source: "MRA CRS guidance: 'As from 1 February 2021, the CRS User Guide Version 3.0 and CRS XML Schema Version 2.0 are applicable.'",
      confidence: "secondary",
      checkedOn: CHECKED,
      note: "mra.mu was unreachable during research. Confirm before filing.",
    },
    {
      source: "MRA: an FI may upload only one file per reporting year, consolidated across all reportable jurisdictions.",
      confidence: "secondary",
      checkedOn: CHECKED,
    },
    {
      source: "Deadline 31 July, following the MRA's own published cycle (period ends 31 Dec, filed by 31 Jul, exchanged 30 Sep).",
      confidence: "secondary",
      checkedOn: CHECKED,
      note: "One secondary source claimed 30 June; it contradicts MRA's own documents.",
    },
    {
      source: "MRA reportedly states it will not provide an XML conversion tool.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "Highest-value item to verify: it is the core of the local commercial case. See mra.mu/download/CRSFAQ.pdf.",
    },
    {
      source: "MRA has not published a position on adopting schema v3.0.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "schemaFor() currently applies the standard OECD transition; revisit when MRA announces.",
    },
  ],
  notes: [
    "Conformance target published by MRA: eservices13.mra.mu/crsreporting/Sample-Valid.xml",
    "Registration and login are by TAN. FATCA is a separate system on a different host.",
    "MRA encrypts before onward transfer; no FI-side encryption requirement was found.",
  ],
};

/** Cayman Islands — the near-term commercial opening. */
export const KY: JurisdictionPack = {
  code: unsafeBrand.iso3166("KY"),
  name: "Cayman Islands",
  authority: "Department for International Tax Cooperation (DITC)",
  portal: "https://ditc.ky/",
  schemaFor: standardSchemaFor,
  messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
  docRefSpec: DEFAULT_DOC_REF_SPEC,
  receivingCountry: unsafeBrand.iso3166("KY"),
  fiIdentifierType: "GIIN",
  charset: "UTF-8",
  singleConsolidatedFile: false,
  deadline: { month: 7, day: 31 },
  nilReturnRequired: true,
  verification: [
    {
      source: "DITC hard-validates ReceivingCountry to 'KY' regardless of the reporting entity's country of residence; any other value is an error.",
      confidence: "secondary",
      checkedOn: CHECKED,
      note: "This is the case that breaks any implementation deriving ReceivingCountry from FI residence.",
    },
    {
      source: "v2.0 for reporting year 2025 (filed by 31 July 2026); v3.0 for reporting year 2026 (filed by 30 June 2027).",
      confidence: "secondary",
      checkedOn: CHECKED,
    },
    {
      source: "DITC is withdrawing its free CRS XML Generator Tool, reportedly unavailable after 31 July 2026; the portal closes in early August 2026 and reopens with v3.0 support in early 2027.",
      confidence: "secondary",
      checkedOn: CHECKED,
      note: "Reported consistently by Mourant, Maples and Walkers. Commercially the most time-sensitive fact in this file.",
    },
    {
      source: "DITC reportedly requires a correction message's ReportingFI to carry OECD0 with the DocRefId of the most recent return and no CorrDocRefId.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "Consistent with the general OECD0 resend rule. Verify at ditc.ky DITC_Portal_User_Guide.pdf pp.29-31 before relying on it.",
    },
  ],
  notes: [
    "DITC publishes its own XML Schema User Guides layered on the OECD guide.",
    "The 2026 free-tool withdrawal orphans a named cohort of filers who must source a replacement.",
  ],
};

/** Singapore — the best-documented profile, and the strictest DocRefId rule. */
export const SG: JurisdictionPack = {
  code: unsafeBrand.iso3166("SG"),
  name: "Singapore",
  authority: "Inland Revenue Authority of Singapore (IRAS)",
  portal: "https://mytax.iras.gov.sg/",
  schemaFor: (periodEnd, filingDate) =>
    filingDate >= AMENDED_SCHEMA_CUTOVER ? "crs-v3.0" : periodEnd >= "2026-01-01" ? "crs-v3.0" : "crs-v2.0",
  messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
  docRefSpec: {
    ...DEFAULT_DOC_REF_SPEC,
    // IRAS requires the DocRefId to begin with the Reporting SGFI's Singapore
    // tax reference number (UEN), before the country code.
    requiredPrefix: (ctx: RefIdContext) => ctx.senderId,
    countryCodeFirst: false,
  },
  receivingCountry: unsafeBrand.iso3166("SG"),
  fiIdentifierType: "UEN",
  charset: "UTF-8",
  maxFileBytes: 5 * 1024 * 1024,
  singleConsolidatedFile: false,
  deadline: { month: 5, day: 31 },
  nilReturnRequired: true,
  verification: [
    {
      source: "IRAS XML Schema User Guide for CRS Return: DocRefId must start with the Reporting SGFI's Singapore Tax Reference Number and be unique in time and space.",
      confidence: "secondary",
      checkedOn: CHECKED,
    },
    { source: "Maximum XML file size 5 MB; a PDF/fillable option exists for smaller filers.", confidence: "secondary", checkedOn: CHECKED },
    { source: "CRS XML Schema v3.0 mandatory from 1 January 2027. Deadline 31 May.", confidence: "secondary", checkedOn: CHECKED },
    {
      source: "No machine API for AEOI was found; submission appears to be myTax Portal only.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "Treat portal upload as the safe assumption.",
    },
  ],
  notes: ["Filer must be authorised as an AEOI 'Approver' in Corppass.", "No paper submissions accepted."],
};

/** Ireland. */
export const IE: JurisdictionPack = {
  code: unsafeBrand.iso3166("IE"),
  name: "Ireland",
  authority: "Revenue Commissioners",
  portal: "https://www.ros.ie/",
  schemaFor: standardSchemaFor,
  messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
  docRefSpec: DEFAULT_DOC_REF_SPEC,
  receivingCountry: unsafeBrand.iso3166("IE"),
  fiIdentifierType: "TIN",
  charset: "UTF-8",
  singleConsolidatedFile: false,
  deadline: { month: 6, day: 30 },
  nilReturnRequired: true,
  verification: [
    {
      source: "Revenue TDM Part 38-03-26 §7.5 (added 7 July 2025): CRS 2.0 effective 1 January 2027, to be used for all filings — New, Amended and Void — from that date for all periods.",
      confidence: "secondary",
      checkedOn: CHECKED,
      note: "The 'for all periods' clause is why schemaFor() branches on filing date.",
    },
    { source: "v2.0 applies for reporting year 2025, filed by 30 June 2026.", confidence: "secondary", checkedOn: CHECKED },
    {
      source: "Revenue publishes forbidden and restricted character rules in TDM 38-03-26.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "Not yet encoded here. Revenue also publishes a sample correction XML worth using as a golden fixture.",
    },
  ],
  notes: ["Revenue onward-exchanges to partner jurisdictions by 30 September."],
};

/**
 * United Kingdom.
 *
 * The important case: HMRC does not accept plain OECD CRS at all for the 2026
 * season. It requires its own combined FATCA/CDOT/CRS submission schema, which
 * is a different schema family — not a CRS variant. We model that as the
 * `uk-combined` target, for which no emitter exists. Failing loudly is correct:
 * implementing a schema we have never read would produce confidently wrong
 * filings.
 */
export const GB: JurisdictionPack = {
  code: unsafeBrand.iso3166("GB"),
  name: "United Kingdom",
  authority: "HM Revenue & Customs (HMRC)",
  portal: "https://www.gov.uk/guidance/how-to-report-automatic-exchange-of-information",
  schemaFor: (_periodEnd, filingDate) => (filingDate >= AMENDED_SCHEMA_CUTOVER ? "crs-v3.0" : "uk-combined"),
  messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
  docRefSpec: DEFAULT_DOC_REF_SPEC,
  receivingCountry: unsafeBrand.iso3166("GB"),
  fiIdentifierType: "GIIN",
  // The AEOI service accepts only Latin character set 1.
  charset: "ISO-8859-1",
  singleConsolidatedFile: false,
  deadline: { month: 5, day: 31 },
  nilReturnRequired: true,
  verification: [
    {
      source: "IEIM404500: UK FIs uploading directly must submit using the UK submission schema (combined CRS/FATCA).",
      confidence: "verified",
      checkedOn: CHECKED,
    },
    {
      source: "gov.uk guidance updated 23 October 2025: the combined schema is retired after 31 December 2026; from 1 January 2027 all XML submissions must use the amended CRS or FATCA schema, including submissions relating to previous calendar years.",
      confidence: "verified",
      checkedOn: CHECKED,
    },
    { source: "The online system accepts only Latin character set 1 (ISO-8859-1).", confidence: "verified", checkedOn: CHECKED },
    { source: "Filing deadline is 31 May for each year ending 31 December.", confidence: "verified", checkedOn: CHECKED },
    {
      source: "AEOI MessageRefId/DocRefId format rules could not be retrieved.",
      confidence: "unverified",
      checkedOn: CHECKED,
      note: "Do NOT port HMRC's Country-by-Country rules here — different regime. The AEOI user guide PDF is the authority.",
    },
  ],
  notes: [
    "CRS and FATCA must be reported separately from 1 January 2027.",
    "No emitter exists for uk-combined; requesting it fails loudly rather than emitting a guessed shape.",
  ],
};

export const PACKS: readonly JurisdictionPack[] = [MU, KY, SG, IE, GB];

export function packFor(code: string): JurisdictionPack | undefined {
  const upper = code.trim().toUpperCase();
  return PACKS.find((p) => p.code === upper);
}
