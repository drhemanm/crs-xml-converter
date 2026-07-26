import { describe, expect, it } from "vitest";
import {
  EmptySchemaProvider,
  SchemaValidator,
  StaticSchemaProvider,
  describeOutcome,
  isSchemaValidated,
} from "../src/index.js";

/**
 * A miniature two-file schema with an import, mirroring the shape of the real
 * CRS schemas (CrsXML imports commontypesfatcacrs, oecdcrstypes, isocrstypes).
 * If multi-file import resolution works here it will work there.
 */
const TYPES_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="urn:test:types"
            xmlns:t="urn:test:types"
            elementFormDefault="qualified">
  <xsd:simpleType name="CountryCode_Type">
    <xsd:restriction base="xsd:string">
      <xsd:pattern value="[A-Z]{2}"/>
    </xsd:restriction>
  </xsd:simpleType>
</xsd:schema>`;

const MAIN_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:t="urn:test:types"
            targetNamespace="urn:test:main"
            xmlns:m="urn:test:main"
            elementFormDefault="qualified">
  <xsd:import namespace="urn:test:types" schemaLocation="types.xsd"/>
  <xsd:element name="Report">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="Country" type="t:CountryCode_Type"/>
        <xsd:element name="Amount" type="xsd:decimal"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`;

const bundle = {
  target: "crs-v3.0" as const,
  entry: "main.xsd",
  files: { "main.xsd": MAIN_XSD, "types.xsd": TYPES_XSD },
};

const valid = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:test:main"><Country>MU</Country><Amount>1500.00</Amount></Report>`;

const wrongPattern = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:test:main"><Country>MUS</Country><Amount>1500.00</Amount></Report>`;

const missingElement = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:test:main"><Country>MU</Country></Report>`;

describe("when no schema bundle is installed", () => {
  const validator = new SchemaValidator(new EmptySchemaProvider());

  /**
   * The legacy product hardcoded xmlValidation: 'PASSED' and displayed
   * "100% XSD Compliant" without ever validating. The single most important
   * property of this module is that missing schemas can never read as success.
   */
  it("reports unavailable rather than passing", () => {
    const outcome = validator.validate(valid, "crs-v3.0");
    expect(outcome.available).toBe(false);
    expect(isSchemaValidated(outcome)).toBe(false);
  });

  it("explains what to do about it", () => {
    const outcome = validator.validate(valid, "crs-v3.0");
    expect(outcome.diagnostics[0]?.code).toBe("SCHEMA-002");
    expect(outcome.diagnostics[0]?.remediation).toMatch(/must not be described as schema-validated/);
  });

  it("describes itself honestly in a report header", () => {
    expect(describeOutcome(validator.validate(valid, "crs-v3.0"))).toMatch(/not schema-validated/);
  });
});

describe("with a real multi-file schema bundle", () => {
  const validator = new SchemaValidator(new StaticSchemaProvider([bundle]));

  it("resolves an imported schema and accepts a conforming document", () => {
    const outcome = validator.validate(valid, "crs-v3.0");
    expect(outcome.available).toBe(true);
    expect(isSchemaValidated(outcome)).toBe(true);
  });

  it("rejects a value violating a pattern defined in the imported schema", () => {
    const outcome = validator.validate(wrongPattern, "crs-v3.0");
    expect(isSchemaValidated(outcome)).toBe(false);
    if (!outcome.available) throw new Error("expected validation to have run");
    expect(outcome.valid).toBe(false);
    expect(outcome.diagnostics.length).toBeGreaterThan(0);
    expect(outcome.diagnostics[0]?.code).toBe("SCHEMA-001");
  });

  it("rejects a document missing a mandatory element", () => {
    const outcome = validator.validate(missingElement, "crs-v3.0");
    expect(isSchemaValidated(outcome)).toBe(false);
  });

  it("reports malformed XML without throwing", () => {
    const outcome = validator.validate("<Report><unclosed>", "crs-v3.0");
    expect(isSchemaValidated(outcome)).toBe(false);
  });

  it("reports unavailable for a target with no bundle", () => {
    expect(validator.validate(valid, "crs-v2.0").available).toBe(false);
  });

  it("can validate repeatedly without leaking or corrupting provider state", () => {
    for (let i = 0; i < 5; i++) {
      expect(isSchemaValidated(validator.validate(valid, "crs-v3.0"))).toBe(true);
      expect(isSchemaValidated(validator.validate(wrongPattern, "crs-v3.0"))).toBe(false);
    }
  });
});
