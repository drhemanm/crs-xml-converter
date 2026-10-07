/**
 * FATCA v2.0.1 domain types.
 *
 * FATCA is deliberately separate from CRS. They share low-level person,
 * address and amount shapes where that is safe, but never share lifecycle
 * codes or schema assumptions.
 */

export const FatcaMessageTypeIndic = {
  New: "FATCA1",
  Corrected: "FATCA2",
  Void: "FATCA3",
  Amended: "FATCA4",
} as const;
export type FatcaMessageTypeIndic =
  (typeof FatcaMessageTypeIndic)[keyof typeof FatcaMessageTypeIndic];

export const FatcaDocTypeIndic = {
  New: "FATCA11",
  Corrected: "FATCA12",
  Void: "FATCA13",
  Amended: "FATCA14",
} as const;
export type FatcaDocTypeIndic =
  (typeof FatcaDocTypeIndic)[keyof typeof FatcaDocTypeIndic];

export const FatcaFilerCategory = {
  ReportingFI: "FATCA601",
  ReportingFIOrBranch: "FATCA602",
  SponsoringEntity: "FATCA603",
  TrusteeOfTrusteeDocumentedTrust: "FATCA604",
  SponsoredFfi: "FATCA605",
  SponsoredDirectReportingNffe: "FATCA606",
} as const;
export type FatcaFilerCategory =
  (typeof FatcaFilerCategory)[keyof typeof FatcaFilerCategory];

export const FatcaAccountHolderType = {
  OwnerDocumentedFiWithSpecifiedUsOwners: "FATCA101",
  PassiveNffeWithSubstantialUsOwners: "FATCA102",
  NonParticipatingFfi: "FATCA103",
  SpecifiedUsPerson: "FATCA104",
} as const;
export type FatcaAccountHolderType =
  (typeof FatcaAccountHolderType)[keyof typeof FatcaAccountHolderType];

export const FatcaPaymentType = {
  Dividends: "FATCA501",
  Interest: "FATCA502",
  GrossProceeds: "FATCA503",
  Other: "FATCA504",
} as const;
export type FatcaPaymentType =
  (typeof FatcaPaymentType)[keyof typeof FatcaPaymentType];

export interface FatcaAddress {
  countryCode: string;
  street?: string;
  buildingIdentifier?: string;
  suiteIdentifier?: string;
  floorIdentifier?: string;
  districtName?: string;
  poBox?: string;
  postCode?: string;
  city: string;
  countrySubentity?: string;
}

export interface FatcaReportingFi {
  giin: string;
  name: string;
  residenceCountry: string;
  address?: FatcaAddress;
  filerCategory: FatcaFilerCategory;
}

export interface FatcaIndividual {
  kind: "individual";
  firstName: string;
  lastName: string;
  tin?: string;
  residenceCountry?: string;
  address?: FatcaAddress;
}

export interface FatcaOrganisation {
  kind: "organisation";
  name: string;
  tin?: string;
  residenceCountry?: string;
  holderType: FatcaAccountHolderType;
  address?: FatcaAddress;
}

export type FatcaAccountHolder = FatcaIndividual | FatcaOrganisation;

export interface FatcaPayment {
  type: FatcaPaymentType;
  amount: string;
  currency: string;
}

export interface FatcaAccountRecord {
  accountNumber: string;
  accountNumberType?: string;
  closed?: boolean;
  holder: FatcaAccountHolder;
  balance: string;
  currency: string;
  payments?: readonly FatcaPayment[];
}

export interface FatcaFilingInput {
  reportingFi: FatcaReportingFi;
  transmittingCountry: string;
  receivingCountry?: string;
  reportingPeriod: string;
  timestamp?: string;
  messageRefId: string;
  mode: FatcaMessageTypeIndic;
  corrMessageRefId?: string;
  reportingFiDocRefId: string;
  reportingFiDocType: FatcaDocTypeIndic;
  reportingFiCorrDocRefId?: string;
  nilReport?: {
    docRefId: string;
    docType: FatcaDocTypeIndic;
    corrDocRefId?: string;
  };
  accounts?: readonly {
    record: FatcaAccountRecord;
    docRefId: string;
    docType: FatcaDocTypeIndic;
    corrDocRefId?: string;
  }[];
}
