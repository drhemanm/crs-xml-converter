/**
 * The input contract, generated from the field specs rather than maintained
 * separately — so the template can never drift from what the mapper accepts.
 *
 * The legacy application's documentation told users twice to "download our
 * sample template"; no such file existed anywhere in the repository. A tool
 * that cannot tell you what it accepts is not usable, however correct its
 * output.
 */
import { FIELD_SPECS, type CanonicalField, type FieldSpec } from "./columns.js";

export interface TemplateOptions {
  /** Include a filled example row beneath the header. */
  readonly withExampleRows?: boolean;
  /** Emit only the columns needed for a minimal valid filing. */
  readonly minimal?: boolean;
}

/**
 * Columns without which no record can be produced. Everything else is either
 * conditionally required (organisation name, when the holder is an entity) or
 * genuinely optional.
 */
const MINIMAL: readonly CanonicalField[] = [
  "account_number",
  "account_balance",
  "currency_code",
  "holder_type",
  "residence_country",
  "first_name",
  "last_name",
  "address_street",
  "address_city",
  "self_cert",
  "account_type",
  "dd_procedure",
];

const EXAMPLE_INDIVIDUAL: Partial<Record<CanonicalField, string>> = {
  account_number: "ACC-1001",
  account_balance: "152340.50",
  currency_code: "USD",
  holder_type: "individual",
  residence_country: "FR",
  first_name: "Camille",
  last_name: "Deschamps",
  birth_date: "1978-06-02",
  birth_city: "Lyon",
  birth_country: "FR",
  nationality: "FR",
  tin: "FR7712345678",
  tin_issued_by: "FR",
  address_street: "14 Rue de Rivoli",
  address_city: "Paris",
  address_postcode: "75001",
  self_cert: "true",
  account_type: "depository",
  dd_procedure: "preexisting",
  account_number_type: "other",
  closed_account: "false",
  dormant_account: "false",
  undocumented_account: "false",
  payment_interest: "1250.00",
};

const EXAMPLE_ORGANISATION: Partial<Record<CanonicalField, string>> = {
  account_number: "ACC-1003",
  account_balance: "4410000.00",
  currency_code: "USD",
  holder_type: "organisation",
  residence_country: "SG",
  organisation_name: "Meridian Capital Partners Pte Ltd",
  organisation_tin: "SG198765432X",
  account_holder_type: "passive_nfe_reportable",
  address_street: "1 Raffles Place",
  address_city: "Singapore",
  cp_first_name: "Wei",
  cp_last_name: "Tan",
  cp_residence_country: "SG",
  cp_address_street: "20 Orchard Road",
  cp_address_city: "Singapore",
  cp_tin: "S1234567D",
  cp_birth_date: "1971-09-30",
  cp_type: "ownership",
  cp_self_cert: "true",
  self_cert: "true",
  account_type: "investment_entity",
  dd_procedure: "preexisting",
  payment_dividends: "88000.00",
};

const quote = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function templateCsv(options: TemplateOptions = {}): string {
  const fields = options.minimal
    ? FIELD_SPECS.filter((f) => MINIMAL.includes(f.field))
    : FIELD_SPECS;

  const header = fields.map((f) => f.field).join(",");
  if (!options.withExampleRows) return `${header}\n`;

  const row = (example: Partial<Record<CanonicalField, string>>): string =>
    fields.map((f) => quote(example[f.field] ?? "")).join(",");

  return [header, row(EXAMPLE_INDIVIDUAL), row(EXAMPLE_ORGANISATION)].join("\n") + "\n";
}

export interface FieldDoc {
  readonly field: CanonicalField;
  readonly label: string;
  readonly required: boolean;
  readonly aliases: readonly string[];
  readonly accepts?: string;
}

/**
 * Documented value constraints. Only fields with a closed value set or a strict
 * format appear here; the rest accept free text.
 */
const ACCEPTS: Partial<Record<CanonicalField, string>> = {
  holder_type: "individual | organisation",
  residence_country: "ISO 3166-1 alpha-2, e.g. FR (XX and other placeholders are rejected)",
  address_country: "ISO 3166-1 alpha-2",
  birth_country: "ISO 3166-1 alpha-2",
  nationality: "ISO 3166-1 alpha-2",
  cp_residence_country: "ISO 3166-1 alpha-2",
  cp_address_country: "ISO 3166-1 alpha-2",
  cp_birth_country: "ISO 3166-1 alpha-2",
  tin_issued_by: "ISO 3166-1 alpha-2",
  currency_code: "ISO 4217, e.g. USD",
  account_balance: "decimal, not negative; thousands separators allowed",
  birth_date: "YYYY-MM-DD only — ambiguous formats like 03/04/2025 are rejected",
  cp_birth_date: "YYYY-MM-DD only",
  self_cert: "true | false — leave empty if not obtained; it is never assumed",
  cp_self_cert: "true | false — leave empty if not obtained",
  account_type: "depository | custodial | insurance_annuity | investment_entity",
  dd_procedure: "new_account | preexisting",
  account_holder_type: "passive_nfe_reportable | reportable_person | passive_nfe_crs_reportable",
  cp_type:
    "ownership | other_means | senior_managing | trust_settlor | trust_trustee | trust_protector | trust_beneficiary | trust_other | other_settlor_eq | other_trustee_eq | other_protector_eq | other_beneficiary_eq | other_equivalent",
  account_number_type: "iban | oban | isin | osin | other",
  closed_account: "true | false",
  dormant_account: "true | false",
  undocumented_account: "true | false",
  joint_holder_count: "whole number 1-200",
};

export function fieldDocs(): readonly FieldDoc[] {
  return FIELD_SPECS.map((f: FieldSpec) => ({
    field: f.field,
    label: f.label,
    required: f.required,
    aliases: f.aliases,
    ...(ACCEPTS[f.field] ? { accepts: ACCEPTS[f.field] as string } : {}),
  }));
}
