import {
  XmlBufferInputProvider,
  XmlDocument,
  XsdValidator,
  xmlCleanupInputProvider,
  xmlRegisterInputProvider,
} from "libxml2-wasm";

import entry from "../../../packages/fatca/schema/FatcaXML_v2.0.xsd?raw";
import stf from "../../../packages/fatca/schema/stffatcatypes_v2.0.xsd?raw";
import oecd from "../../../packages/fatca/schema/oecdtypes_v4.2.xsd?raw";
import iso from "../../../packages/fatca/schema/isofatcatypes_v1.1.xsd?raw";

const files: Record<string, string> = {
  "FatcaXML_v2.0.xsd": entry,
  "stffatcatypes_v2.0.xsd": stf,
  "oecdtypes_v4.2.xsd": oecd,
  "isofatcatypes_v1.1.xsd": iso,
};

export interface FatcaStructuralValidation {
  valid: boolean;
  message: string;
}

/**
 * Structural backstop using the IRS-published FATCA v2 schema family.
 * The product target is v2.0.1. Until that exact bundle is installed and
 * MRA accepts a controlled test file, this result must not be described as
 * production certification.
 */
export function validateFatcaStructure(xml: string): FatcaStructuralValidation {
  const encoder = new TextEncoder();
  const buffers = Object.fromEntries(
    Object.entries(files).map(([name, source]) => [name, encoder.encode(source)]),
  );
  const provider = new XmlBufferInputProvider(buffers);
  const registered = xmlRegisterInputProvider(provider);

  let schemaDoc: XmlDocument | undefined;
  let instanceDoc: XmlDocument | undefined;
  let validator: XsdValidator | undefined;
  try {
    schemaDoc = XmlDocument.fromString(entry, { url: "FatcaXML_v2.0.xsd" });
    validator = XsdValidator.fromDoc(schemaDoc);
    instanceDoc = XmlDocument.fromString(xml);
    validator.validate(instanceDoc);
    return {
      valid: true,
      message: "IRS FATCA v2 structural schema check passed. Exact v2.0.1 and MRA acceptance remain release gates.",
    };
  } catch (cause) {
    return {
      valid: false,
      message: String((cause as Error)?.message ?? cause),
    };
  } finally {
    validator?.dispose?.();
    instanceDoc?.dispose?.();
    schemaDoc?.dispose?.();
    if (registered) xmlCleanupInputProvider();
  }
}
