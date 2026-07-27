/**
 * Lifecycle tests.
 *
 * These are the rules that decide whether a correction is accepted or silently
 * creates a duplicate record at the tax authority, so they are tested against
 * the stated OECD behaviour rather than against the implementation.
 */
import {
  FilingMode,
  DocTypeIndic,
  MessageTypeIndic,
  RecordState,
  buildLedgerIndex,
  messageTypeIndicFor,
  planReportingFi,
  planRecords,
  validateFiling,
  describeFiling,
} from './lifecycle';

let counter = 0;
const mint = () => `MU2024REF${++counter}`;
beforeEach(() => { counter = 0; });

const row = (key, label, sourceRow = 1) => ({
  accountKey: key,
  accountLabel: label,
  sourceRow,
});

const ledger = (...records) => buildLedgerIndex(records);

describe('message type indicator', () => {
  it('is CRS701 for new data', () => {
    expect(messageTypeIndicFor(FilingMode.New)).toBe(MessageTypeIndic.NewData);
  });

  it('is CRS702 for corrections and for voids', () => {
    expect(messageTypeIndicFor(FilingMode.Correction)).toBe(MessageTypeIndic.Corrections);
    // A void is a correction in CRS terms; there is no separate indicator.
    expect(messageTypeIndicFor(FilingMode.Void)).toBe(MessageTypeIndic.Corrections);
  });

  it('is CRS703 for a nil return', () => {
    expect(messageTypeIndicFor(FilingMode.Nil)).toBe(MessageTypeIndic.NoData);
  });
});

describe('the ledger index', () => {
  it('points at the original DocRefId after a first filing', () => {
    const index = ledger({ accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 });
    expect(index.get('a')).toMatchObject({ docRefId: 'REF1', state: RecordState.Active });
  });

  it('points at the correction, not the original, after a correction', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Corrected, sequence: 2 },
    );
    // CorrDocRefId must reference the latest version. Referencing REF1 here
    // would be rejected as correcting a superseded record.
    expect(index.get('a').docRefId).toBe('REF2');
  });

  it('points at the second correction after correcting a correction', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Corrected, sequence: 2 },
      { accountKey: 'a', docRefId: 'REF3', docTypeIndic: DocTypeIndic.Corrected, sequence: 3 },
    );
    expect(index.get('a').docRefId).toBe('REF3');
  });

  it('folds records in submission order regardless of input order', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF3', docTypeIndic: DocTypeIndic.Corrected, sequence: 3 },
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Corrected, sequence: 2 },
    );
    expect(index.get('a').docRefId).toBe('REF3');
  });

  it('marks a voided account as voided', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Void, sequence: 2 },
    );
    expect(index.get('a').state).toBe(RecordState.Voided);
  });

  it('keeps accounts separate', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'b', docRefId: 'REF2', docTypeIndic: DocTypeIndic.New, sequence: 2 },
    );
    expect(index.get('a').docRefId).toBe('REF1');
    expect(index.get('b').docRefId).toBe('REF2');
  });
});

describe('the ReportingFI record', () => {
  it('is new data on a first filing', () => {
    expect(planReportingFi(FilingMode.New, null, mint)).toEqual({
      docTypeIndic: DocTypeIndic.New,
      docRefId: 'MU2024REF1',
    });
  });

  it('is resent unchanged, under its original DocRefId, on a correction', () => {
    // A fresh DocRefId here would make this a different institution record and
    // orphan every correction hanging off it.
    expect(planReportingFi(FilingMode.Correction, { reportingFiDocRefId: 'FIREF1' }, mint)).toEqual({
      docTypeIndic: DocTypeIndic.Resent,
      docRefId: 'FIREF1',
    });
  });

  it('is resent the same way on a void', () => {
    expect(planReportingFi(FilingMode.Void, { reportingFiDocRefId: 'FIREF1' }, mint)).toEqual({
      docTypeIndic: DocTypeIndic.Resent,
      docRefId: 'FIREF1',
    });
  });

  it('is new data on a nil return', () => {
    expect(planReportingFi(FilingMode.Nil, null, mint).docTypeIndic).toBe(DocTypeIndic.New);
  });

  it('refuses a correction when the original cannot be found', () => {
    expect(planReportingFi(FilingMode.Correction, null, mint).error).toMatch(/could not be found/);
  });
});

describe('planning a new return', () => {
  it('marks every record as new', () => {
    const { planned, rejected } = planRecords(
      FilingMode.New, [row('a', 'MU001', 1), row('b', 'MU002', 2)], ledger(), mint,
    );
    expect(rejected).toEqual([]);
    expect(planned.map((p) => p.docTypeIndic)).toEqual([DocTypeIndic.New, DocTypeIndic.New]);
    expect(planned.every((p) => !p.corrDocRefId)).toBe(true);
  });

  it('refuses to re-file an account already filed for the period', () => {
    const index = ledger({ accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 });
    const { planned, rejected } = planRecords(FilingMode.New, [row('a', 'MU001')], index, mint);
    expect(planned).toEqual([]);
    expect(rejected[0].message).toMatch(/already filed for this period/);
  });

  it('allows re-filing an account that was voided', () => {
    const index = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Void, sequence: 2 },
    );
    const { planned, rejected } = planRecords(FilingMode.New, [row('a', 'MU001')], index, mint);
    expect(rejected).toEqual([]);
    expect(planned[0].docTypeIndic).toBe(DocTypeIndic.New);
  });

  it('rejects the same account twice in one message', () => {
    const { planned, rejected } = planRecords(
      FilingMode.New, [row('a', 'MU001', 1), row('a', 'MU001', 2)], ledger(), mint,
    );
    expect(planned).toHaveLength(1);
    expect(rejected[0].row).toBe(2);
    expect(rejected[0].message).toMatch(/more than once/);
  });
});

describe('planning a correction', () => {
  const index = ledger(
    { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
    { accountKey: 'b', docRefId: 'REF2', docTypeIndic: DocTypeIndic.New, sequence: 2 },
  );

  it('marks records OECD2 and points CorrDocRefId at the filed record', () => {
    const { planned, rejected } = planRecords(FilingMode.Correction, [row('a', 'MU001')], index, mint);
    expect(rejected).toEqual([]);
    expect(planned[0]).toMatchObject({
      docTypeIndic: DocTypeIndic.Corrected,
      corrDocRefId: 'REF1',
    });
    // The correction carries its own fresh DocRefId, distinct from the target.
    expect(planned[0].docRefId).not.toBe('REF1');
  });

  it('corrects only the accounts in the upload, leaving the rest alone', () => {
    const { planned } = planRecords(FilingMode.Correction, [row('a', 'MU001')], index, mint);
    expect(planned).toHaveLength(1);
    expect(planned[0].corrDocRefId).toBe('REF1');
  });

  it('refuses an account that was never filed', () => {
    const { planned, rejected } = planRecords(FilingMode.Correction, [row('zzz', 'MU999')], index, mint);
    expect(planned).toEqual([]);
    expect(rejected[0].message).toMatch(/was not in the filing being corrected/);
  });

  it('refuses to correct a voided record', () => {
    const voided = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Void, sequence: 2 },
    );
    const { rejected } = planRecords(FilingMode.Correction, [row('a', 'MU001')], voided, mint);
    expect(rejected[0].message).toMatch(/voided/);
  });

  it('chains: a second correction references the first', () => {
    const once = ledger(
      { accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 },
      { accountKey: 'a', docRefId: 'REF2', docTypeIndic: DocTypeIndic.Corrected, sequence: 2 },
    );
    const { planned } = planRecords(FilingMode.Correction, [row('a', 'MU001')], once, mint);
    expect(planned[0].corrDocRefId).toBe('REF2');
  });
});

describe('planning a void', () => {
  const index = ledger({ accountKey: 'a', docRefId: 'REF1', docTypeIndic: DocTypeIndic.New, sequence: 1 });

  it('marks records OECD3 and references the filed record', () => {
    const { planned } = planRecords(FilingMode.Void, [row('a', 'MU001')], index, mint);
    expect(planned[0]).toMatchObject({ docTypeIndic: DocTypeIndic.Void, corrDocRefId: 'REF1' });
  });

  it('refuses to void something never filed', () => {
    const { rejected } = planRecords(FilingMode.Void, [row('nope', 'MU999')], index, mint);
    expect(rejected[0].message).toMatch(/nothing to reference/);
  });
});

describe('whole-message validation', () => {
  it('accepts a normal return', () => {
    expect(validateFiling(FilingMode.New, [{ docRefId: 'R1' }, { docRefId: 'R2' }])).toEqual([]);
  });

  it('refuses a nil return that carries account reports', () => {
    expect(validateFiling(FilingMode.Nil, [{ docRefId: 'R1' }])[0]).toMatch(/cannot contain account reports/);
  });

  it('accepts an empty nil return', () => {
    expect(validateFiling(FilingMode.Nil, [])).toEqual([]);
  });

  it('refuses an empty return that is not a nil return, and says what to do', () => {
    expect(validateFiling(FilingMode.New, [])[0]).toMatch(/choose "Nil return"/);
  });

  it('catches a duplicate DocRefId', () => {
    expect(validateFiling(FilingMode.New, [{ docRefId: 'R1' }, { docRefId: 'R1' }])[0])
      .toMatch(/duplicate DocRefId/);
  });

  it('catches two records correcting the same original', () => {
    const problems = validateFiling(FilingMode.Correction, [
      { docRefId: 'R1', corrDocRefId: 'REF1' },
      { docRefId: 'R2', corrDocRefId: 'REF1' },
    ]);
    expect(problems[0]).toMatch(/corrected only once per message/);
  });
});

describe('how a filing is described back', () => {
  it('names the operation, not just a count', () => {
    expect(describeFiling(FilingMode.New, 2)).toBe('2 account reports');
    expect(describeFiling(FilingMode.Correction, 1)).toBe('1 corrected record');
    expect(describeFiling(FilingMode.Void, 3)).toBe('3 voided records');
    expect(describeFiling(FilingMode.Nil, 0)).toBe('Nil return — nothing to report');
  });
});
