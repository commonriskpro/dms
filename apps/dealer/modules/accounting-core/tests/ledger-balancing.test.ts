/** @jest-environment node */
/**
 * Ledger: sum(debits) must equal sum(credits) before post.
 */
import * as transactionsService from "../service/transactions";
import * as entryDb from "../db/entry";

describe("Ledger balancing", () => {
  it("sumDebitsAndCredits returns correct totals", () => {
    const entries = [
      { direction: "DEBIT", amountCents: BigInt(10000) },
      { direction: "CREDIT", amountCents: BigInt(10000) },
    ];
    const { debits, credits } = entryDb.sumDebitsAndCredits(entries);
    expect(debits).toBe(BigInt(10000));
    expect(credits).toBe(BigInt(10000));
    expect(debits).toBe(credits);
  });

  it("sumDebitsAndCredits with multiple entries", () => {
    const entries = [
      { direction: "DEBIT", amountCents: BigInt(5000) },
      { direction: "DEBIT", amountCents: BigInt(3000) },
      { direction: "CREDIT", amountCents: BigInt(8000) },
    ];
    const { debits, credits } = entryDb.sumDebitsAndCredits(entries);
    expect(debits).toBe(BigInt(8000));
    expect(credits).toBe(BigInt(8000));
  });

  it("unbalanced entries yield different debits and credits", () => {
    const entries = [
      { direction: "DEBIT", amountCents: BigInt(10000) },
      { direction: "CREDIT", amountCents: BigInt(5000) },
    ];
    const { debits, credits } = entryDb.sumDebitsAndCredits(entries);
    expect(debits).toBe(BigInt(10000));
    expect(credits).toBe(BigInt(5000));
    expect(debits).not.toBe(credits);
  });
});
