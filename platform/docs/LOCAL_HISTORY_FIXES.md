# Duplicate records and large local filing history

An identical account/holder row could previously become a second AccountReport
with a different DocRefId. A 20,000-account return could generate XML but exceed
the localStorage quota when saving the reference history needed for corrections.

## Resulting behavior

- Ingest, new-filing planning and plan validation now report DATA-009 for
  identical reportable account/holder payloads. Errors identify the repeated
  spreadsheet row and its first occurrence. Provenance, local business keys
  and object property order do not hide a repeat. Distinct joint holders are
  allowed; conflicting non-identical rows are not silently merged.
- Local reference history and its HMAC key use IndexedDB. Existing version-1
  localStorage history migrates in a transaction; the original copy is removed
  only after commit. A missing key or corrupt history blocks generation.
- Filing and authority-status mutations apply to a detached snapshot. The
  displayed ledger changes only after commit; a failed save retains the
  previous history and generated XML for retry.
- Revision checks prevent stale tabs from overwriting newer history. Reload
  and regenerate after a revision conflict.
- Generated XML, source rows, balances and holder details are not persisted
  in the local reference ledger.

## Validation

- 174 unit/workflow tests passed, including duplicate provenance and distinct
  joint-holder cases.
- 36 browser tests passed, including failed commit/retry/reload, legacy
  migration and correction, interrupted migration, corrupt history, stale
  tabs, duplicate CSV input, and 1,000/5,000/10,000/20,000-account workloads.
- At 20,000 accounts, all 20,001 reference entries persisted and survived
  reload. A simulated authority acceptance also survived reload; a subsequent
  correction resolved the original account DocRefId.
- Platform typecheck, browser production build and diff whitespace checks passed.

Run from platform/ with the pinned pnpm version:

```sh
pnpm typecheck
pnpm test
CHROMIUM_PATH=/path/to/chromium pnpm test:e2e
```

The volume suite is apps/web/e2e/stress.local.spec.ts. It prints measurements;
set STRESS_RESULTS_FILE to a writable path to additionally retain JSONL output.
These are local browser tests, not a production capacity or authority-acceptance
certification. IndexedDB still has browser/device quotas and is local to this
browser profile; transaction errors are surfaced and never treated as success.
The existing history export remains reference metadata, not a complete portable
backup of the per-device HMAC key.
