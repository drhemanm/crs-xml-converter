import { describe, expect, it } from "vitest";
import { unsafeBrand } from "@crs/core";
import { PACKS, deadlineFor, packFor } from "../src/index.js";

const d = (s: string) => unsafeBrand.isoDate(s);

describe("schema selection", () => {
  it("uses v2.0 for a 2025 period filed during the 2026 season", () => {
    for (const code of ["MU", "KY", "SG", "IE"]) {
      expect(packFor(code)!.schemaFor(d("2025-12-31"), d("2026-07-26"))).toBe("crs-v2.0");
    }
  });

  it("uses v3.0 for reporting year 2026 onwards", () => {
    expect(packFor("MU")!.schemaFor(d("2026-12-31"), d("2027-06-01"))).toBe("crs-v3.0");
  });

  /**
   * The UK and Ireland require the amended schema from 1 January 2027 for all
   * submissions "including submissions relating to previous calendar years",
   * which is why schemaFor takes the filing date as well as the period.
   */
  it("switches an older period to v3.0 once filed after the 2027 cutover", () => {
    expect(packFor("IE")!.schemaFor(d("2024-12-31"), d("2027-03-01"))).toBe("crs-v3.0");
    expect(packFor("GB")!.schemaFor(d("2024-12-31"), d("2027-03-01"))).toBe("crs-v3.0");
  });

  it("routes the UK to its own combined schema before the cutover", () => {
    expect(packFor("GB")!.schemaFor(d("2025-12-31"), d("2026-05-01"))).toBe("uk-combined");
  });
});

describe("transitional sentinels", () => {
  /**
   * OECD User Guide v4.0 states no cut-off — the sentinels exist to keep v3.0
   * interoperable with v2.0 records, especially for corrections.
   */
  it("permits them by default, matching the OECD position", () => {
    for (const code of ["MU", "KY", "SG", "IE"]) {
      expect(packFor(code)!.sentinelsPermitted(d("2027-12-31"))).toBe(true);
    }
  });

  it("applies the stricter HMRC cut-off only to the UK", () => {
    const gb = packFor("GB")!;
    expect(gb.sentinelsPermitted(d("2025-12-31"))).toBe(true);
    expect(gb.sentinelsPermitted(d("2026-12-31"))).toBe(false);
    // Other jurisdictions are unaffected by the UK rule.
    expect(packFor("MU")!.sentinelsPermitted(d("2026-12-31"))).toBe(true);
  });
});

describe("jurisdiction profiles", () => {
  it("pins ReceivingCountry to the filing jurisdiction, not FI residence", () => {
    expect(packFor("KY")!.receivingCountry).toBe("KY");
    expect(packFor("MU")!.receivingCountry).toBe("MU");
  });

  it("records the character set the authority accepts", () => {
    expect(packFor("GB")!.charset).toBe("ISO-8859-1");
    expect(packFor("MU")!.charset).toBe("UTF-8");
  });

  it("computes the deadline in the year following the period", () => {
    expect(deadlineFor(packFor("MU")!, d("2025-12-31"))).toBe("2026-07-31");
    expect(deadlineFor(packFor("SG")!, d("2025-12-31"))).toBe("2026-05-31");
  });

  it("states a verification confidence for every rule it carries", () => {
    for (const p of PACKS) {
      expect(p.verification.length).toBeGreaterThan(0);
      for (const v of p.verification) {
        expect(["verified", "secondary", "unverified"]).toContain(v.confidence);
        expect(v.source.length).toBeGreaterThan(10);
      }
    }
  });
});
