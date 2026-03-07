import { prisma } from "@/lib/db";
import type { AccountingEntryDirection } from "@prisma/client";

export type CreateEntryInput = {
  dealershipId: string;
  transactionId: string;
  accountId: string;
  direction: AccountingEntryDirection;
  amountCents: bigint;
  memo?: string | null;
};

export async function addEntry(data: CreateEntryInput) {
  return prisma.accountingEntry.create({
    data: {
      dealershipId: data.dealershipId,
      transactionId: data.transactionId,
      accountId: data.accountId,
      direction: data.direction,
      amountCents: data.amountCents,
      memo: data.memo?.slice(0, 255) ?? null,
    },
  });
}

export async function getEntriesByTransactionId(dealershipId: string, transactionId: string) {
  return prisma.accountingEntry.findMany({
    where: { transactionId, dealershipId },
    include: { account: true },
  });
}

export function sumDebitsAndCredits(
  entries: { direction: string; amountCents: bigint }[]
): { debits: bigint; credits: bigint } {
  let debits = BigInt(0);
  let credits = BigInt(0);
  for (const e of entries) {
    if (e.direction === "DEBIT") debits += e.amountCents;
    else credits += e.amountCents;
  }
  return { debits, credits };
}
