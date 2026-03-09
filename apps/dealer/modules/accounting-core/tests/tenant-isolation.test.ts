/** @jest-environment node */
/**
 * Accounting tenant isolation: Dealer A cannot access Dealer B accounts, transactions, expenses.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as accountsService from "../service/accounts";
import * as transactionsService from "../service/transactions";
import * as expensesService from "../service/expenses";
import * as accountDb from "../db/account";
import * as transactionDb from "../db/transaction";
import * as expenseDb from "../db/expense";


const dealerAId = "b1000000-0000-0000-0000-000000000001";
const dealerBId = "b2000000-0000-0000-0000-000000000002";
const userBId = "b3000000-0000-0000-0000-000000000003";

async function ensureTestData(): Promise<{
  accountBId: string;
  transactionBId: string;
  expenseBId: string;
}> {
  await prisma.dealership.upsert({ where: { id: dealerAId }, create: { id: dealerAId, name: "A" }, update: {} });
  await prisma.dealership.upsert({ where: { id: dealerBId }, create: { id: dealerBId, name: "B" }, update: {} });
  await prisma.profile.upsert({ where: { id: userBId }, create: { id: userBId, email: "b@test.local" }, update: {} });

  const uniqueCode = `B-${randomUUID().slice(0, 8)}`;
  const accountB = await accountDb.createAccount({
    dealershipId: dealerBId,
    code: uniqueCode,
    name: "B Account",
    type: "ASSET",
  });
  const txB = await transactionDb.createTransaction({
    dealershipId: dealerBId,
    referenceType: "MANUAL",
    memo: "B tx",
  });
  const expenseB = await expenseDb.createExpense({
    dealershipId: dealerBId,
    category: "B category",
    amountCents: BigInt(1000),
    incurredOn: new Date(),
    createdByUserId: userBId,
  });

  return { accountBId: accountB.id, transactionBId: txB.id, expenseBId: expenseB.id };
}

describe("Accounting tenant isolation", () => {
  let testData: { accountBId: string; transactionBId: string; expenseBId: string };

  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("getAccount with cross-tenant id throws NOT_FOUND", async () => {
    await expect(accountsService.getAccount(dealerAId, testData.accountBId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("listAccounts for Dealer A does not return Dealer B accounts", async () => {
    const { data } = await accountsService.listAccounts(dealerAId, {
      activeOnly: false,
      limit: 100,
      offset: 0,
    });
    const bAccount = data.find((a) => a.dealershipId === dealerBId);
    expect(bAccount).toBeUndefined();
  });

  it("getTransaction with cross-tenant id throws NOT_FOUND", async () => {
    await expect(transactionsService.getTransaction(dealerAId, testData.transactionBId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getExpense with cross-tenant id throws NOT_FOUND", async () => {
    await expect(expensesService.getExpense(dealerAId, testData.expenseBId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
