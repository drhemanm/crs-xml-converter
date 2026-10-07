import { describe, expect, it } from "vitest";
import { parseRows, type Row } from "../src/fatca-rows.js";

const row: Row = {
  account_number: "ACC-001", holder_kind: "individual", first_name: "Jane", last_name: "Doe",
  holder_address_country: "US", holder_address_city: "New York", account_balance: "100.00",
  currency: "USD", doc_ref_id: "GIIN-DOC-001",
};

describe("FATCA source integrity", () => {
  it("retains explicit zero payments and an explicitly open account", () => {
    const result = parseRows([{ ...row, payment_type: "FATCA502", payment_amount: "0.00", account_closed: "false" }], "new");
    expect(result[0]!.record.payments![0]!.amount).toBe("0.00");
    expect(result[0]!.record.closed).toBe(false);
  });
  it.each(["", "person", "company"])("rejects ambiguous holder_kind %j", (holder_kind) => {
    expect(() => parseRows([{ ...row, holder_kind }], "new")).toThrow(/holder_kind/);
  });
  it("rejects unknown account-closed flags rather than reporting false", () => {
    expect(() => parseRows([{ ...row, account_closed: "maybe" }], "new")).toThrow(/account_closed/);
  });
  it.each([{ payment_type: "FATCA502" }, { payment_amount: "100.00" }, { payment_currency: "USD" }])("rejects incomplete payment data %j", (payment) => {
    expect(() => parseRows([{ ...row, ...payment }], "new")).toThrow(/cannot be silently omitted/);
  });
  it("rejects an unrecognised payment code", () => {
    expect(() => parseRows([{ ...row, payment_type: "FATCA999", payment_amount: "1.00" }], "new")).toThrow(/payment_type/);
  });
  it("does not generate a new filing from an empty import", () => {
    expect(() => parseRows([], "new")).toThrow(/No account rows/);
  });
  it("keeps new information separate from correction references", () => {
    expect(() => parseRows([{ ...row, corr_doc_ref_id: "PREVIOUS" }], "new")).toThrow(/new information/);
  });
});
