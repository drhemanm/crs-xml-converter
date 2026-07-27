/**
 * Column inference.
 *
 * Spreadsheets arrive with headers like "Acct No", "account_number", "A/C
 * Number". We match them to canonical fields and *report what we did*, with a
 * confidence, so the filer can see and correct the mapping before anything is
 * generated. Silent fuzzy matching is how the wrong column ends up in a
 * regulatory filing.
 *
 * The legacy implementation's fuzzy matcher used bidirectional substring
 * containment, so the header "country" could match `residence_country`,
 * `address_country`, `birth_country` and `nationality` — whichever was tried
 * first won, silently. Here, exact matches always beat aliases, aliases beat
 * normalised matches, and any ambiguity is surfaced rather than resolved by
 * iteration order.
 */

export type CanonicalField =
  | "account_number"
  | "account_number_type"
  | "account_balance"
  | "currency_code"
  | "holder_type"
  | "closed_account"
  | "dormant_account"
  | "undocumented_account"
  | "joint_holder_count"
  | "residence_country"
  | "address_country"
  | "address_street"
  | "address_city"
  | "address_postcode"
  | "address_subentity"
  | "first_name"
  | "middle_name"
  | "last_name"
  | "name_title"
  | "name_suffix"
  | "tin"
  | "tin_issued_by"
  | "birth_date"
  | "birth_city"
  | "birth_country"
  | "nationality"
  | "organisation_name"
  | "organisation_tin"
  | "account_holder_type"
  | "self_cert"
  | "account_type"
  | "dd_procedure"
  | "cp_first_name"
  | "cp_last_name"
  | "cp_middle_name"
  | "cp_residence_country"
  | "cp_address_country"
  | "cp_address_street"
  | "cp_address_city"
  | "cp_tin"
  | "cp_birth_date"
  | "cp_birth_city"
  | "cp_birth_country"
  | "cp_nationality"
  | "cp_type"
  | "cp_self_cert"
  | "payment_dividends"
  | "payment_interest"
  | "payment_gross_proceeds"
  | "payment_other";

export interface FieldSpec {
  readonly field: CanonicalField;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly required: boolean;
}

const F = (field: CanonicalField, label: string, aliases: readonly string[], required = false): FieldSpec => ({
  field,
  label,
  aliases,
  required,
});

export const FIELD_SPECS: readonly FieldSpec[] = [
  F("account_number", "Account number", ["accountnumber", "account_no", "acct_no", "acctno", "a/c number", "account"], true),
  F("account_number_type", "Account number type", ["acctnumbertype", "account_number_type", "iban_or_other"]),
  F("account_balance", "Account balance", ["balance", "accountbalance", "closing_balance"], true),
  F("currency_code", "Currency", ["currency", "currencycode", "ccy", "curr"], true),
  F("holder_type", "Account holder kind", ["holdertype", "holder_kind", "entity_or_individual", "party_type"], true),
  F("closed_account", "Closed account flag", ["closed", "is_closed", "closedaccount"]),
  F("dormant_account", "Dormant account flag", ["dormant", "is_dormant", "dormantaccount"]),
  F("undocumented_account", "Undocumented account flag", ["undocumented", "undocumentedaccount"]),
  F("joint_holder_count", "Number of joint holders", ["joint_holders", "joint_account_holders", "number_of_holders"]),

  F("residence_country", "Tax residence country", ["res_country", "residence", "country_of_residence", "rescountrycode"], true),
  F("address_country", "Address country", ["addr_country", "address_country_code"]),
  F("address_street", "Street address", ["street", "address", "address_line_1", "addr_street"]),
  F("address_city", "City", ["city", "town", "addr_city"]),
  F("address_postcode", "Postal code", ["postcode", "postal_code", "zip", "zip_code"]),
  F("address_subentity", "State / province", ["state", "province", "region", "country_subentity"]),

  F("first_name", "First name", ["firstname", "fname", "given_name", "givenname"]),
  F("middle_name", "Middle name", ["middlename", "mname"]),
  F("last_name", "Last name", ["lastname", "lname", "surname", "family_name", "familyname"]),
  F("name_title", "Title", ["title", "salutation"]),
  F("name_suffix", "Name suffix", ["suffix", "generation"]),
  F("tin", "Tax identification number", ["tax_id", "taxpayer_id", "tax_identification_number", "tin_number"]),
  F("tin_issued_by", "TIN issuing country", ["tin_country", "tin_issued_by", "tin_jurisdiction"]),
  F("birth_date", "Date of birth", ["birthdate", "dob", "date_of_birth"]),
  F("birth_city", "City of birth", ["birthcity", "place_of_birth"]),
  F("birth_country", "Country of birth", ["birthcountry", "country_of_birth"]),
  F("nationality", "Nationality", ["citizenship", "citizen_country"]),

  F("organisation_name", "Organisation name", ["org_name", "company_name", "entity_name", "orgname"]),
  F("organisation_tin", "Organisation TIN", ["org_tin", "company_tin", "entity_tin"]),
  F("account_holder_type", "Account holder classification", ["acctholdertype", "crs_holder_type", "holder_classification"]),

  F("self_cert", "Self-certification obtained", ["self_certification", "selfcert", "self_certified"]),
  F("account_type", "Financial account type", ["accounttype", "acct_type", "financial_account_type"]),
  F("dd_procedure", "Due diligence procedure", ["due_diligence", "ddprocedure", "due_diligence_procedure", "new_or_preexisting"]),

  F("cp_first_name", "Controlling person first name", ["controlling_person_first_name", "cp_fname"]),
  F("cp_last_name", "Controlling person last name", ["controlling_person_last_name", "cp_lname"]),
  F("cp_middle_name", "Controlling person middle name", ["controlling_person_middle_name", "cp_mname"]),
  F("cp_residence_country", "Controlling person residence", ["controlling_person_residence_country"]),
  F("cp_address_country", "Controlling person address country", ["controlling_person_address_country"]),
  F("cp_address_street", "Controlling person street", ["controlling_person_address", "cp_address"]),
  F("cp_address_city", "Controlling person city", ["controlling_person_city"]),
  F("cp_tin", "Controlling person TIN", ["controlling_person_tin"]),
  F("cp_birth_date", "Controlling person date of birth", ["controlling_person_birth_date", "cp_dob"]),
  F("cp_birth_city", "Controlling person birth city", ["controlling_person_birth_city"]),
  F("cp_birth_country", "Controlling person birth country", ["controlling_person_birth_country"]),
  F("cp_nationality", "Controlling person nationality", ["controlling_person_nationality"]),
  F("cp_type", "Controlling person type", ["controlling_person_type", "ctrlg_person_type", "cp_relationship"]),
  F("cp_self_cert", "Controlling person self-certification", ["controlling_person_self_cert", "cp_self_certification"]),

  F("payment_dividends", "Dividends (CRS501)", ["dividend", "dividend_amount", "dividends", "dividend_income"]),
  F("payment_interest", "Interest (CRS502)", ["interest", "interest_amount", "interest_income"]),
  F("payment_gross_proceeds", "Gross proceeds (CRS503)", ["gross_proceeds", "gross_proceeds_amount", "redemptions", "proceeds"]),
  F("payment_other", "Other payments (CRS504)", ["other_amount", "other_income", "other_payment"]),
];

export type MatchKind = "exact" | "alias" | "normalised";

export interface ColumnMatch {
  readonly field: CanonicalField;
  readonly header: string;
  readonly kind: MatchKind;
  readonly confidence: number;
}

export interface ColumnMapping {
  readonly matches: ReadonlyMap<CanonicalField, ColumnMatch>;
  /** Headers we could not place. Often harmless, sometimes a misnamed column. */
  readonly unmatchedHeaders: readonly string[];
  /** Headers that plausibly matched more than one field — never auto-resolved. */
  readonly ambiguous: readonly { header: string; candidates: CanonicalField[] }[];
}

const normalise = (s: string): string => s.toLowerCase().trim().replace(/[\s_\-./\\]/g, "");

export function inferColumns(headers: readonly string[]): ColumnMapping {
  const matches = new Map<CanonicalField, ColumnMatch>();
  const claimed = new Set<string>();
  const ambiguous: { header: string; candidates: CanonicalField[] }[] = [];

  const byNormalisedHeader = new Map<string, string[]>();
  for (const h of headers) {
    const n = normalise(h);
    const list = byNormalisedHeader.get(n) ?? [];
    list.push(h);
    byNormalisedHeader.set(n, list);
  }

  const claim = (field: CanonicalField, header: string, kind: MatchKind, confidence: number): void => {
    if (matches.has(field) || claimed.has(header)) return;
    matches.set(field, { field, header, kind, confidence });
    claimed.add(header);
  };

  // Pass 1 — the canonical field name itself.
  for (const spec of FIELD_SPECS) {
    const hit = byNormalisedHeader.get(normalise(spec.field));
    if (hit?.[0]) claim(spec.field, hit[0], "exact", 1);
  }

  // Pass 2 — declared aliases.
  for (const spec of FIELD_SPECS) {
    if (matches.has(spec.field)) continue;
    for (const alias of spec.aliases) {
      const hit = byNormalisedHeader.get(normalise(alias));
      if (hit?.[0]) {
        claim(spec.field, hit[0], "alias", 0.9);
        break;
      }
    }
  }

  // Pass 3 — normalised containment, but only where exactly one field claims
  // the header. Anything contested is reported, not guessed.
  const remaining = headers.filter((h) => !claimed.has(h));
  for (const header of remaining) {
    const n = normalise(header);
    const candidates = FIELD_SPECS.filter((spec) => {
      if (matches.has(spec.field)) return false;
      const targets = [spec.field, ...spec.aliases].map(normalise);
      return targets.some((t) => t === n || n.includes(t) || t.includes(n));
    }).map((s) => s.field);

    if (candidates.length === 1 && candidates[0]) {
      claim(candidates[0], header, "normalised", 0.6);
    } else if (candidates.length > 1) {
      ambiguous.push({ header, candidates });
    }
  }

  return {
    matches,
    unmatchedHeaders: headers.filter((h) => !claimed.has(h) && !ambiguous.some((a) => a.header === h)),
    ambiguous,
  };
}

export const requiredFields = (): CanonicalField[] =>
  FIELD_SPECS.filter((s) => s.required).map((s) => s.field);

export const specFor = (field: CanonicalField): FieldSpec | undefined =>
  FIELD_SPECS.find((s) => s.field === field);
