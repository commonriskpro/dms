import { prisma } from "@/lib/db";
import type { AccountingAccountType } from "@prisma/client";

export type CreateAccountInput = {
  dealershipId: string;
  code: string;
  name: string;
  type: AccountingAccountType;
};

export type ListAccountsOptions = {
  type?: AccountingAccountType;
  activeOnly?: boolean;
  limit: number;
  offset: number;
};

export async function createAccount(data: CreateAccountInput) {
  return prisma.accountingAccount.create({
    data: {
      dealershipId: data.dealershipId,
      code: data.code.slice(0, 32),
      name: data.name.slice(0, 256),
      type: data.type,
    },
  });
}

export async function getAccountById(dealershipId: string, id: string) {
  return prisma.accountingAccount.findFirst({
    where: { id, dealershipId },
  });
}

export async function listAccounts(dealershipId: string, options: ListAccountsOptions) {
  const where = {
    dealershipId,
    ...(options.type != null && { type: options.type }),
    ...(options.activeOnly !== false && { isActive: true }),
  };
  const [data, total] = await Promise.all([
    prisma.accountingAccount.findMany({
      where,
      orderBy: [{ type: "asc" }, { code: "asc" }],
      take: options.limit,
      skip: options.offset,
    }),
    prisma.accountingAccount.count({ where }),
  ]);
  return { data, total };
}
