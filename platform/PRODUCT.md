# AEOI Filing Platform — Product Boundary

This branch turns the existing converter into a Mauritius-first AEOI filing
product with separate CRS and FATCA engines.

## Product promise

Prepare a return, validate it, preserve filing references, handle corrections
and authority responses, and produce an auditable filing package without
uploading account-holder source data to Evologics infrastructure.

## Regimes

### CRS
- OECD CRS v2.0 and amended CRS v3.0 engine already present.
- Mauritius rule pack must be re-verified against MRA's 2026 Amended CRS
  material before production.
- New, correction, void and nil lifecycle.
- Authority status-message reconciliation.

### FATCA
- FATCA XML v2 schema family, targeted at Mauritius FI submission to MRA.
- GIIN as the reporting identifier.
- Receiving country defaults to US.
- New, corrected, void and amended codes are represented separately from CRS.
- NilReport supported.
- FATCA notification handling is a production requirement.

## Non-negotiable production gates

1. XML generation is not enough: production download must be schema-valid.
2. No invented regulatory values.
3. Reference IDs are unique and durable.
4. Corrections must point to the authority-accepted prior version.
5. Source account-holder data remains local unless the customer explicitly
   enables an encrypted enterprise vault.
6. A jurisdiction rule marked unverified may not be used to claim compliance.

## Commercial packaging

The regulatory engine is not paywalled internally. Billing sits around
workspace capabilities.

### Free
- template download
- local file validation
- small sample conversion
- no hosted filing history

### Professional
- organisation workspace
- durable encrypted filing ledger
- CRS + FATCA production exports
- corrections and nil returns
- authority response history
- bulk CSV/XLSX import
- annual subscription

### Firm / Administrator
- multiple reporting financial institutions
- delegated users and roles
- portfolio dashboard
- batch validation
- client-by-client filing ledger
- exportable audit evidence
- priority support

### Enterprise
- SSO
- private deployment / dedicated tenant
- API / SFTP ingestion
- retention controls
- service-level support

Pricing should be tested with local accounting firms, management companies,
fund administrators and financial institutions before hard-coding a number.
The product should charge for operational risk reduction and filing workflow,
not for "number of XML tags generated".
