import {
  XmlBufferInputProvider,
  XmlDocument,
  XsdValidator,
  xmlCleanupInputProvider,
  xmlRegisterInputProvider,
} from "libxml2-wasm";

import entry from "../../../packages/fatca/schema/FatcaXML_v2.0.1.xsd?raw";
import stf from "../../../packages/fatca/schema/stffatcatypes_v2.0.xsd?raw";
import oecd from "../../../packages/fatca/schema/oecdtypes_v4.2.xsd?raw";
import iso from "../../../packages/fatca/schema/isofatcatypes_v1.2.xsd?raw";

const files: Record<string, string> = {
  "FatcaXML_v2.0.1.xsd": entry,
  "stffatcatypes_v2.0.xsd": stf,
  "oecdtypes_v4.2.xsd": oecd,
  "isofatcatypes_v1.2.xsd": iso,
};

export interface FatcaStructuralValidation {
  valid: boolean;
  message: string;
}

/**
 * Current-rule FATCA v2.0.1 validation bundle.
 * The base schemas are IRS-published and the v1.2 ISO amendments are applied
 * from the IRS January 2026 clarification. MRA acceptance remains the final
 * production release gate.
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
    schemaDoc = XmlDocument.fromString(entry, { url: "FatcaXML_v2.0.1.xsd" });
    validator = XsdValidator.fromDoc(schemaDoc);
    instanceDoc = XmlDocument.fromString(xml);
    validator.validate(instanceDoc);
    return {
      valid: true,
      message: "FATCA v2.0.1 current-rule schema check passed. MRA acceptance remains the final release gate.",
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
