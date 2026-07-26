import { describe, expect, it } from "vitest";
import { docRefId, iso3166Alpha2, iso4217, isoDate, messageRefId } from "../src/brand.js";

describe("iso3166Alpha2", () => {
  it("accepts a real country code", () => {
    const r = iso3166Alpha2("mu");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("MU");
  });

  // The legacy implementation substituted "XX" whenever a country was missing,
  // putting a placeholder into a regulatory filing. Making it unconstructible
  // is what prevents that class of bug structurally.
  it("rejects the XX placeholder that the legacy generator used as a default", () => {
    const r = iso3166Alpha2("XX");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toMatch(/user-assigned placeholder/);
  });

  it("rejects other user-assigned codes", () => {
    for (const code of ["ZZ", "QQ", "AA"]) {
      expect(iso3166Alpha2(code).ok).toBe(false);
    }
  });

  it("rejects three-letter codes", () => {
    expect(iso3166Alpha2("MUS").ok).toBe(false);
  });
});

describe("iso4217", () => {
  it("accepts three-letter currency codes", () => {
    expect(iso4217("usd").ok).toBe(true);
  });
  it("rejects two-letter codes", () => {
    expect(iso4217("US").ok).toBe(false);
  });
});

describe("isoDate", () => {
  it("accepts unambiguous ISO dates", () => {
    const r = isoDate("1985-03-14");
    expect(r.ok).toBe(true);
  });

  // The legacy parser tried DD/MM/YYYY and silently fell back to MM/DD/YYYY,
  // so 03/04/2025 could become either March or April. For a date of birth on a
  // tax filing, guessing is worse than refusing.
  it("rejects ambiguous slash-separated dates rather than guessing", () => {
    const r = isoDate("03/04/2025");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toMatch(/ambiguous/i);
  });

  it("rejects impossible calendar dates", () => {
    expect(isoDate("2025-02-30").ok).toBe(false);
    expect(isoDate("2025-13-01").ok).toBe(false);
  });

  it("normalises a Date object", () => {
    const r = isoDate(new Date(Date.UTC(1990, 0, 2)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("1990-01-02");
  });
});

describe("reference identifier length limits", () => {
  it("enforces the 200-character DocRefId schema limit", () => {
    expect(docRefId("A".repeat(200)).ok).toBe(true);
    expect(docRefId("A".repeat(201)).ok).toBe(false);
  });

  it("enforces the 170-character MessageRefId schema limit", () => {
    expect(messageRefId("A".repeat(170)).ok).toBe(true);
    expect(messageRefId("A".repeat(171)).ok).toBe(false);
  });

  it("rejects empty identifiers", () => {
    expect(docRefId("").ok).toBe(false);
    expect(messageRefId("   ").ok).toBe(false);
  });
});
