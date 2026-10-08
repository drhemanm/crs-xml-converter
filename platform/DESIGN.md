# CRS and FATCA workspace design

## Purpose and users

The platform helps reporting teams prepare, validate and retain references for
CRS and Mauritius FATCA XML filings. Its primary user is a compliance officer
or reporting operator, often working to a deadline. Generation and metadata
recording are separate from submission to the authority.

## Design philosophy

Make complex reporting understandable, keep the operator in control and show
evidence of what was checked. The intended psychological effect is confidence
through clarity and predictable behaviour. Avoid decorative complexity,
unsupported compliance claims and pressure to complete a filing prematurely.

### Shared interface rules

- Persistent navigation identifies the active reporting regime. Both regimes
  use the same type scale, spacing, surface colours, forms and primary actions.
- The reporting task is the main surface. Workspace authentication is secondary
  and local evaluation is explicitly identified.
- Guide users through institution, filing type, account data and generation.
  Preserve the existing reporting workflows rather than introducing a new
  navigation model inside every regime.
- Readiness distinguishes input preparation, validation, history storage and
  external authority acceptance. Generated output never implies MRA approval.
- Use a restrained teal accent, neutral surfaces and semantic error, warning
  and success colours with text labels. Support the system dark mode.
- Controls have visible focus, selected-state semantics and minimum 42-pixel
  heights. Narrow screens use a single form column and horizontal regime
  navigation. Honour reduced-motion preferences.
- Diagnostics identify the affected field or source cell and explain recovery.
  Dense technical references remain available for audit and correction work.

## Behavioural guarantees introduced in this change

- Switching regimes retains unfinished drafts in memory. It does not persist
  source taxpayer data. Reloading still clears unfinished work and warns when
  there is a draft.
- Editing filing inputs or changing the source worksheet invalidates existing
  XML and its successful-validation display.
- In-flight CRS generation cannot publish a result after its inputs change.
  Concurrent generation requests are guarded and failures appear in the UI.
- Replacing a source file clears the previous records immediately. Stale file
  reads and workspace ledger loads cannot overwrite newer selections.
- Changing a workspace clears source data and FATCA reference inputs to reduce
  accidental cross-institution reuse.
- CRS ingestion errors block the output, including when other rows mapped
  successfully. Corrections with unmatched accounts fail as a whole instead
  of silently skipping them.
- FATCA source ingestion rejects unknown holder kinds, ambiguous account-closed
  flags, incomplete payments, unknown payment codes and correction references
  in new information. It does not silently omit supplied payment data.
- Connected history does not offer a local-only clear operation.
- Page and deployment CSP both permit the dedicated metadata endpoint, while
  retaining the existing restrictive source allowlist.
- FATCA code and CRS validation resources load on demand, reducing the initial
  application JavaScript rather than suppressing bundle-size warnings.

## Verification and release boundaries

Run the TypeScript checks, domain/integration tests, production build,
dependency audit and browser suite before release. Browser regressions cover
draft retention, stale output, blocked partial imports, replacement sources,
CSP authentication and narrow viewports.

The Vitest configuration includes local React DOM state tests and FATCA tests under `packages/fatca/src/`;
previously the `test/`-only glob omitted them.

This change is not a claim of a completed visual/accessibility audit, regulator
acceptance or zero defects. Cloud Browser could not reach the local preview in
the implementation session. Visual inspection of the deployed preview, live
workspace end-to-end verification and controlled MRA acceptance remain separate
release gates. See `PRODUCTION_RUNBOOK.md` for the operational requirements.

## Commercial administration

Company billing and Evologics operations use the same workspace tokens and
readable form controls. Operator navigation is distinct from reporting regimes;
opening it preserves an unfinished filing draft. Portfolio tables show company
licence status, actual recorded usage and the last filing date. Currency totals
are never combined into an invented revenue number.

Customer billing explains what consumes allowance and what is excluded. A
checkout return is shown as a confirmation step until the provider capture is
verified. Operator bank reconciliation states the exact amount and requires a
statement reference; suspension and restoration require an audit reason.

Both surfaces enforce permissions in the backend, display loading/error/empty
states, and keep account-holder source information out of commercial reporting.
