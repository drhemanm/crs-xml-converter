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
function fileReturn(mode, rows, { previousRecords = [], previousFiling = null, settings = SETTINGS } = {}) {
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

  return generateCRSXML(rows, settings, validation, {
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
    // Present and empty: the schema requires the element even with nothing in it.
    expect(doc.getElementsByTagName('ReportingGroup')).toHaveLength(1);
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

/**
 * Validity against the official OECD CRS v3.0 schema, which is committed in
 * schemas/oecd-crs-v3.0.
 *
 * Every other test here checks the XML by reading it, and reading it missed
 * two defects that each made the file invalid: PostCode written after City
 * (so any address with a postcode failed), and nil returns that left out the
 * mandatory ReportingGroup. Only the schema catches errors like these, so the
 * schema is the test.
 *
 * Needs xmllint (libxml2-utils). Without it this test fails. It does not
 * skip, because a validation that is quietly skipped reads as a pass.
 */
describe('schema validity (OECD CRS XML v3.0)', () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { TEMPLATE_COLUMNS } = require('../components/CRSXMLConverter');

  const XSD = path.join(__dirname, '../../schemas/oecd-crs-v3.0/CrsXML_v3.0.xsd');
  const V3 = { ...SETTINGS, schemaVersion: '3.0' };

  const validate = (xml) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crs-')), 'filing.xml');
    fs.writeFileSync(file, xml);
    try {
      execFileSync('xmllint', ['--noout', '--schema', XSD, file], { stdio: 'pipe' });
    } catch (e) {
      if (e.code === 'ENOENT') throw new Error('xmllint is not installed (apt-get install libxml2-utils).');
      throw new Error(String(e.stderr));
    }
  };

  // Every template column present, as in a real upload, and every optional
  // field exercised somewhere -- an element only gets checked if it is emitted.
  const blank = Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c.field, '']));
  const rows = [
    {
      account_number: 'MU0011223344', account_balance: '15000.50', currency_code: 'USD',
      holder_type: 'individual', residence_country: 'FR', city: 'Paris', address: '10 Rue de Test',
      address_country: 'FR', postal_code: '75001', state: 'IDF', first_name: 'Jean', middle_name: 'Paul',
      last_name: 'Dupont', tin: 'FR1234567890', birth_date: '1980-05-12', birth_city: 'Lyon',
      birth_country: 'FR', nationality: 'FR', self_cert: 'true', account_type: 'depository',
      dd_procedure: 'new_account', interest_amount: '250.75', dividend_amount: '1',
      gross_proceeds_amount: '10', other_amount: '5',
    },
    {
      account_number: 'MU0044556677', account_balance: '980000.00', currency_code: 'EUR',
      holder_type: 'organization', residence_country: 'DE', city: 'Berlin', address: '5 Testweg',
      address_country: 'DE', postal_code: '10115', organization_name: 'Muster Holdings GmbH',
      organization_tin: 'DE999888777', account_holder_type: 'passive_nfe_reportable',
      controlling_person_first_name: 'Anna', controlling_person_last_name: 'Schmidt',
      controlling_person_residence_country: 'DE', controlling_person_city: 'Berlin',
      controlling_person_address: '9 Beispielstrasse', controlling_person_tin: 'DE111222333',
      controlling_person_birth_date: '1975-09-30', controlling_person_type: 'ownership',
      controlling_person_self_cert: 'true', self_cert: 'true', account_type: 'custodial',
      dd_procedure: 'preexisting',
    },
    {
      account_number: 'MU0099', account_balance: '0', currency_code: 'MUR', holder_type: 'organization',
      residence_country: 'GB', city: 'London', address: '1 High St', address_country: 'GB',
      organization_name: 'Plain Co Ltd', account_holder_type: 'reportable_person', self_cert: 'false',
      account_type: 'investment_entity', dd_procedure: 'preexisting', closed_account: 'true',
      dormant_account: 'true', joint_account: 'true', joint_account_holders: '2',
    },
    {
      // Absent classifications become "not reported" sentinels, and the name
      // needs escaping.
      account_number: 'MU0100', account_balance: '42', currency_code: 'USD', holder_type: 'individual',
      residence_country: 'US', city: 'Austin', address_country: 'US', first_name: 'Ann & <Co>',
      last_name: "O'Neil", undocumented_account: 'true',
    },
  ].map((r) => ({ ...blank, ...r }));

  const original = () => fileReturn(FilingMode.New, rows, { settings: V3 });
  const history = (filed) => ({
    previousRecords: filed.ledgerEntries.map((e, i) => filedRecord(e.accountNumber, e.docRefId, i + 1)),
    previousFiling: { reportingFiDocRefId: filed.reportingFiDocRefId },
    settings: V3,
  });

  it('a new return validates, with every row reported', () => {
    const filed = original();
    expect(filed.rejectedRows).toEqual([]);
    expect(filed.accountReportCount).toBe(rows.length);
    validate(filed.xml);
  });

  it('a correction validates', () => {
    validate(fileReturn(FilingMode.Correction, rows.slice(0, 2), history(original())).xml);
  });

  it('a void validates', () => {
    validate(fileReturn(FilingMode.Void, rows.slice(1, 2), history(original())).xml);
  });

  it('a nil return validates', () => {
    validate(fileReturn(FilingMode.Nil, [], { settings: V3 }).xml);
  });
});
