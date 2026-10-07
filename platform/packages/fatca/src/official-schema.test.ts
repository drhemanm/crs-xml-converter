import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  XmlBufferInputProvider,
  XmlDocument,
  XsdValidator,
  xmlCleanupInputProvider,
  xmlRegisterInputProvider,
} from "libxml2-wasm";
import {
  FatcaAccountHolderType,
  FatcaDocTypeIndic,
  FatcaFilerCategory,
  emitFatcaXml,
  type FatcaFilingInput,
} from "./index.js";

const schema = (name: string) =>
  readFileSync(new URL(`../schema/${name}`, import.meta.url), "utf8");

const files = {
  "FatcaXML_v2.0.xsd": schema("FatcaXML_v2.0.xsd"),
  "stffatcatypes_v2.0.xsd": schema("stffatcatypes_v2.0.xsd"),
  "oecdtypes_v4.2.xsd": schema("oecdtypes_v4.2.xsd"),
  "isofatcatypes_v1.1.xsd": schema("isofatcatypes_v1.1.xsd"),
};

function validate(xml: string): void {
  const buffers: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();
  for (const [name, source] of Object.entries(files)) buffers[name] = encoder.encode(source);

  const provider = new XmlBufferInputProvider(buffers);
  const registered = xmlRegisterInputProvider(provider);
  let schemaDoc: XmlDocument | undefined;
  let instanceDoc: XmlDocument | undefined;
  let validator: XsdValidator | undefined;

  try {
    schemaDoc = XmlDocument.fromString(files["FatcaXML_v2.0.xsd"]!, { url: "FatcaXML_v2.0.xsd" });
    validator = XsdValidator.fromDoc(schemaDoc);
    instanceDoc = XmlDocument.fromString(xml);
    validator.validate(instanceDoc);
  } finally {
    validator?.dispose?.();
    instanceDoc?.dispose?.();
    schemaDoc?.dispose?.();
    if (registered) xmlCleanupInputProvider();
  }
}

const base: Omit<FatcaFilingInput, "accounts" | "nilReport"> = {
  reportingFi: {
    giin: "ABCDEF.00000.ME.480",
    name: "Example Mauritius FI",
    residenceCountry: "MU",
    filerCategory: FatcaFilerCategory.ReportingModel1Ffi,
    address: { countryCode: "MU", city: "Port Louis" },
  },
  transmittingCountry: "MU",
  receivingCountry: "US",
  reportingPeriod: "2025-12-31",
  timestamp: "2026-05-01T10:00:00Z",
  messageRefId: "ABCDEF.00000.ME.480.2025.MSG001",
  reportingFiDocRefId: "ABCDEF.00000.ME.480.FI001",
  reportingFiDocType: FatcaDocTypeIndic.New,
};

describe("FATCA structural schema regression", () => {
  it("validates a representative v2.0.1 account report against the official IRS v2.0 structural schema", () => {
    const xml = emitFatcaXml({
      ...base,
      accounts: [{
        docRefId: "ABCDEF.00000.ME.480.AR001",
        docType: FatcaDocTypeIndic.New,
        record: {
          accountNumber: "ACC001",
          holder: {
            kind: "organisation",
            name: "Example US Owner LLC",
            tin: "123456789",
            residenceCountry: "US",
            holderType: FatcaAccountHolderType.SpecifiedUsPerson,
          },
          balance: "1000.00",
          currency: "USD",
        },
      }],
    });

    expect(() => validate(xml)).not.toThrow();
  });

  it("validates a representative nil report against the official IRS v2.0 structural schema", () => {
    const xml = emitFatcaXml({
      ...base,
      nilReport: {
        docRefId: "ABCDEF.00000.ME.480.NIL001",
        docType: FatcaDocTypeIndic.New,
      },
    });

    expect(() => validate(xml)).not.toThrow();
  });
});
