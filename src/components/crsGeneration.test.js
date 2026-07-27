/**
 * Generator tests.
 *
 * These assert on the two properties that decide whether a return is accepted
 * and whether it is truthful:
 *   1. the document targets the schema the filer selected, and
 *   2. nothing appears in it that the filer did not supply.
 *
 * There is no XSD in this repository, so these tests check well-formedness and
 * structure, not full schema validation. Validating against the OECD XSD before
 * submission is still the filer's step.
 */

// Firebase is initialised at module scope. None of it is exercised here.
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

const { generateCRSXML } = require('./CRSXMLConverter');

const COLUMN_MAPPINGS = {
  account_number: 'account_number',
  account_balance: 'account_balance',
  currency_code: 'currency_code',
  holder_type: 'holder_type',
  residence_country: 'residence_country',
  address_country: 'address_country',
  city: 'city',
  address: 'address',
  first_name: 'first_name',
  last_name: 'last_name',
  self_cert: 'self_cert',
  account_type: 'account_type',
  dd_procedure: 'dd_procedure',
  organization_name: 'organization_name',
  account_holder_type: 'account_holder_type',
  nationality: 'nationality',
  joint_account: 'joint_account',
  joint_account_holders: 'joint_account_holders',
};

const VALIDATION = { columnMappings: COLUMN_MAPPINGS };

const SETTINGS = {
  reportingFI: {
    name: 'Test Bank Ltd',
    giin: 'ABC123.00000.MU.480',
    country: 'MU',
    address: '1 Test Street',
    city: 'Port Louis',
  },
  taxYear: 2024,
  schemaVersion: '2.0',
  messageRefId: 'MU2024TESTMSG001',
};

const individualRow = (overrides = {}) => ({
  account_number: 'MU1234567890',
  account_balance: '15000.50',
  currency_code: 'USD',
  holder_type: 'individual',
  residence_country: 'FR',
  address_country: 'FR',
  city: 'Paris',
  address: '10 Rue de Test',
  first_name: 'Jean',
  last_name: 'Dupont',
  self_cert: 'true',
  account_type: 'depository',
  dd_procedure: 'new_account',
  nationality: 'FR',
  ...overrides,
});

const gen = (rows, settings = SETTINGS) => generateCRSXML(rows, settings, VALIDATION);

// Parsing is what proves well-formedness; a template-literal generator can
// easily produce something that looks right and does not parse.
const parse = (xml) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`XML is not well-formed: ${err.textContent}`);
  return doc;
};

describe('schema version selection', () => {
  it('emits a v2.0 document in the v2 namespace', () => {
    const { xml, schemaVersion } = gen([individualRow()]);
    expect(schemaVersion).toBe('2.0');
    expect(xml).toContain('xmlns="urn:oecd:ties:crs:v2"');
    expect(xml).toContain('version="2.0"');
    expect(xml).toContain('CrsXML_v2.0.xsd');
    expect(xml).not.toContain('urn:oecd:ties:crs:v3');
    parse(xml);
  });

  it('emits a v3.0 document when v3.0 is selected', () => {
    const { xml, schemaVersion } = gen([individualRow()], { ...SETTINGS, schemaVersion: '3.0' });
    expect(schemaVersion).toBe('3.0');
    expect(xml).toContain('xmlns="urn:oecd:ties:crs:v3"');
    expect(xml).toContain('version="3.0"');
    parse(xml);
  });

  it('defaults to v2.0 when no version is set', () => {
    const settings = { ...SETTINGS };
    delete settings.schemaVersion;
    expect(gen([individualRow()], settings).schemaVersion).toBe('2.0');
  });

  it('omits v3.0-only elements from a v2.0 document and says which were dropped', () => {
    const row = individualRow({ joint_account: 'true', joint_account_holders: '2' });
    const { xml, droppedBySchema } = gen([row]);
    expect(xml).not.toContain('<SelfCert>');
    expect(xml).not.toContain('<AccountType>');
    expect(xml).not.toContain('<DDProcedure>');
    expect(xml).not.toContain('<JointAccount>');
    expect(xml).not.toContain('<Nationality>');
    expect(droppedBySchema).toEqual(
      expect.arrayContaining([
        'self-certification status',
        'account type',
        'due diligence procedure',
        'joint account holder count',
        'nationality',
      ]),
    );
  });

  it('includes those elements in a v3.0 document', () => {
    const row = individualRow({ joint_account: 'true', joint_account_holders: '2' });
    const { xml, droppedBySchema } = gen([row], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).toContain('<SelfCert>CRS901</SelfCert>');
    expect(xml).toContain('<AccountType>CRS1101</AccountType>');
    expect(xml).toContain('<DDProcedure>CRS1201</DDProcedure>');
    expect(xml).toContain('<JointAccount>');
    expect(xml).toContain('<Nationality>FR</Nationality>');
    expect(droppedBySchema).toEqual([]);
  });

  it('does not put targetNamespace or the FATCA namespace on the instance document', () => {
    const { xml } = gen([individualRow()], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).not.toContain('targetNamespace');
    expect(xml).not.toContain('urn:oecd:ties:fatca');
  });
});

describe('self-certification is never fabricated (audit finding C0)', () => {
  it('reports a missing self-certification as CRS900, not CRS901', () => {
    const row = individualRow({ self_cert: '' });
    const { xml, rowNotices } = gen([row], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).toContain('<SelfCert>CRS900</SelfCert>');
    expect(xml).not.toContain('CRS901');
    expect(rowNotices.map((n) => n.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('Self-certification status')]),
    );
  });

  it('still carries a supplied "false" as CRS902', () => {
    const { xml } = gen([individualRow({ self_cert: 'false' })], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).toContain('<SelfCert>CRS902</SelfCert>');
  });

  it('rejects the row rather than guessing when the value is unrecognised', () => {
    const { rejectedRows, accountReportCount } = gen(
      [individualRow(), individualRow({ self_cert: 'pending' })],
      { ...SETTINGS, schemaVersion: '3.0' },
    );
    expect(accountReportCount).toBe(1);
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].row).toBe(2);
    expect(rejectedRows[0].message).toContain('pending');
  });

  it('sentinels a missing account type and due diligence procedure', () => {
    const row = individualRow({ account_type: '', dd_procedure: '' });
    const { xml } = gen([row], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).toContain('<AccountType>CRS1100</AccountType>');
    expect(xml).toContain('<DDProcedure>CRS1200</DDProcedure>');
  });
});

describe('values that cannot be assumed', () => {
  it('rejects an organisation row with no account holder type', () => {
    const row = individualRow({
      holder_type: 'organization',
      organization_name: 'Test Holdings Ltd',
      account_holder_type: '',
      first_name: '',
      last_name: '',
    });
    const { rejectedRows, accountReportCount } = gen([individualRow(), row]);
    expect(accountReportCount).toBe(1);
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].row).toBe(2);
    expect(rejectedRows[0].message).toContain('Account holder type');
  });

  it('accepts an organisation row that supplies one', () => {
    const row = individualRow({
      holder_type: 'organization',
      organization_name: 'Test Holdings Ltd',
      account_holder_type: 'passive_nfe_reportable',
      first_name: '',
      last_name: '',
    });
    const { xml, accountReportCount } = gen([row]);
    expect(accountReportCount).toBe(1);
    expect(xml).toContain('<AcctHolderType>CRS101</AcctHolderType>');
    parse(xml);
  });

  it('rejects a row with no residence country instead of emitting XX', () => {
    const { rejectedRows, xml } = gen([
      individualRow(),
      individualRow({ residence_country: '', address_country: '' }),
    ]);
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].message).toContain('Residence country');
    expect(xml).not.toContain('XX');
  });

  it('never emits XX as a country code', () => {
    const { xml } = gen([individualRow()]);
    expect(xml).not.toContain('>XX<');
    expect(xml).not.toContain('"XX"');
  });

  it('falls back to residence country for the address country and says so', () => {
    const { xml, rowNotices } = gen([individualRow({ address_country: '' })]);
    expect(xml).toContain('<cfc:CountryCode>FR</cfc:CountryCode>');
    expect(rowNotices.map((n) => n.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('Address country')]),
    );
  });
});

describe('addresses', () => {
  it('omits Street rather than writing "Not Provided" into it', () => {
    const { xml } = gen([individualRow({ address: '' })]);
    expect(xml).not.toContain('Not Provided');
    // The only Street left is the reporting institution's, which was supplied.
    expect(xml.match(/<cfc:Street>/g)).toHaveLength(1);
    expect(xml).toContain('<cfc:Street>1 Test Street</cfc:Street>');
    expect(xml).toContain('<cfc:City>Paris</cfc:City>');
    parse(xml);
  });

  it('rejects a row with no city, since City is mandatory', () => {
    const { rejectedRows } = gen([individualRow(), individualRow({ city: '' })]);
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].message).toContain('City is required');
  });

  it('does not claim an address is residential when it is not known to be', () => {
    const { xml } = gen([individualRow()]);
    expect(xml).toContain('legalAddressType="OECD301"');
    expect(xml).not.toContain('legalAddressType="OECD302"');
  });

  it('rejects the row rather than the whole file when a controlling person has no city', () => {
    const orgRow = individualRow({
      holder_type: 'organization',
      organization_name: 'Test Holdings Ltd',
      account_holder_type: 'reportable_person',
      first_name: '',
      last_name: '',
    });
    const mappings = {
      ...COLUMN_MAPPINGS,
      controlling_person_first_name: 'cp_first',
      controlling_person_last_name: 'cp_last',
      controlling_person_residence_country: 'cp_country',
      controlling_person_city: 'cp_city',
    };
    const rows = [
      individualRow(),
      { ...orgRow, cp_first: 'Anna', cp_last: 'Schmidt', cp_country: 'DE', cp_city: '' },
    ];
    const result = generateCRSXML(rows, SETTINGS, { columnMappings: mappings });
    expect(result.accountReportCount).toBe(1);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0].row).toBe(2);
    parse(result.xml);
  });
});

describe('what the file dropped', () => {
  it('reports a value as dropped only when the filer supplied one', () => {
    const blank = individualRow({
      self_cert: '', account_type: '', dd_procedure: '', nationality: '',
    });
    expect(gen([blank]).droppedBySchema).toEqual([]);
  });

  it('does not claim v2.0 reports "not reported" for elements it does not have', () => {
    const blank = individualRow({ self_cert: '', account_type: '', dd_procedure: '' });
    const { rowNotices } = gen([blank]);
    expect(rowNotices.map((n) => n.message).join(' ')).not.toContain('not reported');
  });

  it('but does say so under v3.0, where the element exists', () => {
    const blank = individualRow({ self_cert: '', account_type: '', dd_procedure: '' });
    const { rowNotices } = gen([blank], { ...SETTINGS, schemaVersion: '3.0' });
    expect(rowNotices.map((n) => n.message).join(' ')).toContain('not reported');
  });
});

describe('rejected rows are surfaced, not swallowed', () => {
  it('counts only the reports actually written', () => {
    const rows = [
      individualRow(),
      individualRow({ residence_country: '' }),
      individualRow({ account_number: '' }),
      individualRow(),
    ];
    const { xml, accountReportCount, rejectedRows } = gen(rows);
    expect(accountReportCount).toBe(2);
    expect(rejectedRows).toHaveLength(2);
    expect(parse(xml).getElementsByTagName('AccountReport')).toHaveLength(2);
  });

  it('throws with the first reason when every row fails', () => {
    expect(() => gen([individualRow({ residence_country: '' })])).toThrow(/Residence country/);
  });

  it('does not silently truncate when more than half the rows fail', () => {
    const rows = [individualRow(), individualRow({ account_number: '' }), individualRow({ account_number: '' })];
    const { accountReportCount, rejectedRows } = gen(rows);
    expect(accountReportCount).toBe(1);
    expect(rejectedRows).toHaveLength(2);
  });
});

describe('document structure', () => {
  it('carries the enum code in AcctNumberType, not the label', () => {
    const { xml } = gen([individualRow()]);
    expect(xml).toContain('AcctNumberType="OECD605"');
    expect(xml).not.toContain('AcctNumberType="Other"');
  });

  it('escapes markup in supplied values', () => {
    const { xml } = gen([individualRow({ last_name: 'O\'Brien & <Sons>' })]);
    expect(xml).toContain('O&#39;Brien &amp; &lt;Sons&gt;');
    parse(xml);
  });

  it('builds a message header from the reporting institution', () => {
    const doc = parse(gen([individualRow()]).xml);
    const text = (tag) => doc.getElementsByTagName(tag)[0].textContent;
    expect(text('TransmittingCountry')).toBe('MU');
    expect(text('MessageRefId')).toBe('MU2024TESTMSG001');
    expect(text('MessageTypeIndic')).toBe('CRS701');
    expect(text('ReportingPeriod')).toBe('2024-12-31');
  });

  it('emits a controlling person only when the row carries one', () => {
    const withoutCp = individualRow({
      holder_type: 'organization',
      organization_name: 'Test Holdings Ltd',
      account_holder_type: 'reportable_person',
      first_name: '',
      last_name: '',
    });
    const { xml, rowNotices } = gen([withoutCp], { ...SETTINGS, schemaVersion: '3.0' });
    expect(xml).not.toContain('<ControllingPerson>');
    // No phantom "controlling person self-certification not supplied" notice.
    expect(rowNotices.map((n) => n.message).join(' ')).not.toContain('Controlling person');
  });
});

// ---------------------------------------------------------------------------
// Spreadsheet parse hardening (AUDIT.md H4)
//
// xlsx 0.18.5 carries unfixed prototype-pollution and ReDoS advisories on npm
// and the fixed builds are not published there, so the parse boundary defends
// itself. These tests cover that defence, not the library.
// ---------------------------------------------------------------------------
const { sanitizeParsedRows, detectPrototypePollution, MAX_UPLOAD_BYTES } = require('./CRSXMLConverter');

describe('parsed rows are sanitised', () => {
  it('drops keys that could reach Object.prototype', () => {
    const rows = sanitizeParsedRows([
      JSON.parse('{"account_number":"A1","__proto__":{"polluted":true},"constructor":"x","prototype":"y"}'),
    ]);
    expect(Object.keys(rows[0])).toEqual(['account_number']);
    expect({}.polluted).toBeUndefined();
  });

  it('rebuilds rows without a prototype, so a key cannot be inherited', () => {
    const rows = sanitizeParsedRows([{ account_number: 'A1' }]);
    expect(Object.getPrototypeOf(rows[0])).toBeNull();
    expect(rows[0].toString).toBeUndefined();
  });

  it('keeps ordinary values intact', () => {
    const rows = sanitizeParsedRows([{ a: 'x', b: 0, c: '', d: false }]);
    expect(rows[0]).toEqual(expect.objectContaining({ a: 'x', b: 0, c: '', d: false }));
  });

  it('still supports the reads the converter performs', () => {
    const [row] = sanitizeParsedRows([{ account_number: 'MU1', holder_type: 'individual' }]);
    expect(Object.keys(row)).toEqual(['account_number', 'holder_type']);
    expect(row['account_number']).toBe('MU1');
  });
});

describe('prototype pollution is detected and undone', () => {
  it('reports nothing when the prototype is untouched', () => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    expect(detectPrototypePollution(before)).toEqual([]);
  });

  it('reports and removes a property added during parsing', () => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    // eslint-disable-next-line no-extend-native
    Object.prototype.pwned = 'yes';
    try {
      expect(detectPrototypePollution(before)).toEqual(['pwned']);
      expect({}.pwned).toBeUndefined();
    } finally {
      delete Object.prototype.pwned;
    }
  });
});

describe('upload size cap', () => {
  it('is bounded', () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });
});
