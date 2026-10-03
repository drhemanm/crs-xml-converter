/**
 * The code lists must be the schema's, not an approximation of them.
 */
const fs = require('fs');
const path = require('path');
const { ISO_COUNTRY_CODES, ISO_CURRENCY_CODES } = require('./isoCodes');

const XSD = fs.readFileSync(
  path.join(__dirname, '../../schemas/oecd-crs-v3.0/isocrstypes_v1.1.xsd'), 'utf8'
);
const enumeration = (typeName) => {
  const start = XSD.indexOf(`simpleType name="${typeName}"`);
  const body = XSD.slice(start, XSD.indexOf('</xsd:simpleType>', start));
  return [...body.matchAll(/enumeration value="([^"]+)"/g)].map((m) => m[1]);
};

test('country codes match CountryCode_Type in the official schema', () => {
  expect([...ISO_COUNTRY_CODES].sort()).toEqual(enumeration('CountryCode_Type').sort());
});

test('currency codes match currCode_Type in the official schema', () => {
  expect([...ISO_CURRENCY_CODES].sort()).toEqual(enumeration('currCode_Type').sort());
});
