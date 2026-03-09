import { prisma } from "@/lib/db";
import type { AccountingReferenceType } from "@prisma/client";

export type CreateTransactionInput = {
  dealershipId: string;
  referenceType: AccountingReferenceType;
  referenceId?: string | null;
  memo?: string | null;
  createdByUserId?: string | null;
};

export type ListTransactionsOptions = {
  referenceType?: AccountingReferenceType;
  referenceId?: string;
  postedFrom?: Date;
  postedTo?: Date;
  limit: number;
  offset: number;
};

export async function createTransaction(data: CreateTransactionInput) {
  return prisma.accountingTransaction.create({
    data: {
      dealershipId: data.dealershipId,
      referenceType: data.referenceType,
      referenceId: data.referenceId ?? null,
      memo: data.memo?.slice(0, 500) ?? null,
      postedAt: null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getTransactionById(dealershipId: string, id: string) {
  return prisma.accountingTransaction.findFirst({
    where: { id, dealershipId },
    include: { entries: { include: { account: true } } },
  });
}

export async function listTransactions(dealershipId: string, options: ListTransactionsOptions) {
  const where = {
    dealershipId,
    ...(options.referenceType != null && { referenceType: options.referenceType }),
    ...(options.referenceId != null && { referenceId: options.referenceId }),
    ...(options.postedFrom != null &&
      options.postedTo != null && {
        postedAt: { gte: options.postedFrom, lte: options.postedTo },
      }),
    ...(options.postedFrom != null &&
      options.postedTo == null && { postedAt: { gte: options.postedFrom } }),
    ...(options.postedTo != null &&
      options.postedFrom == null && { postedAt: { lte: options.postedTo } }),
  };
  const [data, total] = await Promise.all([
    prisma.accountingTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      include: { entries: { select: { id: true, direction: true, amountCents: true, accountId: true } } },
    }),
    prisma.accountingTransaction.count({ where }),
  ]);
  return { data, total };
}

export async function setTransactionPosted(
  dealershipId: string,
  id: string,
  postedAt: Date
) {
  const tx = await prisma.accountingTransaction.findFirst({
    where: { id, dealershipId },
    select: { id: true },
  });
  if (!tx) return null;
  return prisma.accountingTransaction.update({
    where: { id },
    data: { postedAt },
  });
}
