# Production Runbook

This runbook defines the operational controls for the Mauritius AEOI platform.

## Release gate

A production release requires all of the following:

1. `pnpm install --frozen-lockfile`
2. TypeScript passes with no errors.
3. The Vite production bundle builds successfully.
4. `pnpm audit --prod --audit-level high` passes.
5. Unit and integration tests pass.
6. Chromium end-to-end tests pass.
7. Supabase security advisor has no ERROR findings.
8. CRS v3.0 and FATCA v2.0.1 validation gates pass.
9. No unresolved high/critical security issue exists.
10. MRA acceptance is required before the product is described as MRA-approved or production-certified for filing.

## Data boundary

The backend stores only:
- organisation and reporting-FI metadata
- MessageRefId / DocRefId lifecycle metadata
- pseudonymous business keys
- hashes
- filing status
- authority-response metadata
- audit events

Do not store source spreadsheets, account-holder names, TINs, addresses,
account numbers or balances in Supabase.

Generated XML remains in the browser unless the user explicitly downloads it.

## Authentication and secrets

- Browser uses the Supabase publishable key only.
- Never put service-role keys, database passwords or private signing keys in Vite environment variables.
- Access to filing metadata is constrained by Supabase RLS and guarded RPCs.
- Filing and audit tables do not permit direct authenticated writes.
- Rotate credentials immediately if a privileged credential is exposed.
- Review organisation membership after personnel changes.

## Backup and recovery

The database is the system of record for filing metadata, not source tax data.

Target operational objectives:
- metadata RPO: <= 24 hours
- metadata RTO: <= 4 hours
- generated/source financial data RPO: not applicable; source data remains with the customer

Before paid production:
- confirm the active Supabase plan provides backups suitable for the RPO
- enable PITR if the selected plan and contractual risk require a tighter RPO
- perform and document at least one restore test before onboarding the first paying institution
- preserve accepted MRA XML/status-message golden fixtures outside the operational database

Recovery order:
1. Freeze filing writes if data integrity is uncertain.
2. Preserve logs and current database state.
3. Restore the last known-good database or PITR point.
4. Reconcile filings created after the restore point using MRA acknowledgements and locally held XML hashes.
5. Run integrity queries on DocRefId uniqueness and correction chains.
6. Re-enable writes only after reconciliation is signed off.

## Incident response

Severity 1:
- cross-tenant data access
- forged or corrupted filing history
- leaked privileged credential
- generated XML materially differing from validated rules
- inability to determine what was submitted to MRA

For Severity 1:
1. Disable affected connected-workspace actions.
2. Preserve evidence and logs.
3. Rotate exposed credentials.
4. Identify affected organisations and filings.
5. Do not delete audit evidence.
6. Reconcile with MRA acknowledgements/status messages.
7. Apply remediation and regression tests before reopening.
8. Follow contractual and legal notification obligations.

## Monitoring

Review:
- Supabase Auth/Postgres/API error rates
- failed guarded-RPC calls
- repeated authentication failures
- Vercel deployment/build failures
- schema-validation failures
- MRA rejection/status trends
- Supabase security/performance advisors after every DDL migration

Do not log source spreadsheet rows, TINs, account numbers, balances or full XML.

## Change management

Regulatory changes are code changes.

For every OECD/MRA schema or business-rule update:
1. save the primary source and effective date
2. update the jurisdiction rule metadata
3. update schema/golden fixtures
4. run the full suite
5. validate against controlled authority samples where possible
6. retain the prior version for corrections where required

Never silently migrate an old reporting period to a new schema solely because
the current date changed.

## Rollback

Application releases are immutable Vercel deployments. If a release causes a
regression, promote the last known-good deployment.

Database migrations are forward-only in normal operations. Destructive rollback
must use a tested compensating migration or database restore. Never hand-edit
filing/ledger rows to "fix" history.

## MRA acceptance

Before commercial production filing:
- obtain controlled MRA acceptance for CRS v3.0
- obtain controlled MRA acceptance for FATCA v2.0.1
- retain the exact accepted XML and response/status message as golden fixtures
- add those fixtures to regression tests without customer PII

Until that occurs, the UI and commercial materials must describe regulator
acceptance as pending.
