// @vitest-environment jsdom
// DOM-level workflow tests. Regulatory validation itself is covered by the
// real schema suites; these mocks isolate draft and output-state behaviour.
import { act } from "react";
import { webcrypto } from "node:crypto";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.js";

// These tests isolate draft state. Real IndexedDB persistence, migration,
// transaction failure and reload are exercised by the browser regression suite.
vi.mock("../src/ledger-storage.js", async () => {
  const { InMemoryLedger } = await import("@crs/core");
  return {
    loadLedger: async () => new InMemoryLedger(),
    getLocalLedgerHmacSecret: async () => "S".repeat(32),
    commitLedgerMutations: async (base: InstanceType<typeof InMemoryLedger>, mutations: Parameters<InstanceType<typeof InMemoryLedger>["apply"]>[0]) => {
      const next = new InMemoryLedger(base.all()); next.apply(mutations); return next;
    },
    clearLedger: async () => new InMemoryLedger(),
    exportLedger: () => "{}",
  };
});

vi.mock("@crs/validate", () => ({
  SchemaValidator: class {
    validate() { return { available: true, valid: true, diagnostics: [] }; }
  },
  describeOutcome: () => "Test schema gate passed",
}));
vi.mock("../src/schema-provider.js", () => ({ browserSchemaProvider: {} }));
vi.mock("../src/fatca-validator.js", () => ({
  validateFatcaStructure: () => ({ valid: true, message: "Test schema gate passed" }),
}));

let root: Root;
let container: HTMLDivElement;

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((element) => element.textContent?.trim() === text && !element.closest("[hidden]"));
  if (!found) throw new Error(`Visible button not found: ${text}`);
  return found;
}

async function click(text: string) {
  await act(async () => {
    button(text).click();
    if (text === "FATCA") await import("../src/FatcaApp.js");
  });
}

async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Input not found: ${selector}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waitForXml(panel = '[data-regime-panel="CRS"]') {
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(container.querySelector(`${panel} pre.xml`)).not.toBeNull();
  });
}

beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<App />); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("filing workspace state", () => {
  it("retains both real filing forms when switching regimes", async () => {
    await fill("#fi-name", "CRS draft");
    await click("FATCA");
    const panel = '[data-regime-panel="FATCA"]';
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.querySelector(`${panel} input`)).not.toBeNull();
    });
    // FATCA's third form field is its institution name.
    await fill(`${panel} .form-grid label:nth-child(3) input`, "FATCA draft");
    await click("CRS");
    expect(container.querySelector<HTMLInputElement>("#fi-name")!.value).toBe("CRS draft");
    await click("FATCA");
    expect(container.querySelector<HTMLInputElement>(`${panel} .form-grid label:nth-child(3) input`)!.value).toBe("FATCA draft");
  });

  it("invalidates a generated CRS return after institution changes", async () => {
    await fill("#fi-name", "Example institution");
    await fill("#fi-id", "MU10203040");
    await fill("#fi-city", "Port Louis");
    await click("Nil return");
    await click("Generate return");
    await waitForXml();
    await fill("#fi-name", "Different institution");
    expect(container.querySelector("pre.xml")).toBeNull();
    expect(container.textContent).not.toContain("Download XML");
  });

  it("does not show successful output from a generation whose inputs changed", async () => {
    await fill("#fi-name", "Example institution");
    await fill("#fi-id", "MU10203040");
    await fill("#fi-city", "Port Louis");
    await click("Nil return");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    let release!: (value: CryptoKey) => void;
    const gate = new Promise<CryptoKey>((resolve) => { release = resolve; });
    vi.spyOn(crypto.subtle, "importKey").mockImplementationOnce(() => gate);
    await click("Generate return");
    expect(button("Validating return…").disabled).toBe(true);
    await fill("#period-end", "2026-12-31");
    await act(async () => { release(key); });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(button("Generate return").disabled).toBe(false);
    });
    expect(container.querySelector("pre.xml")).toBeNull();
  });

  it("invalidates FATCA XML after reporting-period changes", async () => {
    await click("FATCA");
    const panel = '[data-regime-panel="FATCA"]';
    await fill(`${panel} .form-grid label:nth-child(1) input`, "ABCDEF.00000.ME.480");
    await fill(`${panel} .form-grid label:nth-child(3) input`, "Example Mauritius FI");
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>(`${panel} .form-grid select`)!;
      select.value = "FATCA602";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Nil");
    await click("Generate FATCA XML");
    await waitForXml(panel);
    await fill(`${panel} .form-grid label:nth-child(6) input`, "2026-12-31");
    expect(container.querySelector(`${panel} pre.xml`)).toBeNull();
  });

  it("warns on reload while a reporting draft exists", async () => {
    await fill("#fi-name", "Unsaved institution");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
