import type { SchemaTarget } from "../lifecycle.js";
import type { Emitter } from "./common.js";
import { v2Emitter } from "./v2.js";
import { v3Emitter } from "./v3.js";

export * from "./common.js";
export { v2Emitter, V2_NAMESPACES } from "./v2.js";
export { v3Emitter, V3_NAMESPACES } from "./v3.js";

const REGISTRY: Partial<Record<SchemaTarget, Emitter>> = {
  "crs-v2.0": v2Emitter,
  "crs-v3.0": v3Emitter,
  // "uk-combined" is intentionally absent: HMRC's combined FATCA/CDOT/CRS
  // schema is a different schema family, not a CRS variant, and implementing
  // it against a guessed shape would be worse than failing loudly.
};

export function emitterFor(target: SchemaTarget): Emitter | undefined {
  return REGISTRY[target];
}

export function supportedTargets(): SchemaTarget[] {
  return Object.keys(REGISTRY) as SchemaTarget[];
}
