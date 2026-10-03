import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ISO_COUNTRY_CODES, ISO_CURRENCY_CODES } from "../src/iso-codes.js";
import { iso3166Alpha2, iso4217 } from "../src/index.js";

/** The code lists must be the schema's, not an approximation of them. */
const XSD = readFileSync(
  new URL("../../../../schemas/oecd-crs-v3.0/isocrstypes_v1.1.xsd", import.meta.url),
  "utf8",
);
const enumeration = (typeName: string): string[] => {
  const start = XSD.indexOf(`simpleType name="${typeName}"`);
  const body = XSD.slice(start, XSD.indexOf("</xsd:simpleType>", start));
  return [...body.matchAll(/enumeration value="([^"]+)"/g)].map((m) => m[1] as string);
};

describe("ISO code lists", () => {
  it("match CountryCode_Type in the official schema", () => {
    expect([...ISO_COUNTRY_CODES].sort()).toEqual(enumeration("CountryCode_Type").sort());
  });

  it("match currCode_Type in the official schema", () => {
    expect([...ISO_CURRENCY_CODES].sort()).toEqual(enumeration("currCode_Type").sort());
  });

  // Equivalence partitions: a real code, a well-formed non-code, a placeholder.
  it("accept real codes and refuse well-formed codes that are not real", () => {
    expect(iso3166Alpha2("mu").ok).toBe(true);
    expect(iso3166Alpha2("QB").ok).toBe(false);
    expect(iso3166Alpha2("XX").ok).toBe(false);
    expect(iso4217("mur").ok).toBe(true);
    expect(iso4217("ABC").ok).toBe(false);
  });
});
