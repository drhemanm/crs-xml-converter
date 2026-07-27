/**
 * A minimal typed XML tree and serializer.
 *
 * Emitters build a tree; only this module turns it into text. String
 * concatenation is how the legacy generator ended up with `targetNamespace` —
 * an XSD authoring attribute — on an instance document root, and with
 * conditionally-interpolated empty elements scattered through the output.
 *
 * Two properties matter for a regulatory artefact:
 *   1. Serialization is deterministic. Same tree in, byte-identical text out.
 *      Corrections must reproduce prior submissions exactly (§ full-record
 *      replacement), so stable ordering and escaping are correctness features.
 *   2. Absent values produce no element at all, rather than an empty one.
 */

export interface XmlElement {
  readonly kind: "element";
  readonly name: string;
  readonly attrs: ReadonlyArray<readonly [string, string]>;
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly kind: "text";
  readonly value: string;
}

export type XmlNode = XmlElement | XmlText;

export const text = (value: string): XmlText => ({ kind: "text", value });

/**
 * Build an element. `children` may contain `undefined`/`null`, which are
 * dropped — this is what makes "omit when not reported" the natural spelling
 * at the call site instead of a ternary producing an empty string.
 */
export function el(
  name: string,
  attrs: Record<string, string | undefined> = {},
  children: ReadonlyArray<XmlNode | undefined | null> = [],
): XmlElement {
  const kept: Array<readonly [string, string]> = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) kept.push([k, v] as const);
  }
  return {
    kind: "element",
    name,
    attrs: kept,
    children: children.filter((c): c is XmlNode => c != null),
  };
}

/** Leaf element with text content. Returns undefined when the value is absent. */
export function leaf(
  name: string,
  value: string | undefined | null,
  attrs: Record<string, string | undefined> = {},
): XmlElement | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return el(name, attrs, [text(value)]);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/** Text-node escaping. `>` is escaped too, to avoid any `]]>` ambiguity. */
export function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESCAPES[c] ?? c);
}

/** Attribute escaping. Quotes matter here; we always emit double-quoted values. */
export function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '"' ? "&quot;" : (ESCAPES[c] ?? c)));
}

export interface SerializeOptions {
  /** Two-space indentation by default; set false for a compact single line. */
  readonly indent?: boolean;
  /**
   * Declared encoding. HMRC's AEOI portal accepts only ISO-8859-1, so the
   * declaration must match what we actually verified the content against.
   */
  readonly encoding?: "UTF-8" | "ISO-8859-1";
}

function serializeNode(node: XmlNode, depth: number, indent: boolean, out: string[]): void {
  const pad = indent ? "  ".repeat(depth) : "";
  const nl = indent ? "\n" : "";

  if (node.kind === "text") {
    out.push(escapeText(node.value));
    return;
  }

  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");

  if (node.children.length === 0) {
    out.push(`${pad}<${node.name}${attrs}/>${nl}`);
    return;
  }

  // An element whose only child is text stays on one line — this keeps
  // generated documents diffable against authority-published samples.
  const onlyText = node.children.length === 1 && node.children[0]?.kind === "text";
  if (onlyText) {
    const child = node.children[0] as XmlText;
    out.push(`${pad}<${node.name}${attrs}>${escapeText(child.value)}</${node.name}>${nl}`);
    return;
  }

  out.push(`${pad}<${node.name}${attrs}>${nl}`);
  for (const child of node.children) serializeNode(child, depth + 1, indent, out);
  out.push(`${pad}</${node.name}>${nl}`);
}

export function serialize(root: XmlElement, options: SerializeOptions = {}): string {
  const indent = options.indent ?? true;
  const encoding = options.encoding ?? "UTF-8";
  const out: string[] = [`<?xml version="1.0" encoding="${encoding}"?>${indent ? "\n" : ""}`];
  serializeNode(root, 0, indent, out);
  return out.join("");
}

/**
 * Characters outside a target charset, with their positions.
 *
 * HMRC rejects anything outside Latin-1. Detecting this before submission —
 * and pointing at the offending name — is far better than a portal rejection
 * days before a deadline.
 */
export function findCharsetViolations(
  s: string,
  charset: "UTF-8" | "ISO-8859-1",
): Array<{ char: string; index: number; codePoint: number }> {
  if (charset === "UTF-8") return [];
  const violations: Array<{ char: string; index: number; codePoint: number }> = [];
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    if (cp === undefined) continue;
    if (cp > 0xff) {
      violations.push({ char: String.fromCodePoint(cp), index: i, codePoint: cp });
      if (cp > 0xffff) i++; // surrogate pair
    }
  }
  return violations;
}

/** Byte length of a serialized document, for jurisdiction file-size caps. */
export function byteLength(s: string, charset: "UTF-8" | "ISO-8859-1" = "UTF-8"): number {
  if (charset === "ISO-8859-1") return s.length;
  return new TextEncoder().encode(s).length;
}
