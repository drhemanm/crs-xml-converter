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

describe('reference identifiers (AUDIT.md M3)', () => {
  it('starts DocRefId and MessageRefId with the transmitting country code', () => {
    const settings = { ...SETTINGS, messageRefId: '' };
    const { xml } = gen([individualRow()], settings);
    const doc = parse(xml);
    const refs = [...doc.getElementsByTagName('stf:DocRefId')].map(n => n.textContent);
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach(r => expect(r.startsWith('MU2024')).toBe(true));
    expect(doc.getElementsByTagName('MessageRefId')[0].textContent.startsWith('MU2024')).toBe(true);
  });

  it('never repeats a DocRefId within one file', () => {
    const { xml } = gen([individualRow(), individualRow({ account_number: 'MU2' }), individualRow({ account_number: 'MU3' })]);
    const refs = [...parse(xml).getElementsByTagName('stf:DocRefId')].map(n => n.textContent);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('keeps a supplied MessageRefId that already carries the country code', () => {
    const { xml } = gen([individualRow()]);
    expect(parse(xml).getElementsByTagName('MessageRefId')[0].textContent).toBe('MU2024TESTMSG001');
  });

  it('replaces one that does not', () => {
    const { xml } = gen([individualRow()], { ...SETTINGS, messageRefId: 'CRS_1699999999999' });
    expect(parse(xml).getElementsByTagName('MessageRefId')[0].textContent.startsWith('MU2024')).toBe(true);
  });

  it('respects the 200-character schema limit', () => {
    const { xml } = gen([individualRow()], { ...SETTINGS, messageRefId: '' });
    [...parse(xml).getElementsByTagName('stf:DocRefId')].forEach(n =>
      expect(n.textContent.length).toBeLessThanOrEqual(200));
  });
});

describe('dates are never guessed at (AUDIT.md M3)', () => {
  const withBirthDate = (v) => generateCRSXML(
    [individualRow(), { ...individualRow({ account_number: 'MU2' }), birth_date: v }],
    { ...SETTINGS, schemaVersion: '3.0' },
    { columnMappings: { ...COLUMN_MAPPINGS, birth_date: 'birth_date' } },
  );

  it('accepts ISO dates', () => {
    expect(withBirthDate('1980-05-12').xml).toContain('<BirthDate>1980-05-12</BirthDate>');
  });

  it('accepts an unambiguous day-first date', () => {
    expect(withBirthDate('25/12/1980').xml).toContain('<BirthDate>1980-12-25</BirthDate>');
  });

  it('accepts an unambiguous month-first date', () => {
    expect(withBirthDate('12/25/1980').xml).toContain('<BirthDate>1980-12-25</BirthDate>');
  });

  it('rejects the row when day-first and month-first both read as valid', () => {
    const { rejectedRows, accountReportCount } = withBirthDate('03/04/1980');
    expect(accountReportCount).toBe(1);
    expect(rejectedRows).toHaveLength(1);
    expect(rejectedRows[0].message).toMatch(/could be 3\/4 or 4\/3/);
  });

  it('rejects a date that is not a real calendar date', () => {
    expect(withBirthDate('1980-02-31').rejectedRows[0].message).toMatch(/not a real calendar date/);
  });

  it('rejects free text', () => {
    expect(withBirthDate('circa 1980').rejectedRows[0].message).toMatch(/will guess at/);
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the real column mapper.
//
// Every test above hands generateCRSXML a column mapping built by hand, which
// means none of them exercise validateCRSData — the code that decides which
// spreadsheet header feeds which field. That gap hid a bug where every
// dividend figure was dropped from the return.
// ---------------------------------------------------------------------------
const { validateCRSData } = require('./CRSXMLConverter');

const fromSpreadsheet = (rows, settings = SETTINGS) => {
  const validation = validateCRSData(rows);
  return { validation, ...generateCRSXML(rows, settings, validation) };
};

const spreadsheetRow = (overrides = {}) => ({
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
  ...overrides,
});

describe('through the real column mapper', () => {
  it('carries every payment type into the return', () => {
    const { xml, rejectedRows } = fromSpreadsheet([spreadsheetRow({
      interest_amount: '100',
      dividend_amount: '250',
      gross_proceeds_amount: '375',
      other_amount: '50',
    })]);
    expect(rejectedRows).toEqual([]);
    const doc = parse(xml);
    const payments = [...doc.getElementsByTagName('Payment')].map(p => ({
      type: p.getElementsByTagName('Type')[0].textContent,
      amount: p.getElementsByTagName('PaymentAmnt')[0].textContent,
    }));
    expect(payments).toEqual([
      { type: 'CRS502', amount: '100.00' },   // interest
      { type: 'CRS501', amount: '250.00' },   // dividends
      { type: 'CRS503', amount: '375.00' },   // gross proceeds
      { type: 'CRS504', amount: '50.00' },    // other
    ]);
  });

  it('does not drop dividends, which it used to', () => {
    const { xml } = fromSpreadsheet([spreadsheetRow({ dividend_amount: '9999.99' })]);
    expect(xml).toContain('<Type>CRS501</Type>');
    expect(xml).toContain('>9999.99<');
  });

  it('accepts the common header spellings for each payment column', () => {
    const { xml } = fromSpreadsheet([spreadsheetRow({ dividend: '500', interest: '25' })]);
    const doc = parse(xml);
    const types = [...doc.getElementsByTagName('Type')].map(t => t.textContent);
    expect(types).toEqual(expect.arrayContaining(['CRS501', 'CRS502']));
  });

  it('maps an organisation row end to end', () => {
    const { xml, rejectedRows } = fromSpreadsheet([spreadsheetRow({
      holder_type: 'organization',
      organization_name: 'Muster Holdings GmbH',
      organization_tin: 'DE999888777',
      account_holder_type: 'passive_nfe_reportable',
      residence_country: 'DE',
      address_country: 'DE',
      city: 'Berlin',
      first_name: '',
      last_name: '',
      controlling_person_first_name: 'Anna',
      controlling_person_last_name: 'Schmidt',
      controlling_person_residence_country: 'DE',
      controlling_person_city: 'Berlin',
      controlling_person_type: 'ownership',
    })]);
    expect(rejectedRows).toEqual([]);
    expect(xml).toContain('<AcctHolderType>CRS101</AcctHolderType>');
    expect(xml).toContain('<Name>Muster Holdings GmbH</Name>');
    expect(xml).toContain('<CtrlgPersonType>CRS801</CtrlgPersonType>');
    parse(xml);
  });

  it('reports missing critical columns before anything is generated', () => {
    const { validation } = fromSpreadsheet.length && (() => {
      const rows = [{ account_number: 'A1', account_balance: '1', currency_code: 'USD', holder_type: 'individual' }];
      return { validation: validateCRSData(rows) };
    })();
    expect(validation.canGenerate).toBe(false);
    const missing = validation.missingColumns.critical.map(c => c.field);
    expect(missing).toEqual(expect.arrayContaining(['residence_country', 'city']));
  });
});

// ---------------------------------------------------------------------------
// The template must convert.
//
// A template that does not round-trip through the converter is worse than no
// template: it teaches the wrong shape and the filer only finds out at the
// portal. So the template is fed back through the real mapper here.
// ---------------------------------------------------------------------------
const { buildTemplateCsv, buildFieldGuideCsv, TEMPLATE_COLUMNS } = require('./CRSXMLConverter');

const parseCsv = (csv) => {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...body] = rows;
  return body.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
};

describe('the downloadable template', () => {
  const rows = parseCsv(buildTemplateCsv());

  it('contains worked examples, not just headers', () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].holder_type).toBe('individual');
    expect(rows[1].holder_type).toBe('organization');
  });

  it('converts with no rejected rows under v2.0', () => {
    const validation = validateCRSData(rows);
    expect(validation.canGenerate).toBe(true);
    const result = generateCRSXML(rows, SETTINGS, validation);
    expect(result.rejectedRows).toEqual([]);
    expect(result.accountReportCount).toBe(2);
    parse(result.xml);
  });

  it('converts with no rejected rows under v3.0 either', () => {
    const validation = validateCRSData(rows);
    const result = generateCRSXML(rows, { ...SETTINGS, schemaVersion: '3.0' }, validation);
    expect(result.rejectedRows).toEqual([]);
    expect(result.accountReportCount).toBe(2);
    parse(result.xml);
  });

  it('supplies every value the converter would otherwise have to sentinel', () => {
    const validation = validateCRSData(rows);
    const { rowNotices } = generateCRSXML(rows, { ...SETTINGS, schemaVersion: '3.0' }, validation);
    expect(rowNotices).toEqual([]);
  });

  it('produces both an individual and an organisation with a controlling person', () => {
    const validation = validateCRSData(rows);
    const doc = parse(generateCRSXML(rows, { ...SETTINGS, schemaVersion: '3.0' }, validation).xml);
    // ReportingFI is its own element, so the only <Organisation> is the holder.
    expect(doc.getElementsByTagName('Organisation')).toHaveLength(1);
    expect(doc.getElementsByTagName('ReportingFI')).toHaveLength(1);
    expect(doc.getElementsByTagName('ControllingPerson')).toHaveLength(1);
    expect(doc.getElementsByTagName('BirthInfo').length).toBeGreaterThanOrEqual(2);
  });

  it('carries both payment figures through', () => {
    const validation = validateCRSData(rows);
    const doc = parse(generateCRSXML(rows, SETTINGS, validation).xml);
    const types = [...doc.getElementsByTagName('Type')].map(t => t.textContent);
    expect(types).toEqual(['CRS502', 'CRS501']);
  });

  it('every header is a field the mapper recognises', () => {
    const validation = validateCRSData(rows);
    const mapped = Object.keys(validation.columnMappings);
    TEMPLATE_COLUMNS.forEach(({ field }) => expect(mapped).toContain(field));
  });

  it('the field guide documents every template column', () => {
    const guide = parseCsv(buildFieldGuideCsv());
    expect(guide).toHaveLength(TEMPLATE_COLUMNS.length);
    guide.forEach(g => {
      expect(g.description).toBeTruthy();
      expect(g.requirement).toBeTruthy();
    });
    const holderType = guide.find(g => g.column === 'holder_type');
    expect(holderType['accepted values']).toBe('individual | organization');
  });
});

describe('column matching does not mis-claim a header', () => {
  const map = (headers) => validateCRSData([Object.fromEntries(headers.map(h => [h, 'x']))]).columnMappings;

  it('does not let a longer field name swallow a shorter header', () => {
    const m = map(['controlling_person_address', 'controlling_person_address_country']);
    expect(m.controlling_person_address).toBe('controlling_person_address');
    expect(m.controlling_person_address_country).toBe('controlling_person_address_country');
  });

  it('gives each header to at most one field', () => {
    const m = map(['account_number', 'account_balance', 'residence_country', 'address_country', 'city']);
    const used = Object.values(m);
    expect(new Set(used).size).toBe(used.length);
  });

  it('still tolerates punctuation and capitalisation', () => {
    const m = map(['Account Number', 'Account-Balance', 'CURRENCY CODE']);
    expect(m.account_number).toBe('Account Number');
    expect(m.account_balance).toBe('Account-Balance');
    expect(m.currency_code).toBe('CURRENCY CODE');
  });

  it('still tolerates a decorated header when it is unambiguous', () => {
    const m = map(['account_balance_usd']);
    expect(m.account_balance).toBe('account_balance_usd');
  });

  it('reports a column as missing rather than guessing between two candidates', () => {
    const m = map(['tin_primary', 'tin_secondary']);
    expect(m.tin).toBeUndefined();
  });

  it('maps the distinct residence and address country columns correctly', () => {
    const m = map(['residence_country', 'address_country']);
    expect(m.residence_country).toBe('residence_country');
    expect(m.address_country).toBe('address_country');
  });
});
