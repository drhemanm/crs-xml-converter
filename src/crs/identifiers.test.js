import {
  IdentifierType, crsIdentifierType, crsIdentifierField, crsInstitutionIdentifier, validateTAN,
} from './identifiers';

const MU_FI = { country: 'MU', tan: '20123456', giin: 'ABC123.00000.MU.480' };

describe('which identifier a CRS return carries', () => {
  it('is the TAN for Mauritius, whatever the case of the country code', () => {
    expect(crsIdentifierType('MU')).toBe(IdentifierType.TAN);
    expect(crsIdentifierType('mu')).toBe(IdentifierType.TAN);
    expect(crsIdentifierField('MU')).toBe('tan');
  });

  it('stays the GIIN elsewhere', () => {
    expect(crsIdentifierType('KY')).toBe(IdentifierType.GIIN);
    expect(crsIdentifierType(undefined)).toBe(IdentifierType.GIIN);
  });

  it('takes the TAN, never the GIIN, for a Mauritius institution', () => {
    expect(crsInstitutionIdentifier(MU_FI)).toEqual({ type: 'TAN', value: '20123456', issuedBy: 'MU' });
  });

  it('is absent, not substituted, when the TAN is missing', () => {
    expect(crsInstitutionIdentifier({ ...MU_FI, tan: '  ' })).toBeNull();
    expect(crsInstitutionIdentifier({ ...MU_FI, tan: undefined })).toBeNull();
  });

  it('is returned exactly as entered, because ledger keys are hashed over it', () => {
    const ky = { country: 'KY', giin: 'abc123.00000.ky.480 ' };
    expect(crsInstitutionIdentifier(ky).value).toBe('abc123.00000.ky.480 ');
  });
});

describe('TAN shape', () => {
  it('accepts eight digits', () => {
    expect(validateTAN('20123456').valid).toBe(true);
    expect(validateTAN(' 20123456 ').valid).toBe(true);
  });

  it.each(['', '2012345', '201234567', '2012345A', 'ABC123.00000.MU.480', null])(
    'refuses %p',
    (tan) => expect(validateTAN(tan).valid).toBe(false),
  );
});
