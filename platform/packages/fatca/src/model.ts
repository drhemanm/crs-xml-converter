/**
 * FATCA v2.0.1 domain types.
 *
 * FATCA is deliberately separate from CRS. They may share low-level concepts,
 * but never lifecycle codes or schema assumptions.
 */

export const FatcaDocTypeIndic = {
  New: "FATCA1",
  Corrected: "FATCA2",
  Void: "FATCA3",
  Amended: "FATCA4",
  TestNew: "FATCA11",
  TestCorrected: "FATCA12",
  TestVoid: "FATCA13",
  TestAmended: "FATCA14",
} as const;
export type FatcaDocTypeIndic =
  (typeof FatcaDocTypeIndic)[keyof typeof FatcaDocTypeIndic];

export const FatcaFilerCategory = {
  ParticipatingFfi: "FATCA601",
  ReportingModel1Ffi: "FATCA602",
  LimitedBranchOrFfi: "FATCA603",
  ReportingModel2Ffi: "FATCA604",
  QiWpOrWt: "FATCA605",
  DirectReportingNffe: "FATCA606",
  SponsorOfSponsoredFfi: "FATCA607",
  SponsorOfSponsoredDirectReportingNffe: "FATCA608",
  TrusteeOfTrusteeDocumentedTrust: "FATCA609",
  WithholdingAgent: "FATCA610",
  TerritoryFiTreatedAsUsPerson: "FATCA611",
} as const;
export type FatcaFilerCategory =
  (typeof FatcaFilerCategory)[keyof typeof FatcaFilerCategory];

export const FatcaAccountHolderType = {
  OwnerDocumentedFiWithSpecifiedUsOwners: "FATCA101",
  PassiveNffeWithSubstantialUsOwners: "FATCA102",
  NonParticipatingFfi: "FATCA103",
  SpecifiedUsPerson: "FATCA104",
  DirectReportingNffe: "FATCA105",
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

export interface FatcaSubstantialOwner {
  firstName: string;
  lastName: string;
  tin?: string;
  residenceCountry?: string;
  address?: FatcaAddress;
}

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
  substantialOwners?: readonly FatcaSubstantialOwner[];
  balance: string;
  currency: string;
  payments?: readonly FatcaPayment[];
}

export interface FatcaFilingInput {
  reportingFi: FatcaReportingFi;
  transmittingCountry: string;
  receivingCountry?: string;
  contact?: string;
  reportingPeriod: string;
  timestamp?: string;
  messageRefId: string;
  corrMessageRefId?: string;
  reportingFiDocRefId: string;
  reportingFiDocType: FatcaDocTypeIndic;
  reportingFiCorrMessageRefId?: string;
  reportingFiCorrDocRefId?: string;
  nilReport?: {
    docRefId: string;
    docType: FatcaDocTypeIndic;
    corrMessageRefId?: string;
    corrDocRefId?: string;
  };
  accounts?: readonly {
    record: FatcaAccountRecord;
    docRefId: string;
    docType: FatcaDocTypeIndic;
    corrMessageRefId?: string;
    corrDocRefId?: string;
  }[];
}
