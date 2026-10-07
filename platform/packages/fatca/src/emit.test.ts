import { describe, expect, it } from "vitest";
import {
  FatcaAccountHolderType,
  FatcaDocTypeIndic,
  FatcaFilerCategory,
  FatcaPaymentType,
  emitFatcaXml,
  type FatcaFilingInput,
} from "./index.js";

const base: FatcaFilingInput = {
  reportingFi: {
    giin: "ABCDEF.00000.ME.480",
    name: "Example Mauritius FI",
    residenceCountry: "MU",
    filerCategory: FatcaFilerCategory.RegisteredDeemedCompliantFfi,
    address: { countryCode: "MU", city: "Port Louis" },
  },
  transmittingCountry: "MU",
  receivingCountry: "US",
  reportingPeriod: "2025-12-31",
  timestamp: "2026-05-01T10:00:00Z",
  messageRefId: "MU2025FATCA0001",
  reportingFiDocRefId: "MU2025FI0001",
  reportingFiDocType: FatcaDocTypeIndic.New,
};

describe("FATCA XML emitter", () => {
  it("emits a new-account FATCA message", () => {
    const xml = emitFatcaXml({
      ...base,
      accounts: [{
        docRefId: "MU2025AR0001",
        docType: FatcaDocTypeIndic.New,
        record: {
          accountNumber: "ACC-001",
          holder: {
            kind: "organisation",
            name: "Example US Owner LLC",
            tin: "12-3456789",
            residenceCountry: "US",
            holderType: FatcaAccountHolderType.SpecifiedUsPerson,
          },
          balance: "1000.00",
          currency: "USD",
          payments: [{ type: FatcaPaymentType.Interest, amount: "25.00", currency: "USD" }],
        },
      }],
    });

    expect(xml).toContain("<ftc:FATCA_OECD");
    expect(xml).toContain('version="2.0.1"');
    expect(xml).toContain("<sfa:MessageType>FATCA</sfa:MessageType>");
    expect(xml).toContain("<ftc:FilerCategory>FATCA602</ftc:FilerCategory>");
    expect(xml).toContain("<ftc:DocTypeIndic>FATCA1</ftc:DocTypeIndic>");
    expect(xml).toContain("<ftc:AcctHolderType>FATCA104</ftc:AcctHolderType>");
    expect(xml).toContain("<ftc:PaymentAmnt currCode=\"USD\">25.00</ftc:PaymentAmnt>");
  });

  it("emits a nil report without an account report", () => {
    const xml = emitFatcaXml({
      ...base,
      nilReport: {
        docRefId: "MU2025NIL0001",
        docType: FatcaDocTypeIndic.New,
      },
    });

    expect(xml).toContain("<ftc:NilReport>");
    expect(xml).toContain("<ftc:NoAccountToReport>yes</ftc:NoAccountToReport>");
    expect(xml).not.toContain("<ftc:AccountReport>");
  });

  it("refuses an empty FATCA filing", () => {
    expect(() => emitFatcaXml(base)).toThrow(/AccountReport records or a NilReport/);
  });
});
