import { describe, it, expect } from "vitest";
import { duplicateAccountDiagnostics, planNewFiling, InMemoryLedger, validatePlan, type FilingPlan } from "../src/index.js";
import { completeRecord, individual, planContext } from "./fixtures.js";

describe("identical account and holder reports", () => {
  it("blocks repeats even when row location, local key and object property order differ", () => {
    const first = completeRecord({ provenance: { sheet: "Accounts", row: 2 } });
    const second = { ...Object.fromEntries(Object.entries(first).reverse()), businessKey: "different-local-key", provenance: { sheet: "Accounts", row: 9 } } as typeof first;
    const errors = duplicateAccountDiagnostics([first, second]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("DATA-009");
    expect(errors[0]?.provenance?.row).toBe(9);
    expect(errors[0]?.message).toContain("row 2");
    expect(Array.isArray(planNewFiling(planContext(new InMemoryLedger()), [first, second]))).toBe(true);
  });
  it("allows distinct holders of a joint account and distinct reportable payloads", () => {
    const first = completeRecord();
    const joint = completeRecord({ holder: { ...individual, name: { ...individual.name, firstName: "Another holder" } } });
    const changed = completeRecord({ balance: { ...first.balance, amount: "16000.00" } });
    expect(duplicateAccountDiagnostics([first, joint, changed])).toEqual([]);
    expect(Array.isArray(planNewFiling(planContext(new InMemoryLedger()), [first, joint]))).toBe(false);
  });
  it("also rejects duplicate payloads in a plan assembled outside the new-filing planner", () => {
    const plan = planNewFiling(planContext(new InMemoryLedger()), [completeRecord()]) as FilingPlan;
    const repeated = { ...plan, accountReports: [...plan.accountReports, { ...plan.accountReports[0]! }] };
    expect(validatePlan(repeated).some((d) => d.code === "DATA-009")).toBe(true);
  });
});
