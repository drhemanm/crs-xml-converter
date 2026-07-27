/**
 * The filing lifecycle, end to end through the real generator.
 *
 * lifecycle.test.js proves the planning rules in isolation. This proves the
 * XML that comes out of a plan is the XML an authority expects: the right
 * MessageTypeIndic, DocTypeIndic on every record, CorrDocRefId pointing where
 * it should, and the institution's own record resent rather than re-minted.
 */

jest.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(() => () => {}),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: jest.fn(), setDoc: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  increment: jest.fn(), addDoc: jest.fn(), collection: jest.fn(),
  serverTimestamp: jest.fn(), query: jest.fn(), where: jest.fn(),
  orderBy: jest.fn(), limit: jest.fn(), getDocs: jest.fn(),
}));
jest.mock('firebase/analytics', () => ({ getAnalytics: () => null, logEvent: jest.fn() }));

const { generateCRSXML, validateCRSData } = require('../components/CRSXMLConverter');
const {
  FilingMode, DocTypeIndic, buildLedgerIndex, planRecords, planReportingFi,
} = require('./lifecycle');
const { createRefMinter } = require('./refs');

const SETTINGS = {
  reportingFI: {
    name: 'Test Bank Ltd', giin: 'ABC123.00000.MU.480', country: 'MU',
    address: '1 Test Street', city: 'Port Louis',
  },
  taxYear: 2024,
  schemaVersion: '2.0',
  messageRefId: '',
};

const sheetRow = (accountNumber, overrides = {}) => ({
  account_number: accountNumber,
  account_balance: '15000.50',
  currency_code: 'USD',
  holder_type: 'individual',
  residence_country: 'FR',
  address_country: 'FR',
  city: 'Paris',
  address: '10 Rue de Test',
  first_name: 'Jean',
  last_name: 'Dupont',
  ...overrides,
});

const parse = (xml) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`XML is not well-formed: ${err.textContent}`);
  return doc;
};

const text = (doc, tag) => {
  const n = doc.getElementsByTagName(tag)[0];
  return n ? n.textContent : null;
};

// Account keys stand in for the SHA-256 the browser computes; jsdom has no
// crypto.subtle, and the hash is not what these tests are about.
const keyOf = (accountNumber) => `key:${accountNumber}`;

/**
 * Everything the app does between "file uploaded" and "call the generator".
 * Kept in one place so these tests exercise the same sequence the UI does.
 */
function fileReturn(mode, rows, { previousRecords = [], previousFiling = null } = {}) {
  const validation = validateCRSData(rows.length ? rows : [sheetRow('PLACEHOLDER')]);
  const minter = createRefMinter({ country: 'MU', taxYear: 2024, batch: 'BATCH' });
  const ledgerIndex = buildLedgerIndex(previousRecords);

  const planRows = rows.map((r, i) => ({
    accountKey: keyOf(r.account_number),
    accountLabel: r.account_number,
    sourceRow: i + 1,
    accountNumber: r.account_number,
  }));

  const { planned, rejected } = planRecords(mode, planRows, ledgerIndex, minter);
  const reportingFi = planReportingFi(mode, previousFiling, minter);
  if (reportingFi.error) throw new Error(reportingFi.error);

  const docSpecByAccount = new Map(
    planned.map((p) => [p.accountNumber, {
      docTypeIndic: p.docTypeIndic,
      docRefId: p.docRefId,
      corrDocRefId: p.corrDocRefId,
    }]),
  );

  return generateCRSXML(rows, SETTINGS, validation, {
    mode, reportingFi, docSpecByAccount, rejected, minter,
  });
}

const filedRecord = (accountNumber, docRefId, sequence, docTypeIndic = DocTypeIndic.New) => ({
  accountKey: keyOf(accountNumber),
  accountLabel: accountNumber,
  docRefId,
  docTypeIndic,
  sequence,
});

describe('a new return', () => {
  it('is CRS701 with every record OECD1 and no CorrDocRefId', () => {
    const { xml, ledgerEntries } = fileReturn(FilingMode.New, [sheetRow('MU001'), sheetRow('MU002')]);
    const doc = parse(xml);
    expect(text(doc, 'MessageTypeIndic')).toBe('CRS701');
    const indics = [...doc.getElementsByTagName('stf:DocTypeIndic')].map((n) => n.textContent);
    expect(indics).toEqual(['OECD1', 'OECD1', 'OECD1']); // ReportingFI + two accounts
    expect(xml).not.toContain('CorrDocRefId');
    expect(ledgerEntries).toHaveLength(2);
  });

  it('records what it wrote, so a later correction has something to reference', () => {
    const { ledgerEntries, reportingFiDocRefId } = fileReturn(FilingMode.New, [sheetRow('MU001')]);
    expect(ledgerEntries[0]).toMatchObject({
      accountNumber: 'MU001',
      docTypeIndic: DocTypeIndic.New,
      corrDocRefId: null,
    });
    expect(ledgerEntries[0].docRefId).toMatch(/^MU2024BATCH/);
    expect(reportingFiDocRefId).toMatch(/^MU2024BATCH/);
  });
});

describe('a correction', () => {
  const previousRecords = [filedRecord('MU001', 'MU2024ORIG1', 1), filedRecord('MU002', 'MU2024ORIG2', 2)];
  const previousFiling = { reportingFiDocRefId: 'MU2024FIORIG' };

  it('is CRS702 and marks the corrected record OECD2', () => {
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001', { account_balance: '99999.00' })],
      { previousRecords, previousFiling },
    );
    const doc = parse(xml);
    expect(text(doc, 'MessageTypeIndic')).toBe('CRS702');
    const indics = [...doc.getElementsByTagName('stf:DocTypeIndic')].map((n) => n.textContent);
    expect(indics).toEqual(['OECD0', 'OECD2']); // FI resent, account corrected
  });

  it('points CorrDocRefId at the record being replaced', () => {
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    expect(text(parse(xml), 'stf:CorrDocRefId')).toBe('MU2024ORIG1');
  });

  it('resends the institution record under its original DocRefId', () => {
    // A fresh DocRefId here would make it a different institution record and
    // orphan the correction hanging off it.
    const { xml, reportingFiDocRefId } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    expect(reportingFiDocRefId).toBe('MU2024FIORIG');
    expect(parse(xml).getElementsByTagName('stf:DocRefId')[0].textContent).toBe('MU2024FIORIG');
  });

  it('gives the correction its own fresh DocRefId', () => {
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    const refs = [...parse(xml).getElementsByTagName('stf:DocRefId')].map((n) => n.textContent);
    expect(refs[1]).not.toBe('MU2024ORIG1');
    expect(refs[1]).toMatch(/^MU2024BATCH/);
  });

  it('carries only the corrected account, not the whole period', () => {
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    const doc = parse(xml);
    expect(doc.getElementsByTagName('AccountReport')).toHaveLength(1);
    expect(text(doc, 'AccountNumber')).toBe('MU001');
  });

  it('chains onto the previous correction, not the original', () => {
    const chained = [
      filedRecord('MU001', 'MU2024ORIG1', 1),
      filedRecord('MU001', 'MU2024CORR1', 2, DocTypeIndic.Corrected),
    ];
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')],
      { previousRecords: chained, previousFiling },
    );
    expect(text(parse(xml), 'stf:CorrDocRefId')).toBe('MU2024CORR1');
  });

  it('reports an account that was never filed instead of inventing a reference', () => {
    const { rejectedRows } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001'), sheetRow('MU999')],
      { previousRecords, previousFiling },
    );
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].message).toMatch(/was not in the filing being corrected/);
  });

  it('refuses entirely when the original institution record is unknown', () => {
    expect(() => fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling: null },
    )).toThrow(/could not be found/);
  });

  it('never emits CorrMessageRefId, which CRS forbids', () => {
    const { xml } = fileReturn(
      FilingMode.Correction, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    expect(xml).not.toContain('CorrMessageRefId');
  });
});

describe('a void', () => {
  const previousRecords = [filedRecord('MU001', 'MU2024ORIG1', 1)];
  const previousFiling = { reportingFiDocRefId: 'MU2024FIORIG' };

  it('is CRS702 with the record marked OECD3 and referenced', () => {
    const { xml } = fileReturn(
      FilingMode.Void, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    const doc = parse(xml);
    expect(text(doc, 'MessageTypeIndic')).toBe('CRS702');
    const indics = [...doc.getElementsByTagName('stf:DocTypeIndic')].map((n) => n.textContent);
    expect(indics).toEqual(['OECD0', 'OECD3']);
    expect(text(doc, 'stf:CorrDocRefId')).toBe('MU2024ORIG1');
  });

  it('still carries the account details, since a void names a whole record', () => {
    const { xml } = fileReturn(
      FilingMode.Void, [sheetRow('MU001')], { previousRecords, previousFiling },
    );
    expect(text(parse(xml), 'AccountNumber')).toBe('MU001');
  });
});

describe('a nil return', () => {
  it('is CRS703 with the institution record and no account reports', () => {
    const { xml, accountReportCount } = fileReturn(FilingMode.Nil, []);
    const doc = parse(xml);
    expect(text(doc, 'MessageTypeIndic')).toBe('CRS703');
    expect(doc.getElementsByTagName('ReportingFI')).toHaveLength(1);
    expect(doc.getElementsByTagName('AccountReport')).toHaveLength(0);
    expect(doc.getElementsByTagName('ReportingGroup')).toHaveLength(0);
    expect(accountReportCount).toBe(0);
  });

  it('is well-formed and carries the institution details', () => {
    const { xml } = fileReturn(FilingMode.Nil, []);
    const doc = parse(xml);
    expect(text(doc, 'Name')).toBe('Test Bank Ltd');
    expect(text(doc, 'TransmittingCountry')).toBe('MU');
    expect(text(doc, 'stf:DocTypeIndic')).toBe('OECD1');
  });

  it('needs no uploaded file at all', () => {
    expect(() => fileReturn(FilingMode.Nil, [])).not.toThrow();
  });
});

describe('the plain converter path is unchanged', () => {
  it('still produces a new return when no plan is supplied', () => {
    const rows = [sheetRow('MU001')];
    const validation = validateCRSData(rows);
    const { xml } = generateCRSXML(rows, SETTINGS, validation);
    const doc = parse(xml);
    expect(text(doc, 'MessageTypeIndic')).toBe('CRS701');
    expect(text(doc, 'stf:DocTypeIndic')).toBe('OECD1');
    expect(xml).not.toContain('CorrDocRefId');
  });
});
