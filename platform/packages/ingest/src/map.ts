/**
 * Row → canonical record mapping.
 *
 * The governing rule: **this module never invents a value.** A missing
 * self-certification becomes `notReported`, not `CRS901`. A missing country
 * becomes an error, not `"XX"`. An ambiguous date becomes an error, not a
 * coin-flip between DD/MM and MM/DD.
 *
 * Everything that goes wrong is reported against the cell it came from.
 */
import {
  AccountNumberType,
  AccountType,
  AddressType,
  ControllingPersonSelfCert,
  ControllingPersonType,
  DiagnosticCode,
  DueDiligence,
  PaymentType,
  SelfCert,
  AccountHolderType,
  accountNumber as brandAccountNumber,
  error as diagError,
  warning as diagWarning,
  isoDate as brandIsoDate,
  iso3166Alpha2,
  iso4217,
  known,
  notReported,
  tin as brandTin,
  type AccountRecord,
  type Address,
  type BirthInfo,
  type ControllingPerson,
  type Diagnostic,
  type Individual,
  type Iso3166Alpha2,
  type IsoDate,
  type MonetaryAmount,
  type Organisation,
  type Payment,
  type PersonName,
  type Provenance,
  type Reported,
  type TaxIdentification,
} from "@crs/core";
import type { CanonicalField, ColumnMapping } from "./columns.js";
import { specFor } from "./columns.js";

export type Row = Record<string, unknown>;

export interface MapResult {
  readonly records: readonly AccountRecord[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Accessor bound to one row, carrying provenance for every read. */
class RowReader {
  constructor(
    private readonly row: Row,
    private readonly mapping: ColumnMapping,
    private readonly sheet: string,
    private readonly rowNumber: number,
    private readonly diagnostics: Diagnostic[],
  ) {}

  provenanceFor(field: CanonicalField): Provenance {
    const header = this.mapping.matches.get(field)?.header;
    return {
      sheet: this.sheet,
      row: this.rowNumber,
      ...(header ? { header } : {}),
    };
  }

  /** Raw trimmed string, or undefined when the column or value is absent. */
  raw(field: CanonicalField): string | undefined {
    const header = this.mapping.matches.get(field)?.header;
    if (!header) return undefined;
    const value = this.row[header];
    if (value === null || value === undefined) return undefined;
    const s = typeof value === "string" ? value.trim() : String(value).trim();
    return s === "" ? undefined : s;
  }

  has(field: CanonicalField): boolean {
    return this.raw(field) !== undefined;
  }

  report(d: Diagnostic): void {
    this.diagnostics.push(d);
  }

  missing(field: CanonicalField, severity: "error" | "warning" = "error"): void {
    const label = specFor(field)?.label ?? field;
    const d =
      severity === "error"
        ? diagError(DiagnosticCode.MISSING_REQUIRED_VALUE, `${label} is required and is empty.`, {
            provenance: this.provenanceFor(field),
            remediation: `Populate the "${label}" column for this row.`,
          })
        : diagWarning(DiagnosticCode.MISSING_REQUIRED_VALUE, `${label} is not provided.`, {
            provenance: this.provenanceFor(field),
          });
    this.diagnostics.push(d);
  }

  invalid(field: CanonicalField, reason: string, remediation?: string): void {
    const label = specFor(field)?.label ?? field;
    this.diagnostics.push(
      diagError(DiagnosticCode.INVALID_VALUE, `${label}: ${reason}`, {
        provenance: this.provenanceFor(field),
        ...(remediation ? { remediation } : {}),
      }),
    );
  }

  /** Optional free text — absent becomes `notReported`, never a placeholder. */
  optionalText(field: CanonicalField): Reported<string> {
    const v = this.raw(field);
    return v === undefined ? notReported : known(v);
  }

  country(field: CanonicalField, required: boolean): Iso3166Alpha2 | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (required) this.missing(field);
      return undefined;
    }
    const parsed = iso3166Alpha2(v);
    if (!parsed.ok) {
      this.invalid(field, parsed.error.reason, "Use a two-letter ISO 3166-1 code, e.g. MU, SG, GB.");
      return undefined;
    }
    return parsed.value;
  }

  optionalCountry(field: CanonicalField): Reported<Iso3166Alpha2> {
    const v = this.raw(field);
    if (v === undefined) return notReported;
    const parsed = iso3166Alpha2(v);
    if (!parsed.ok) {
      this.invalid(field, parsed.error.reason);
      return notReported;
    }
    return known(parsed.value);
  }

  boolean(field: CanonicalField, fallback: boolean): boolean {
    const v = this.raw(field)?.toLowerCase();
    if (v === undefined) return fallback;
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n"].includes(v)) return false;
    this.invalid(field, `"${v}" is not a recognised true/false value.`);
    return fallback;
  }

  /**
   * Decimal amount as a string. Deliberately avoids parseFloat round-tripping,
   * which can perturb the last cent on large balances.
   */
  decimal(field: CanonicalField, required: boolean): string | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (required) this.missing(field);
      return undefined;
    }
    const cleaned = v.replace(/[\s,]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      this.invalid(field, `"${v}" is not a valid decimal amount.`);
      return undefined;
    }
    if (cleaned.startsWith("-")) {
      this.invalid(field, "amount must not be negative.");
      return undefined;
    }
    return cleaned;
  }

  date(field: CanonicalField): Reported<IsoDate> {
    const v = this.raw(field);
    if (v === undefined) return notReported;
    const parsed = brandIsoDate(v);
    if (!parsed.ok) {
      this.diagnostics.push(
        diagError(DiagnosticCode.AMBIGUOUS_DATE, `${specFor(field)?.label ?? field}: ${parsed.error.reason}`, {
          provenance: this.provenanceFor(field),
          remediation:
            'Format dates as YYYY-MM-DD. Values like "03/04/2025" are rejected because they cannot be distinguished between day-first and month-first.',
        }),
      );
      return notReported;
    }
    return known(parsed.value);
  }

  /** Map a free-text value onto a closed enum. Unknown input is an error. */
  enumValue<T extends string>(
    field: CanonicalField,
    table: Readonly<Record<string, T>>,
  ): Reported<T> {
    const v = this.raw(field);
    if (v === undefined) return notReported;
    const key = v.toLowerCase().replace(/[\s-]/g, "_");
    const direct = Object.values(table).find((code) => code === v.toUpperCase());
    if (direct) return known(direct);
    const mapped = table[key];
    if (mapped) return known(mapped);
    this.diagnostics.push(
      diagError(
        DiagnosticCode.UNKNOWN_ENUM_VALUE,
        `${specFor(field)?.label ?? field}: "${v}" is not a recognised value.`,
        {
          provenance: this.provenanceFor(field),
          remediation: `Expected one of: ${Object.keys(table).join(", ")}.`,
        },
      ),
    );
    return notReported;
  }
}

// --- value tables -----------------------------------------------------------

const SELF_CERT_TABLE: Record<string, SelfCert> = {
  true: SelfCert.Obtained,
  yes: SelfCert.Obtained,
  y: SelfCert.Obtained,
  obtained: SelfCert.Obtained,
  false: SelfCert.NotObtained,
  no: SelfCert.NotObtained,
  n: SelfCert.NotObtained,
  not_obtained: SelfCert.NotObtained,
};

const CP_SELF_CERT_TABLE: Record<string, ControllingPersonSelfCert> = {
  true: ControllingPersonSelfCert.Obtained,
  yes: ControllingPersonSelfCert.Obtained,
  y: ControllingPersonSelfCert.Obtained,
  false: ControllingPersonSelfCert.NotObtained,
  no: ControllingPersonSelfCert.NotObtained,
  n: ControllingPersonSelfCert.NotObtained,
};

const ACCOUNT_TYPE_TABLE: Record<string, AccountType> = {
  depository: AccountType.Depository,
  custodial: AccountType.Custodial,
  insurance_annuity: AccountType.CashValueInsurance,
  cash_value_insurance: AccountType.CashValueInsurance,
  investment_entity: AccountType.EquityOrDebtInterest,
  equity_or_debt_interest: AccountType.EquityOrDebtInterest,
};

const DD_TABLE: Record<string, DueDiligence> = {
  new_account: DueDiligence.NewAccount,
  new: DueDiligence.NewAccount,
  preexisting: DueDiligence.PreexistingAccount,
  pre_existing: DueDiligence.PreexistingAccount,
  preexisting_account: DueDiligence.PreexistingAccount,
};

const HOLDER_TYPE_TABLE: Record<string, AccountHolderType> = {
  passive_nfe_reportable: AccountHolderType.PassiveNfeWithReportableControllingPersons,
  passive_nfe_with_controlling_persons: AccountHolderType.PassiveNfeWithReportableControllingPersons,
  reportable_person: AccountHolderType.ReportablePerson,
  passive_nfe_crs_reportable: AccountHolderType.PassiveNfeThatIsReportablePerson,
};

const CP_TYPE_TABLE: Record<string, ControllingPersonType> = {
  ownership: ControllingPersonType.LegalPersonOwnership,
  other_means: ControllingPersonType.LegalPersonOtherMeans,
  senior_managing: ControllingPersonType.LegalPersonSeniorManagingOfficial,
  senior_managing_official: ControllingPersonType.LegalPersonSeniorManagingOfficial,
  trust_settlor: ControllingPersonType.TrustSettlor,
  trust_trustee: ControllingPersonType.TrustTrustee,
  trust_protector: ControllingPersonType.TrustProtector,
  trust_beneficiary: ControllingPersonType.TrustBeneficiary,
  trust_other: ControllingPersonType.TrustOther,
  other_settlor_eq: ControllingPersonType.OtherSettlorEquivalent,
  other_trustee_eq: ControllingPersonType.OtherTrusteeEquivalent,
  other_protector_eq: ControllingPersonType.OtherProtectorEquivalent,
  other_beneficiary_eq: ControllingPersonType.OtherBeneficiaryEquivalent,
  other_equivalent: ControllingPersonType.OtherEquivalent,
};

const ACCOUNT_NUMBER_TYPE_TABLE: Record<string, AccountNumberType> = {
  iban: AccountNumberType.Iban,
  oban: AccountNumberType.Oban,
  isin: AccountNumberType.Isin,
  osin: AccountNumberType.Osin,
  other: AccountNumberType.Other,
};

// --- mapping ----------------------------------------------------------------

function buildAddress(r: RowReader, prefix: "" | "cp_", residence: Iso3166Alpha2): Address | undefined {
  const countryField = (prefix === "cp_" ? "cp_address_country" : "address_country") as CanonicalField;
  const streetField = (prefix === "cp_" ? "cp_address_street" : "address_street") as CanonicalField;
  const cityField = (prefix === "cp_" ? "cp_address_city" : "address_city") as CanonicalField;

  // Address country legitimately falls back to tax residence — that is a
  // documented CRS convention, not a fabricated value.
  const explicit = r.optionalCountry(countryField);
  const countryCode = explicit.known ? explicit.value : residence;

  return {
    countryCode,
    type: AddressType.Residential,
    street: r.optionalText(streetField),
    city: r.optionalText(cityField),
    postCode: prefix === "cp_" ? notReported : r.optionalText("address_postcode"),
    countrySubentity: prefix === "cp_" ? notReported : r.optionalText("address_subentity"),
  };
}

function buildIndividual(
  r: RowReader,
  prefix: "" | "cp_",
  residence: Iso3166Alpha2,
): Individual | undefined {
  const firstField = (prefix === "cp_" ? "cp_first_name" : "first_name") as CanonicalField;
  const lastField = (prefix === "cp_" ? "cp_last_name" : "last_name") as CanonicalField;
  const middleField = (prefix === "cp_" ? "cp_middle_name" : "middle_name") as CanonicalField;
  const tinField = (prefix === "cp_" ? "cp_tin" : "tin") as CanonicalField;
  const birthDateField = (prefix === "cp_" ? "cp_birth_date" : "birth_date") as CanonicalField;
  const birthCityField = (prefix === "cp_" ? "cp_birth_city" : "birth_city") as CanonicalField;
  const birthCountryField = (prefix === "cp_" ? "cp_birth_country" : "birth_country") as CanonicalField;
  const nationalityField = (prefix === "cp_" ? "cp_nationality" : "nationality") as CanonicalField;

  const firstName = r.raw(firstField);
  const lastName = r.raw(lastField);
  if (!firstName || !lastName) {
    if (!firstName) r.missing(firstField);
    if (!lastName) r.missing(lastField);
    return undefined;
  }

  const name: PersonName = {
    firstName,
    lastName,
    middleName: r.optionalText(middleField),
    title: prefix === "cp_" ? notReported : r.optionalText("name_title"),
    suffix: prefix === "cp_" ? notReported : r.optionalText("name_suffix"),
  };

  const tins: TaxIdentification[] = [];
  const tinRaw = r.raw(tinField);
  if (tinRaw) {
    const parsed = brandTin(tinRaw);
    if (parsed.ok) {
      const issuedBy = prefix === "cp_" ? notReported : r.optionalCountry("tin_issued_by");
      tins.push({ tin: parsed.value, issuedBy: issuedBy.known ? known(issuedBy.value) : known(residence) });
    } else {
      r.invalid(tinField, parsed.error.reason);
    }
  }

  const address = buildAddress(r, prefix, residence);
  if (!address) return undefined;

  const birthDate = r.date(birthDateField);
  const birthCity = r.optionalText(birthCityField);
  const birthCountry = r.optionalCountry(birthCountryField);
  const birthInfo: BirthInfo = { date: birthDate, city: birthCity, countryCode: birthCountry };
  const hasBirth = birthDate.known || birthCity.known || birthCountry.known;

  return {
    kind: "individual",
    residenceCountries: [residence],
    name,
    address,
    tins,
    birthInfo: hasBirth ? known(birthInfo) : notReported,
    nationality: r.optionalCountry(nationalityField),
  };
}

function buildPayments(r: RowReader): Payment[] {
  const out: Payment[] = [];
  const currency = r.raw("currency_code");
  if (!currency) return out;
  const ccy = iso4217(currency);
  if (!ccy.ok) return out;

  const add = (field: CanonicalField, type: PaymentType): void => {
    const amount = r.decimal(field, false);
    if (amount && Number(amount) > 0) {
      out.push({ type, amount: { amount, currency: ccy.value } });
    }
  };
  add("payment_dividends", PaymentType.Dividends);
  add("payment_interest", PaymentType.Interest);
  add("payment_gross_proceeds", PaymentType.GrossProceeds);
  add("payment_other", PaymentType.Other);
  return out;
}

export interface MapOptions {
  readonly sheet: string;
  /** Row number of the header, so data rows are numbered as the user sees them. */
  readonly headerRow?: number;
}

export function mapRows(rows: readonly Row[], mapping: ColumnMapping, options: MapOptions): MapResult {
  const diagnostics: Diagnostic[] = [];
  const records: AccountRecord[] = [];
  const headerRow = options.headerRow ?? 1;

  // Report the inferred mapping so the filer can audit it before generating.
  for (const [field, match] of mapping.matches) {
    if (match.kind !== "exact") {
      diagnostics.push(
        diagWarning(
          DiagnosticCode.COLUMN_INFERRED,
          `Column "${match.header}" was matched to ${specFor(field)?.label ?? field} by ${match.kind} match.`,
          {
            provenance: { sheet: options.sheet, row: headerRow, header: match.header },
            remediation: "Confirm this mapping is correct before filing.",
          },
        ),
      );
    }
  }
  for (const a of mapping.ambiguous) {
    diagnostics.push(
      diagError(
        DiagnosticCode.COLUMN_INFERRED,
        `Column "${a.header}" could match several fields: ${a.candidates.join(", ")}.`,
        {
          provenance: { sheet: options.sheet, row: headerRow, header: a.header },
          remediation: "Rename the column to match exactly one canonical field. It has not been mapped.",
        },
      ),
    );
  }

  rows.forEach((row, i) => {
    const rowNumber = headerRow + 1 + i;
    const before = diagnostics.length;
    const r = new RowReader(row, mapping, options.sheet, rowNumber, diagnostics);

    const acctRaw = r.raw("account_number");
    if (!acctRaw) {
      r.missing("account_number");
      return;
    }
    const acct = brandAccountNumber(acctRaw);
    if (!acct.ok) {
      r.invalid("account_number", acct.error.reason);
      return;
    }

    const balance = r.decimal("account_balance", true);
    const currencyRaw = r.raw("currency_code");
    if (!currencyRaw) r.missing("currency_code");
    const currency = currencyRaw ? iso4217(currencyRaw) : undefined;
    if (currency && !currency.ok) r.invalid("currency_code", currency.error.reason);

    const residence = r.country("residence_country", true);
    const holderKindRaw = r.raw("holder_type")?.toLowerCase();
    if (!holderKindRaw) r.missing("holder_type");

    if (!balance || !currency?.ok || !residence || !holderKindRaw) return;

    const monetary: MonetaryAmount = { amount: balance, currency: currency.value };

    const isIndividual = ["individual", "person", "natural_person"].includes(holderKindRaw);
    const isOrganisation = ["organisation", "organization", "entity", "company"].includes(holderKindRaw);
    if (!isIndividual && !isOrganisation) {
      r.invalid("holder_type", `"${holderKindRaw}" is not recognised.`, "Use 'individual' or 'organisation'.");
      return;
    }

    let holder: Individual | Organisation | undefined;
    if (isIndividual) {
      holder = buildIndividual(r, "", residence);
    } else {
      const orgName = r.raw("organisation_name");
      if (!orgName) {
        r.missing("organisation_name");
        return;
      }
      const address = buildAddress(r, "", residence);
      if (!address) return;
      const identifiers = [];
      const orgTin = r.raw("organisation_tin");
      if (orgTin) identifiers.push({ value: orgTin, type: "TIN" as const, issuedBy: known(residence) });
      holder = {
        kind: "organisation",
        residenceCountries: [residence],
        name: orgName,
        address,
        identifiers,
        holderType: r.enumValue("account_holder_type", HOLDER_TYPE_TABLE),
      };
    }
    if (!holder) return;

    const controllingPersons: ControllingPerson[] = [];
    if (isOrganisation && (r.has("cp_first_name") || r.has("cp_last_name"))) {
      const cpResidence = r.country("cp_residence_country", false) ?? residence;
      const cpIndividual = buildIndividual(r, "cp_", cpResidence);
      if (cpIndividual) {
        controllingPersons.push({
          individual: cpIndividual,
          type: r.enumValue("cp_type", CP_TYPE_TABLE),
          selfCert: r.enumValue("cp_self_cert", CP_SELF_CERT_TABLE),
        });
      }
    }

    const jointRaw = r.raw("joint_holder_count");
    let jointCount: Reported<number> = notReported;
    if (jointRaw !== undefined) {
      const n = Number(jointRaw);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        r.invalid("joint_holder_count", `"${jointRaw}" must be a whole number between 1 and 200.`);
      } else {
        jointCount = known(n);
      }
    }

    // Every remaining field must be read *before* the error guard below, so
    // that a bad enum or flag suppresses the record rather than being reported
    // against a row that was emitted anyway.
    const acctNumberType = r.enumValue("account_number_type", ACCOUNT_NUMBER_TYPE_TABLE);
    const accountType = r.enumValue("account_type", ACCOUNT_TYPE_TABLE);
    const dueDiligence = r.enumValue("dd_procedure", DD_TABLE);
    const selfCert = r.enumValue("self_cert", SELF_CERT_TABLE);
    const closed = r.boolean("closed_account", false);
    const dormant = r.boolean("dormant_account", false);
    const undocumented = r.boolean("undocumented_account", false);
    const payments = buildPayments(r);

    // A row that produced errors is not emitted. Partial records are worse than
    // absent ones: they file confidently wrong data.
    if (diagnostics.length > before && diagnostics.slice(before).some((d) => d.severity === "error")) return;

    records.push({
      accountNumber: acct.value,
      accountNumberType: acctNumberType.known ? acctNumberType.value : AccountNumberType.Other,
      closed,
      dormant,
      undocumented,
      balance: monetary,
      holder,
      controllingPersons,
      payments,
      accountType,
      dueDiligence,
      selfCert,
      jointHolderCount: jointCount,
      businessKey: acct.value,
      provenance: { sheet: options.sheet, row: rowNumber },
    });
  });

  return { records, diagnostics };
}
