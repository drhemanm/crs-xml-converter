import { describe, expect, it } from "vitest";
import { inferColumns, mapRows, type Row } from "../src/index.js";

const HEADERS = [
  "account_number",
  "account_balance",
  "currency_code",
  "holder_type",
  "residence_country",
  "first_name",
  "last_name",
  "self_cert",
  "account_type",
  "dd_procedure",
  "birth_date",
];

function mapOne(row: Row, headers: readonly string[] = HEADERS) {
  const mapping = inferColumns(headers);
  return mapRows([row], mapping, { sheet: "Accounts" });
}

const validRow: Row = {
  account_number: "ACC-1",
  account_balance: "1000.00",
  currency_code: "USD",
  holder_type: "individual",
  residence_country: "MU",
  first_name: "Aisha",
  last_name: "Ramgoolam",
  self_cert: "true",
  account_type: "depository",
  dd_procedure: "preexisting",
  birth_date: "1985-03-14",
};

describe("column inference", () => {
  it("matches canonical names exactly", () => {
    const m = inferColumns(["account_number", "account_balance"]);
    expect(m.matches.get("account_number")?.kind).toBe("exact");
  });

  it("matches known aliases", () => {
    const m = inferColumns(["Acct No", "Balance", "CCY"]);
    expect(m.matches.get("account_number")?.header).toBe("Acct No");
    expect(m.matches.get("account_balance")?.header).toBe("Balance");
    expect(m.matches.get("currency_code")?.header).toBe("CCY");
  });

  it("prefers an exact match over an alias on the same field", () => {
    const m = inferColumns(["account_number", "acct_no"]);
    expect(m.matches.get("account_number")?.header).toBe("account_number");
  });

  /**
   * The legacy matcher used bidirectional substring containment, so a header
   * named "country" would silently bind to whichever of residence_country,
   * address_country, birth_country or nationality was iterated first. Reporting
   * the ambiguity is the only safe behaviour.
   */
  it("reports an ambiguous header instead of guessing", () => {
    const m = inferColumns(["country"]);
    expect(m.matches.has("residence_country")).toBe(false);
    expect(m.ambiguous.some((a) => a.header === "country")).toBe(true);
    expect(m.ambiguous[0]!.candidates.length).toBeGreaterThan(1);
  });

  it("lists headers it could not place", () => {
    const m = inferColumns(["account_number", "internal_ref_9912"]);
    expect(m.unmatchedHeaders).toContain("internal_ref_9912");
  });
});

describe("mapping refuses to fabricate", () => {
  it("maps a complete row", () => {
    const { records, diagnostics } = mapOne(validRow);
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0]?.selfCert).toEqual({ known: true, value: "CRS901" });
  });

  // The central rule: absent self-certification stays absent.
  it("leaves a missing self-certification as not-reported, never as obtained", () => {
    const { records } = mapOne({ ...validRow, self_cert: "" });
    expect(records[0]?.selfCert).toEqual({ known: false });
  });

  it("rejects a missing residence country rather than substituting XX", () => {
    const { records, diagnostics } = mapOne({ ...validRow, residence_country: "" });
    expect(records).toHaveLength(0);
    const e = diagnostics.find((d) => d.severity === "error");
    expect(e?.code).toBe("DATA-002");
    expect(e?.provenance?.row).toBe(2);
  });

  it("rejects an XX country code supplied in the source data", () => {
    const { records, diagnostics } = mapOne({ ...validRow, residence_country: "XX" });
    expect(records).toHaveLength(0);
    expect(diagnostics.some((d) => /placeholder/.test(d.message))).toBe(true);
  });

  it("rejects an ambiguous date rather than guessing day-first or month-first", () => {
    const { diagnostics } = mapOne({ ...validRow, birth_date: "03/04/2025" });
    const e = diagnostics.find((d) => d.code === "DATA-004");
    expect(e).toBeDefined();
    expect(e?.remediation).toMatch(/YYYY-MM-DD/);
  });

  it("rejects an unrecognised enum value rather than defaulting", () => {
    const { records, diagnostics } = mapOne({ ...validRow, account_type: "chequing" });
    expect(records).toHaveLength(0);
    const e = diagnostics.find((d) => d.code === "DATA-005");
    expect(e?.remediation).toMatch(/depository/);
  });

  it("rejects a negative balance", () => {
    const { records, diagnostics } = mapOne({ ...validRow, account_balance: "-5" });
    expect(records).toHaveLength(0);
    expect(diagnostics.some((d) => /must not be negative/.test(d.message))).toBe(true);
  });

  it("rejects a non-numeric balance", () => {
    const { records } = mapOne({ ...validRow, account_balance: "n/a" });
    expect(records).toHaveLength(0);
  });

  it("accepts thousands separators in amounts", () => {
    const { records } = mapOne({ ...validRow, account_balance: "1,234,567.89" });
    expect(records[0]?.balance.amount).toBe("1234567.89");
  });

  it("does not emit a partially-mapped record", () => {
    const { records } = mapOne({ ...validRow, first_name: "", last_name: "" });
    expect(records).toHaveLength(0);
  });
});

describe("organisations and controlling persons", () => {
  const orgHeaders = [
    ...HEADERS,
    "organisation_name",
    "account_holder_type",
    "cp_first_name",
    "cp_last_name",
    "cp_type",
    "cp_self_cert",
  ];

  const orgRow: Row = {
    ...validRow,
    holder_type: "organisation",
    organisation_name: "Indian Ocean Holdings Ltd",
    account_holder_type: "passive_nfe_reportable",
    cp_first_name: "Rajesh",
    cp_last_name: "Bhagwan",
    cp_type: "ownership",
    cp_self_cert: "true",
    first_name: "",
    last_name: "",
  };

  it("maps an organisation with a controlling person", () => {
    const { records, diagnostics } = mapRows([orgRow], inferColumns(orgHeaders), { sheet: "Accounts" });
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(records[0]?.holder.kind).toBe("organisation");
    expect(records[0]?.controllingPersons).toHaveLength(1);
    expect(records[0]?.controllingPersons[0]?.type).toEqual({ known: true, value: "CRS801" });
  });

  it("requires an organisation name", () => {
    const { records, diagnostics } = mapRows(
      [{ ...orgRow, organisation_name: "" }],
      inferColumns(orgHeaders),
      { sheet: "Accounts" },
    );
    expect(records).toHaveLength(0);
    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("leaves an unsupplied controlling-person self-certification unreported", () => {
    const { records } = mapRows(
      [{ ...orgRow, cp_self_cert: "" }],
      inferColumns(orgHeaders),
      { sheet: "Accounts" },
    );
    expect(records[0]?.controllingPersons[0]?.selfCert).toEqual({ known: false });
  });
});

describe("provenance", () => {
  it("numbers rows as the user sees them, counting the header", () => {
    const rows: Row[] = [validRow, { ...validRow, account_number: "ACC-2", account_balance: "bad" }];
    const { diagnostics } = mapRows(rows, inferColumns(HEADERS), { sheet: "Sheet1" });
    const e = diagnostics.find((d) => d.severity === "error");
    expect(e?.provenance).toMatchObject({ sheet: "Sheet1", row: 3 });
  });

  it("warns about non-exact column matches so the filer can audit them", () => {
    const { diagnostics } = mapRows(
      [{ "Acct No": "A1", Balance: "1", CCY: "USD" }],
      inferColumns(["Acct No", "Balance", "CCY"]),
      { sheet: "Accounts" },
    );
    const inferred = diagnostics.filter((d) => d.code === "DATA-006");
    expect(inferred.length).toBeGreaterThan(0);
    expect(inferred[0]?.remediation).toMatch(/Confirm this mapping/);
  });
});
