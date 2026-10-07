import { StaticSchemaProvider } from "@crs/validate";

import crs20 from "../../../packages/validate/schema/crs-v2.0/CrsXML_v2.0.xsd?raw";
import common20 from "../../../packages/validate/schema/crs-v2.0/CommonTypesFatcaCrs_v2.0.xsd?raw";
import fatca12v2 from "../../../packages/validate/schema/crs-v2.0/FatcaTypes_v1.2.xsd?raw";
import iso11v2 from "../../../packages/validate/schema/crs-v2.0/isocrstypes_v1.1.xsd?raw";
import oecd50v2 from "../../../packages/validate/schema/crs-v2.0/oecdcrstypes_v5.0.xsd?raw";

import crs30 from "../../../packages/validate/schema/crs-v3.0/CrsXML_v3.0.xsd?raw";
import common30 from "../../../packages/validate/schema/crs-v3.0/CommonTypesFatcaCrs_v2.0.xsd?raw";
import fatca12v3 from "../../../packages/validate/schema/crs-v3.0/FatcaTypes_v1.2.xsd?raw";
import iso11v3 from "../../../packages/validate/schema/crs-v3.0/isocrstypes_v1.1.xsd?raw";
import oecd50v3 from "../../../packages/validate/schema/crs-v3.0/oecdcrstypes_v5.0.xsd?raw";

/**
 * Browser-side schema provider.
 *
 * v3.0 files are copied from the official OECD bundle already retained by this
 * repository. The v2.0 bundle is retained as a structural validation mirror
 * and remains subject to final authority/MRA acceptance testing.
 */
export const browserSchemaProvider = new StaticSchemaProvider([
  {
    target: "crs-v2.0",
    entry: "CrsXML_v2.0.xsd",
    files: {
      "CrsXML_v2.0.xsd": crs20,
      "CommonTypesFatcaCrs_v2.0.xsd": common20,
      "FatcaTypes_v1.2.xsd": fatca12v2,
      "isocrstypes_v1.1.xsd": iso11v2,
      "oecdcrstypes_v5.0.xsd": oecd50v2,
    },
  },
  {
    target: "crs-v3.0",
    entry: "CrsXML_v3.0.xsd",
    files: {
      "CrsXML_v3.0.xsd": crs30,
      "CommonTypesFatcaCrs_v2.0.xsd": common30,
      "FatcaTypes_v1.2.xsd": fatca12v3,
      "isocrstypes_v1.1.xsd": iso11v3,
      "oecdcrstypes_v5.0.xsd": oecd50v3,
    },
  },
]);
