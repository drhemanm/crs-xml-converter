/**
 * The canonical, schema-neutral domain model.
 *
 * This is deliberately *not* shaped like CRS v2.0 or v3.0 XML. Ingest produces
 * this; emitters consume it. That indirection is what lets one record be filed
 * as v2.0 this year and corrected as v3.0 in 2027 without re-keying anything.
 *
 * The central invariant: every optional regulatory attribute is modelled as
 * `Reported<T>` — known, or explicitly not reported. There is no third state
 * where a missing value quietly becomes a compliant-looking default. That
 * pattern is exactly how the legacy implementation came to assert
 * self-certifications that institutions had never obtained.
 */
import type {
  AccountNumber,
  Giin,
  Iso3166Alpha2,
  Iso4217,
  IsoDate,
  Tin,
} from "./brand.js";
import type { Provenance } from "./diagnostics.js";

/** Known value, or an explicit acknowledgement that it was not reported. */
export type Reported<T> = { readonly known: true; readonly value: T } | { readonly known: false };

export const known = <T>(value: T): Reported<T> => ({ known: true, value });
export const notReported: Reported<never> = { known: false };

export const isKnown = <T>(r: Reported<T>): r is { known: true; value: T } => r.known;

/** Read a Reported, or undefined. Never invents a substitute. */
export const valueOf = <T>(r: Reported<T>): T | undefined => (r.known ? r.value : undefined);

// ---------------------------------------------------------------------------
// CRS enumerations. Values are the wire codes; the compiler enforces the set.
// ---------------------------------------------------------------------------

/** CrsAccountType — v3.0 only. */
export const AccountType = {
  Depository: "CRS1101",
  Custodial: "CRS1102",
  CashValueInsurance: "CRS1103",
  EquityOrDebtInterest: "CRS1104",
  /** Transitional "not reported" sentinel — period-gated, see jurisdiction rules. */
  NotReported: "CRS1100",
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

/** OpeningDate / due-diligence procedure — v3.0 only. */
export const DueDiligence = {
  NewAccount: "CRS1201",
  PreexistingAccount: "CRS1202",
  NotReported: "CRS1200",
} as const;
export type DueDiligence = (typeof DueDiligence)[keyof typeof DueDiligence];

/** CrsSelfCert — v3.0 only. The most consequential field in the schema. */
export const SelfCert = {
  Obtained: "CRS901",
  NotObtained: "CRS902",
  NotReported: "CRS900",
} as const;
export type SelfCert = (typeof SelfCert)[keyof typeof SelfCert];

/** CrsSelfCertforCtrlgPersonType — v3.0 only. */
export const ControllingPersonSelfCert = {
  Obtained: "CRS1001",
  NotObtained: "CRS1002",
  NotReported: "CRS1000",
} as const;
export type ControllingPersonSelfCert =
  (typeof ControllingPersonSelfCert)[keyof typeof ControllingPersonSelfCert];

export const AccountHolderType = {
  /** Passive NFE with one or more controlling persons that are Reportable Persons. */
  PassiveNfeWithReportableControllingPersons: "CRS101",
  ReportablePerson: "CRS102",
  PassiveNfeThatIsReportablePerson: "CRS103",
} as const;
export type AccountHolderType = (typeof AccountHolderType)[keyof typeof AccountHolderType];

export const ControllingPersonType = {
  LegalPersonOwnership: "CRS801",
  LegalPersonOtherMeans: "CRS802",
  LegalPersonSeniorManagingOfficial: "CRS803",
  TrustSettlor: "CRS804",
  TrustTrustee: "CRS805",
  TrustProtector: "CRS806",
  TrustBeneficiary: "CRS807",
  TrustOther: "CRS808",
  OtherSettlorEquivalent: "CRS809",
  OtherTrusteeEquivalent: "CRS810",
  OtherProtectorEquivalent: "CRS811",
  OtherBeneficiaryEquivalent: "CRS812",
  OtherEquivalent: "CRS813",
  NotReported: "CRS800",
} as const;
export type ControllingPersonType =
  (typeof ControllingPersonType)[keyof typeof ControllingPersonType];

export const PaymentType = {
  Dividends: "CRS501",
  Interest: "CRS502",
  GrossProceeds: "CRS503",
  Other: "CRS504",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const AccountNumberType = {
  Iban: "OECD601",
  Oban: "OECD602",
  Isin: "OECD603",
  Osin: "OECD604",
  Other: "OECD605",
} as const;
export type AccountNumberType = (typeof AccountNumberType)[keyof typeof AccountNumberType];

export const AddressType = {
  ResidentialOrBusiness: "OECD301",
  Residential: "OECD302",
  Business: "OECD303",
  RegisteredOffice: "OECD304",
  Unspecified: "OECD305",
} as const;
export type AddressType = (typeof AddressType)[keyof typeof AddressType];

/** Sentinel codes are valid only for reporting periods on or before 2025-12-31. */
export const NOT_REPORTED_SENTINELS: ReadonlySet<string> = new Set([
  AccountType.NotReported,
  DueDiligence.NotReported,
  SelfCert.NotReported,
  ControllingPersonSelfCert.NotReported,
  ControllingPersonType.NotReported,
]);

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export interface MonetaryAmount {
  /** Minor-unit-safe decimal string, e.g. "1234.56". Never a float. */
  readonly amount: string;
  readonly currency: Iso4217;
}

export interface Address {
  readonly countryCode: Iso3166Alpha2;
  readonly type: AddressType;
  readonly street: Reported<string>;
  readonly city: Reported<string>;
  readonly postCode: Reported<string>;
  readonly countrySubentity: Reported<string>;
}

export interface PersonName {
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: Reported<string>;
  readonly title: Reported<string>;
  readonly suffix: Reported<string>;
}

export interface BirthInfo {
  readonly date: Reported<IsoDate>;
  readonly city: Reported<string>;
  readonly countryCode: Reported<Iso3166Alpha2>;
}

export interface TaxIdentification {
  readonly tin: Tin;
  readonly issuedBy: Reported<Iso3166Alpha2>;
}

export interface Individual {
  readonly kind: "individual";
  readonly residenceCountries: readonly Iso3166Alpha2[];
  readonly name: PersonName;
  readonly address: Address;
  readonly tins: readonly TaxIdentification[];
  readonly birthInfo: Reported<BirthInfo>;
  readonly nationality: Reported<Iso3166Alpha2>;
}

export interface Organisation {
  readonly kind: "organisation";
  readonly residenceCountries: readonly Iso3166Alpha2[];
  readonly name: string;
  readonly address: Address;
  readonly identifiers: readonly OrganisationIdentifier[];
  readonly holderType: Reported<AccountHolderType>;
}

export interface OrganisationIdentifier {
  readonly value: string;
  readonly type: "GIIN" | "TIN" | "EIN" | "LEI" | "Other";
  readonly issuedBy: Reported<Iso3166Alpha2>;
}

export type AccountHolder = Individual | Organisation;

export interface ControllingPerson {
  readonly individual: Individual;
  readonly type: Reported<ControllingPersonType>;
  readonly selfCert: Reported<ControllingPersonSelfCert>;
}

export interface Payment {
  readonly type: PaymentType;
  readonly amount: MonetaryAmount;
}

/**
 * One reportable account, as the institution knows it — before any decision
 * about which schema version will carry it.
 */
export interface AccountRecord {
  readonly accountNumber: AccountNumber;
  readonly accountNumberType: AccountNumberType;
  readonly closed: boolean;
  readonly dormant: boolean;
  readonly undocumented: boolean;
  readonly balance: MonetaryAmount;
  readonly holder: AccountHolder;
  readonly controllingPersons: readonly ControllingPerson[];
  readonly payments: readonly Payment[];
  /** v3.0 fields. Absent on a v2.0 filing; `notReported` when genuinely unknown. */
  readonly accountType: Reported<AccountType>;
  readonly dueDiligence: Reported<DueDiligence>;
  readonly selfCert: Reported<SelfCert>;
  readonly jointHolderCount: Reported<number>;
  /** Stable identity across years — how a correction finds last year's record. */
  readonly businessKey: string;
  readonly provenance: Provenance;
}

export interface ReportingFinancialInstitution {
  readonly name: string;
  readonly residenceCountry: Iso3166Alpha2;
  readonly identifiers: readonly OrganisationIdentifier[];
  readonly address: Address;
  readonly giin: Reported<Giin>;
}

/** A reporting period is identified by its closing date, e.g. 2025-12-31. */
export interface ReportingPeriod {
  readonly end: IsoDate;
}

export const reportingYear = (p: ReportingPeriod): number => Number(p.end.slice(0, 4));

/**
 * Sentinels became invalid for periods after 2025-12-31 when CRS 2.0 took
 * effect. This is what makes it possible to correct a 2023 record in 2027
 * using the v3.0 schema: the older period still accepts "not reported".
 */
export const sentinelsPermitted = (p: ReportingPeriod): boolean => p.end <= "2025-12-31";
