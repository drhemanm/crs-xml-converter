/**
 * Element builders shared by the v2.0 and v3.0 emitters.
 *
 * Everything here returns `XmlElement | undefined`, so an absent value produces
 * no element rather than an empty one. That is the mechanical guarantee behind
 * "no fabricated data in regulatory output".
 */
import { el, leaf, text, type XmlElement, type XmlNode } from "../xml.js";
import {
  type Address,
  type BirthInfo,
  type Individual,
  type MonetaryAmount,
  type Organisation,
  type OrganisationIdentifier,
  type PersonName,
  type ReportingFinancialInstitution,
  type TaxIdentification,
  valueOf,
} from "../model.js";
import { DiagnosticCode, error as diagError, type Diagnostic, type Provenance } from "../diagnostics.js";
import type { FilingPlan } from "../lifecycle.js";

/** Collects diagnostics while building a subtree, with a path for locating them. */
export interface EmitCtx {
  readonly diagnostics: Diagnostic[];
  readonly path: string;
  readonly provenance?: Provenance;
}

export const childCtx = (ctx: EmitCtx, segment: string): EmitCtx => ({
  diagnostics: ctx.diagnostics,
  path: `${ctx.path}${segment}`,
  ...(ctx.provenance ? { provenance: ctx.provenance } : {}),
});

export interface EmitOptions {
  readonly indent?: boolean;
  readonly encoding?: "UTF-8" | "ISO-8859-1";
}

export interface EmitResult {
  readonly xml: string;
  readonly document: XmlElement;
  readonly diagnostics: readonly Diagnostic[];
}

export interface Emitter {
  readonly target: string;
  emit(plan: FilingPlan, options?: EmitOptions): EmitResult;
}

/** xnlNameType values used on person name parts. */
export const XNL = {
  Given: "GivenName",
  Family: "FamilyName",
  Middle: "MiddleName",
} as const;

/**
 * CRS amounts are decimal, not floating point. We format from the canonical
 * decimal string rather than re-parsing, so a balance never acquires or loses
 * precision on its way into a filing.
 */
export function formatAmount(a: MonetaryAmount): string {
  const [whole = "0", frac = ""] = a.amount.split(".");
  const cents = (frac + "00").slice(0, 2);
  return `${whole}.${cents}`;
}

/**
 * Address.
 *
 * `City` is mandatory inside `AddressFix` in the OECD common types, so an
 * absent city is an error rather than an omission — otherwise we emit an empty
 * `<AddressFix/>` that the authority's validator will reject. Reporting it here
 * turns a portal rejection days before a deadline into a fixable diagnostic
 * pointing at the row.
 */
export function buildAddress(
  a: Address,
  ctx: { diagnostics: Diagnostic[]; path: string; provenance?: Provenance },
  ns = "cfc",
): XmlElement {
  const city = valueOf(a.city);
  if (city === undefined) {
    ctx.diagnostics.push(
      diagError(DiagnosticCode.MISSING_REQUIRED_VALUE, "City is required within an address.", {
        path: `${ctx.path}/AddressFix/City`,
        ...(ctx.provenance ? { provenance: ctx.provenance } : {}),
        remediation: "Supply a city. The OECD address type makes it mandatory and it must not be substituted.",
      }),
    );
  }

  return el("Address", { legalAddressType: a.type }, [
    el(`${ns}:CountryCode`, {}, [text(a.countryCode)]),
    el(`${ns}:AddressFix`, {}, [
      leaf(`${ns}:Street`, valueOf(a.street)),
      leaf(`${ns}:City`, city),
      leaf(`${ns}:PostCode`, valueOf(a.postCode)),
      leaf(`${ns}:CountrySubentity`, valueOf(a.countrySubentity)),
    ]),
  ]);
}

export function buildPersonName(n: PersonName, nameType = "OECD202"): XmlElement {
  return el("Name", { nameType }, [
    leaf("Title", valueOf(n.title)),
    el("FirstName", { xnlNameType: XNL.Given }, [text(n.firstName)]),
    valueOf(n.middleName) !== undefined
      ? el("MiddleName", { xnlNameType: XNL.Middle }, [text(valueOf(n.middleName) as string)])
      : undefined,
    el("LastName", { xnlNameType: XNL.Family }, [text(n.lastName)]),
    leaf("Suffix", valueOf(n.suffix)),
  ]);
}

export function buildTins(tins: readonly TaxIdentification[]): XmlElement[] {
  return tins.map((t) => {
    const issuedBy = valueOf(t.issuedBy);
    return el("TIN", issuedBy ? { issuedBy } : {}, [text(t.tin)]);
  });
}

export function buildOrganisationIdentifiers(ids: readonly OrganisationIdentifier[]): XmlElement[] {
  return ids.map((i) => {
    const issuedBy = valueOf(i.issuedBy);
    return el("IN", { INType: i.type, ...(issuedBy ? { issuedBy } : {}) }, [text(i.value)]);
  });
}

export function buildBirthInfo(b: BirthInfo): XmlElement | undefined {
  const date = valueOf(b.date);
  const city = valueOf(b.city);
  const country = valueOf(b.countryCode);
  if (!date && !city && !country) return undefined;
  return el("BirthInfo", {}, [
    leaf("BirthDate", date),
    leaf("City", city),
    country ? el("CountryInfo", {}, [el("CountryCode", {}, [text(country)])]) : undefined,
  ]);
}

/** Individual party. `includeNationality` is false for v2.0, which lacks the element. */
export function buildIndividual(
  i: Individual,
  opts: { includeNationality: boolean },
  ctx: EmitCtx,
): XmlElement {
  const children: Array<XmlNode | undefined> = [
    ...i.residenceCountries.map((c) => el("ResCountryCode", {}, [text(c)])),
    ...buildTins(i.tins),
    buildPersonName(i.name),
    buildAddress(i.address, childCtx(ctx, "/Individual")),
  ];
  if (opts.includeNationality) {
    const nat = valueOf(i.nationality);
    if (nat) children.push(el("Nationality", {}, [text(nat)]));
  }
  const birth = valueOf(i.birthInfo);
  if (birth) children.push(buildBirthInfo(birth));
  return el("Individual", {}, children);
}

export function buildOrganisation(o: Organisation, ctx: EmitCtx): XmlElement {
  return el("Organisation", {}, [
    ...o.residenceCountries.map((c) => el("ResCountryCode", {}, [text(c)])),
    ...buildOrganisationIdentifiers(o.identifiers),
    el("Name", {}, [text(o.name)]),
    buildAddress(o.address, childCtx(ctx, "/Organisation")),
  ]);
}

export function buildReportingFi(
  fi: ReportingFinancialInstitution,
  docSpec: XmlElement,
  ctx: EmitCtx,
): XmlElement {
  return el("ReportingFI", {}, [
    el("ResCountryCode", {}, [text(fi.residenceCountry)]),
    ...buildOrganisationIdentifiers(fi.identifiers),
    el("Name", {}, [text(fi.name)]),
    buildAddress(fi.address, childCtx(ctx, "/ReportingFI")),
    docSpec,
  ]);
}

/**
 * DocSpec.
 *
 * CorrMessageRefId is deliberately never emitted: it is forbidden in CRS in
 * both the message header and DocSpec (CTS 80006 / 80007). There is no
 * "correct a message" operation, only per-record corrections keyed on DocRefId.
 */
export function buildDocSpec(
  docTypeIndic: string,
  docRefId: string,
  corrDocRefId: string | undefined,
  stf = "stf",
): XmlElement {
  return el("DocSpec", {}, [
    el(`${stf}:DocTypeIndic`, {}, [text(docTypeIndic)]),
    el(`${stf}:DocRefId`, {}, [text(docRefId)]),
    leaf(`${stf}:CorrDocRefId`, corrDocRefId),
  ]);
}

export function buildMessageSpec(
  plan: FilingPlan,
  sendingCompanyIn: string | undefined,
  timestamp: string,
): XmlElement {
  return el("MessageSpec", {}, [
    leaf("SendingCompanyIN", sendingCompanyIn),
    el("TransmittingCountry", {}, [text(plan.sendingCountry)]),
    el("ReceivingCountry", {}, [text(plan.receivingCountry)]),
    el("MessageType", {}, [text("CRS")]),
    el("MessageRefId", {}, [text(plan.messageRefId)]),
    el("MessageTypeIndic", {}, [text(plan.messageTypeIndic)]),
    el("ReportingPeriod", {}, [text(plan.reportingPeriod.end)]),
    el("Timestamp", {}, [text(timestamp)]),
  ]);
}
