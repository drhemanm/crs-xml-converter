import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InMemoryLedger,
  known,
  planNewFiling,
  planNilReturn,
  v3Emitter,
  type FilingPlan,
} from "../../core/src/index.js";
import { address, completeRecord, individual, planContext } from "../../core/test/fixtures.js";
import { SchemaValidator, StaticSchemaProvider } from "../src/index.js";

/**
 * Emitted documents against the official OECD CRS v3.0 schema bundle, the same
 * five files the legacy app is tested against (schemas/oecd-crs-v3.0 at the
 * repository root).
 *
 * Every other emitter test reads the XML. Reading it missed three defects that
 * each made the whole file invalid or non-compliant: PostCode after City,
 * a nil return with no ReportingGroup, and Nationality in a CRS file.
 */
const SCHEMA_DIR = new URL("../../../../schemas/oecd-crs-v3.0/", import.meta.url);
const FILES = [
  "CrsXML_v3.0.xsd",
  "CommonTypesFatcaCrs_v2.0.xsd",
  "FatcaTypes_v1.2.xsd",
  "isocrstypes_v1.1.xsd",
  "oecdcrstypes_v5.0.xsd",
];

const validator = new SchemaValidator(
  new StaticSchemaProvider([
    {
      target: "crs-v3.0",
      entry: "CrsXML_v3.0.xsd",
      files: Object.fromEntries(FILES.map((f) => [f, readFileSync(new URL(f, SCHEMA_DIR), "utf8")])),
    },
  ]),
);

const asPlan = (plan: FilingPlan | unknown[]): FilingPlan => {
  if (Array.isArray(plan)) throw new Error(`expected a plan, got ${JSON.stringify(plan)}`);
  return plan;
};

const expectValid = (xml: string) => {
  const outcome = validator.validate(xml, "crs-v3.0");
  expect(outcome.available).toBe(true);
  expect(outcome.diagnostics.map((d) => d.message)).toEqual([]);
};

describe("v3.0 output against the official OECD schema", () => {
  it("a new return with a full address validates", () => {
    const withPostcode = {
      ...address,
      postCode: known("11302"),
      countrySubentity: known("Port Louis District"),
    };
    const plan = asPlan(
      planNewFiling(planContext(new InMemoryLedger()), [
        completeRecord({ holder: { ...individual, address: withPostcode } }),
      ]),
    );
    const { xml } = v3Emitter.emit(plan);
    expect(xml).toContain("PostCode>11302<");
    expectValid(xml);
  });

  it("never writes Nationality, which the OECD guide excludes from CRS", () => {
    const { xml } = v3Emitter.emit(asPlan(planNewFiling(planContext(new InMemoryLedger()), [completeRecord()])));
    expect(xml).not.toContain("Nationality");
  });

  it("a nil return validates", () => {
    expectValid(v3Emitter.emit(asPlan(planNilReturn(planContext(new InMemoryLedger())))).xml);
  });
});
