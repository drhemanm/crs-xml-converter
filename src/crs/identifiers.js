/**
 * Which identifier goes where, per regime.
 *
 * CRS and FATCA identify the same institution differently, and the two must
 * never be conflated:
 *
 *   CRS, Mauritius   The FI's domestic Tax Account Number (TAN), in both
 *                    MessageSpec/SendingCompanyIN and ReportingFI/IN. This is
 *                    what MRA's own CRS sample file carries.
 *   CRS, elsewhere   The GIIN, as this converter has always sent. No other
 *                    jurisdiction's sample has been checked; each one moves to
 *                    its domestic identifier only on the same kind of evidence.
 *   FATCA            The GIIN, in SendingCompanyIN and ReportingFI/TIN, for a
 *                    standard reporting FI. Sponsored entities and trustee-
 *                    documented trusts are mapped through the FATCA filer
 *                    category, which belongs to the FATCA output, not here.
 *
 * Both values are kept as separate fields on the institution. A CRS return for
 * Mauritius never carries the GIIN, and a FATCA return never carries the TAN.
 */

export const IdentifierType = {
  TAN: 'TAN',
  GIIN: 'GIIN',
};

/** Jurisdictions whose CRS identifier is not the GIIN, with the evidence. */
const CRS_IDENTIFIER_BY_COUNTRY = {
  // MRA's CRS sample: the domestic identifier in SendingCompanyIN and
  // ReportingFI/IN. Registration on the MRA CRS portal is by TAN.
  MU: IdentifierType.TAN,
};

/** The settings field each identifier type is entered in. */
const FIELD_BY_TYPE = {
  [IdentifierType.TAN]: 'tan',
  [IdentifierType.GIIN]: 'giin',
};

export const IDENTIFIER_LABELS = {
  [IdentifierType.TAN]: 'TAN',
  [IdentifierType.GIIN]: 'GIIN',
};

export function crsIdentifierType(country) {
  return CRS_IDENTIFIER_BY_COUNTRY[String(country || '').toUpperCase()] || IdentifierType.GIIN;
}

/** The settings field that holds the CRS identifier for a jurisdiction. */
export function crsIdentifierField(country) {
  return FIELD_BY_TYPE[crsIdentifierType(country)];
}

/**
 * The identifier a CRS return carries for this institution, exactly as
 * entered, or null when it has not been entered.
 *
 * Returned untrimmed on purpose: ledger account keys are hashed over this
 * value, and GIIN-keyed periods filed before this module existed were hashed
 * over the raw field. Changing it would orphan their records.
 */
export function crsInstitutionIdentifier(reportingFI) {
  const country = reportingFI && reportingFI.country;
  const type = crsIdentifierType(country);
  const value = reportingFI ? reportingFI[FIELD_BY_TYPE[type]] : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  return { type, value, issuedBy: country || null };
}

/**
 * Mauritius Tax Account Number: eight digits.
 *
 * Checked for shape only. Whether a TAN belongs to the institution is
 * something only MRA can confirm.
 */
export function validateTAN(tan) {
  if (typeof tan !== 'string' || tan.trim() === '') {
    return { valid: false, message: 'The institution\'s TAN is required for a Mauritius CRS return.', severity: 'error' };
  }
  if (!/^\d{8}$/.test(tan.trim())) {
    return { valid: false, message: 'A TAN is 8 digits, as issued by MRA.', severity: 'error' };
  }
  return { valid: true };
}
