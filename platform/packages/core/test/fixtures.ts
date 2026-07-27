import {
  AccountHolderType,
  AccountNumberType,
  AddressType,
  CounterSequence,
  InMemoryLedger,
  RefIdAllocator,
  DEFAULT_DOC_REF_SPEC,
  DEFAULT_MESSAGE_REF_SPEC,
  known,
  notReported,
  unsafeBrand,
  type AccountRecord,
  type Address,
  type Individual,
  type Organisation,
  type PlanContext,
  type ReportingFinancialInstitution,
  type ReportingPeriod,
} from "../src/index.js";

export const MU = unsafeBrand.iso3166("MU");
export const USD = unsafeBrand.iso4217("USD");

export const period2025: ReportingPeriod = { end: unsafeBrand.isoDate("2025-12-31") };
export const period2026: ReportingPeriod = { end: unsafeBrand.isoDate("2026-12-31") };

export const address: Address = {
  countryCode: MU,
  type: AddressType.Residential,
  street: known("12 Rue Royale"),
  city: known("Port Louis"),
  postCode: notReported,
  countrySubentity: notReported,
};

export const individual: Individual = {
  kind: "individual",
  residenceCountries: [MU],
  name: {
    firstName: "Aisha",
    lastName: "Ramgoolam",
    middleName: notReported,
    title: notReported,
    suffix: notReported,
  },
  address,
  tins: [{ tin: unsafeBrand.tin("MU12345678"), issuedBy: known(MU) }],
  birthInfo: known({
    date: known(unsafeBrand.isoDate("1985-03-14")),
    city: known("Curepipe"),
    countryCode: known(MU),
  }),
  nationality: known(MU),
};

export const organisation: Organisation = {
  kind: "organisation",
  residenceCountries: [MU],
  name: "Indian Ocean Holdings Ltd",
  address,
  identifiers: [{ value: "MU99887766", type: "TIN", issuedBy: known(MU) }],
  holderType: known(AccountHolderType.PassiveNfeWithReportableControllingPersons),
};

export const reportingFi: ReportingFinancialInstitution = {
  name: "Banque des Mascareignes Ltd",
  residenceCountry: MU,
  identifiers: [{ value: "MU10203040", type: "TIN", issuedBy: known(MU) }],
  address,
  giin: notReported,
};

/** A complete record with every v3.0 field supplied. */
export function completeRecord(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    accountNumber: unsafeBrand.accountNumber("ACC-0001"),
    accountNumberType: AccountNumberType.Other,
    closed: false,
    dormant: false,
    undocumented: false,
    balance: { amount: "15000.00", currency: USD },
    holder: individual,
    controllingPersons: [],
    payments: [],
    accountType: known("CRS1101"),
    dueDiligence: known("CRS1202"),
    selfCert: known("CRS901"),
    jointHolderCount: notReported,
    businessKey: "ACC-0001",
    provenance: { sheet: "Accounts", row: 2 },
    ...overrides,
  } as AccountRecord;
}

/** A record where the filer supplied no self-certification data at all. */
export function recordWithoutSelfCert(): AccountRecord {
  return completeRecord({
    accountNumber: unsafeBrand.accountNumber("ACC-0002"),
    businessKey: "ACC-0002",
    selfCert: notReported,
    accountType: notReported,
    dueDiligence: notReported,
  });
}

export function planContext(
  ledger: InMemoryLedger,
  overrides: Partial<PlanContext> = {},
): PlanContext {
  return {
    ledger,
    allocator: new RefIdAllocator(ledger, new CounterSequence(1)),
    messageRefSpec: DEFAULT_MESSAGE_REF_SPEC,
    docRefSpec: DEFAULT_DOC_REF_SPEC,
    environment: "production",
    schemaTarget: "crs-v3.0",
    reportingPeriod: period2026,
    sendingCountry: MU,
    receivingCountry: MU,
    reportingFi,
    senderId: "MU10203040",
    sentinelsPermitted: true,
    now: () => "2027-05-01T00:00:00.000Z",
    businessKeyOf: (r) => r.businessKey,
    payloadDigestOf: (r) => `${r.accountNumber}:${r.balance.amount}:${r.holder.kind}`,
    ...overrides,
  };
}
