/**
 * XSD schema validation.
 *
 * Two design commitments:
 *
 * 1. **The same code path runs in the browser and in CI.** libxml2 compiled to
 *    WebAssembly means a filer's document is validated against the official
 *    OECD schemas *on their own machine*, so account-holder data never leaves
 *    it. That is what makes the compliance claim true rather than asserted.
 *
 * 2. **Unavailable schemas are reported, never assumed to pass.** The legacy
 *    implementation hardcoded `xmlValidation: 'PASSED'` and displayed "100%
 *    XSD Compliant" without performing any validation at all. Here, if the
 *    schemas have not been vendored, callers get `available: false` and must
 *    surface that. There is no code path that reports success without having
 *    validated.
 *
 * The OECD XSDs are not redistributed in this repository. They are published
 * as a ZIP on the OECD Tax Transparency Resource Centre and must be placed in
 * packages/schema by whoever operates the product, who should also confirm the
 * OECD's terms of use for redistribution.
 */
import {
  XmlDocument,
  XsdValidator,
  XmlBufferInputProvider,
  xmlRegisterInputProvider,
  xmlCleanupInputProvider,
  type ErrorDetail,
} from "libxml2-wasm";
import {
  DiagnosticCode,
  error as diagError,
  warning as diagWarning,
  type Diagnostic,
  type SchemaTarget,
} from "@crs/core";

/** An entry schema plus every file it imports, keyed by the name used in schemaLocation. */
export interface SchemaBundle {
  readonly target: SchemaTarget;
  /** Entry point, e.g. "CrsXML_v3.0.xsd". */
  readonly entry: string;
  /** filename → XSD source. Must include every transitively imported schema. */
  readonly files: Readonly<Record<string, string>>;
}

export interface SchemaProvider {
  bundleFor(target: SchemaTarget): SchemaBundle | undefined;
}

/**
 * The default provider when no schemas have been vendored.
 *
 * It exists so the honest answer — "we could not validate" — is the default,
 * rather than something a developer has to remember to implement.
 */
export class EmptySchemaProvider implements SchemaProvider {
  bundleFor(): undefined {
    return undefined;
  }
}

/** Schemas supplied from disk, a bundler import, or a fetch. */
export class StaticSchemaProvider implements SchemaProvider {
  readonly #bundles = new Map<SchemaTarget, SchemaBundle>();

  constructor(bundles: readonly SchemaBundle[] = []) {
    for (const b of bundles) this.#bundles.set(b.target, b);
  }

  add(bundle: SchemaBundle): this {
    this.#bundles.set(bundle.target, bundle);
    return this;
  }

  bundleFor(target: SchemaTarget): SchemaBundle | undefined {
    return this.#bundles.get(target);
  }
}

export type ValidationOutcome =
  | {
      readonly available: true;
      readonly valid: boolean;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly available: false;
      readonly diagnostics: readonly Diagnostic[];
    };

function detailToDiagnostic(d: ErrorDetail): Diagnostic {
  const location = [d.line ? `line ${d.line}` : undefined, d.col ? `col ${d.col}` : undefined]
    .filter(Boolean)
    .join(", ");
  return diagError(DiagnosticCode.XSD_VALIDATION_FAILED, d.message?.trim() ?? "Schema validation error", {
    ...(location ? { path: location } : {}),
    remediation: "The generated document does not conform to the OECD schema. This is a defect — please report it.",
  });
}

export class SchemaValidator {
  constructor(private readonly provider: SchemaProvider = new EmptySchemaProvider()) {}

  /**
   * Validate a serialized document against the schema for `target`.
   *
   * Never throws for validation failures — those are returned as diagnostics.
   * Genuine faults (a malformed schema bundle) are also returned, so a filing
   * pipeline can always continue to report rather than crash.
   */
  validate(xml: string, target: SchemaTarget): ValidationOutcome {
    const bundle = this.provider.bundleFor(target);
    if (!bundle) {
      return {
        available: false,
        diagnostics: [
          diagWarning(
            DiagnosticCode.XSD_UNAVAILABLE,
            `No XSD bundle is installed for ${target}; the document was NOT schema-validated.`,
            {
              remediation:
                "Vendor the official OECD schemas into packages/schema. Until then this document must not be described as schema-validated.",
            },
          ),
        ],
      };
    }

    const entrySource = bundle.files[bundle.entry];
    if (!entrySource) {
      return {
        available: false,
        diagnostics: [
          diagError(
            DiagnosticCode.XSD_UNAVAILABLE,
            `Schema bundle for ${target} does not contain its entry file "${bundle.entry}".`,
          ),
        ],
      };
    }

    // Register the bundle so libxml2 can resolve xsd:import/xsd:include by the
    // relative filenames the OECD schemas use between themselves.
    const buffers: Record<string, Uint8Array> = {};
    const encoder = new TextEncoder();
    for (const [name, source] of Object.entries(bundle.files)) {
      buffers[name] = encoder.encode(source);
    }
    const provider = new XmlBufferInputProvider(buffers);
    const registered = xmlRegisterInputProvider(provider);

    let schemaDoc: XmlDocument | undefined;
    let instanceDoc: XmlDocument | undefined;
    let validator: XsdValidator | undefined;

    try {
      schemaDoc = XmlDocument.fromString(entrySource, { url: bundle.entry });
      validator = XsdValidator.fromDoc(schemaDoc);
      instanceDoc = XmlDocument.fromString(xml);
      validator.validate(instanceDoc);
      return { available: true, valid: true, diagnostics: [] };
    } catch (cause) {
      const details = (cause as { details?: ErrorDetail[] }).details;
      if (Array.isArray(details) && details.length > 0) {
        return { available: true, valid: false, diagnostics: details.map(detailToDiagnostic) };
      }
      return {
        available: true,
        valid: false,
        diagnostics: [
          diagError(DiagnosticCode.XSD_VALIDATION_FAILED, String((cause as Error)?.message ?? cause)),
        ],
      };
    } finally {
      validator?.dispose?.();
      instanceDoc?.dispose?.();
      schemaDoc?.dispose?.();
      if (registered) xmlCleanupInputProvider();
    }
  }
}

/**
 * Convenience for callers that must not misreport.
 *
 * Returns true only when validation actually ran and passed. An unavailable
 * schema is never success.
 */
export function isSchemaValidated(outcome: ValidationOutcome): boolean {
  return outcome.available && outcome.valid;
}

/** Human-readable one-liner for a report header. */
export function describeOutcome(outcome: ValidationOutcome): string {
  if (!outcome.available) return "not schema-validated (no XSD bundle installed)";
  return outcome.valid ? "schema-valid" : `schema-INVALID (${outcome.diagnostics.length} error(s))`;
}
