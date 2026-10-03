/**
 * The ledger keeps institutions apart.
 *
 * One login files for many institutions: a management company files for every
 * fund and GBC it administers. A period used to be (user, country, year), so a
 * second institution's correction picked up the first one's filings and resent
 * its ReportingFI DocRefId. The authority would then match the correction to
 * the wrong institution, or reject it.
 *
 * Firestore is replaced by an in-memory mockStore that applies the equality
 * filters the real query sends, so these tests see what the query returns, not
 * what the code hoped it would.
 */

const mockStore = { filings: [], records: {} };

jest.mock('firebase/firestore', () => ({
  collection: (_db, ...path) => ({ path }),
  query: (ref, ...constraints) => ({ ref, constraints }),
  where: (field, op, value) => ({ field, op, value }),
  orderBy: () => null,
  limit: () => null,
  getDocs: async ({ ref, constraints }) => {
    const [name, filingId, sub] = ref.path;
    const docs = name === 'filings' && !sub ? mockStore.filings : (mockStore.records[filingId] || []);
    const matches = docs.filter((d) => constraints
      .filter((c) => c && c.op === '==')
      .every((c) => d[c.field] === c.value));
    return { docs: matches.map(({ id, ...data }) => ({ id, data: () => data })) };
  },
  addDoc: jest.fn(),
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
}));

const { loadPeriodRecords, recordFiling, institutionKey } = require('./ledger');

const FUND_A = 'AAAAAA.00000.MU.001';
const FUND_B = 'BBBBBB.00000.MU.002';

const filing = (id, giin, reportingFiDocRefId, createdAt) => ({
  id, userId: 'manco', country: 'MU', taxYear: 2025, giin, reportingFiDocRefId, createdAt,
});
const record = (id, accountKey, docRefId) => ({
  id, userId: 'manco', accountKey, docRefId, docTypeIndic: 'OECD1', sequence: 1,
});

beforeEach(() => {
  // Fund A filed first, so the old code took its institution record as "the
  // original" for every institution in the period.
  mockStore.filings = [
    filing('fA', FUND_A, 'MU2025FI-A', 1),
    filing('fB', FUND_B, 'MU2025FI-B', 2),
    { ...filing('fOther', FUND_B, 'MU2025FI-X', 3), userId: 'someone-else' },
  ];
  mockStore.records = {
    fA: [record('rA', 'key-a', 'MU2025REC-A')],
    fB: [record('rB', 'key-b', 'MU2025REC-B')],
  };
});

const period = (institutionId) => loadPeriodRecords({}, {
  userId: 'manco', institutionId, country: 'MU', taxYear: 2025,
});

describe('one login, several institutions', () => {
  it("reads only the selected institution's filings and records", async () => {
    const b = await period(FUND_B);
    expect(b.filings.map((f) => f.id)).toEqual(['fB']);
    expect(b.records.map((r) => r.docRefId)).toEqual(['MU2025REC-B']);
  });

  it("resends the selected institution's own ReportingFI record on a correction", async () => {
    expect((await period(FUND_B)).reportingFiDocRefId).toBe('MU2025FI-B');
    expect((await period(FUND_A)).reportingFiDocRefId).toBe('MU2025FI-A');
  });

  it('sees nothing filed for an institution with no filings yet', async () => {
    const c = await period('CCCCCC.00000.MU.003');
    expect(c).toEqual({ filings: [], records: [], reportingFiDocRefId: null });
  });

  it('matches the identifier regardless of case and surrounding space', async () => {
    expect((await period(` ${FUND_B.toLowerCase()} `)).reportingFiDocRefId).toBe('MU2025FI-B');
  });
});

describe('an unidentified institution', () => {
  it('cannot read a period, because the period would be ambiguous', async () => {
    await expect(period('')).rejects.toThrow(/institution identifier is required/);
    await expect(period(undefined)).rejects.toThrow(/institution identifier is required/);
  });

  it('cannot record a filing, because nothing could find it again to correct', async () => {
    await expect(recordFiling({}, {
      userId: 'manco',
      settings: { reportingFI: { giin: '  ', country: 'MU' }, taxYear: 2025 },
      result: { ledgerEntries: [] },
      accountKeys: new Map(),
    })).rejects.toThrow(/institution identifier is required/);
  });

  it('normalises blank identifiers to no institution at all', () => {
    expect(institutionKey('   ')).toBeNull();
    expect(institutionKey(null)).toBeNull();
  });
});
