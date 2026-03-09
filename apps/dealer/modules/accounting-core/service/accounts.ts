/**
 * Accounting accounts: list, create. Tenant-scoped.
 */
import { prisma } from "@/lib/db";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import * as accountDb from "../db/account";
import type { AccountingAccountType } from "@prisma/client";

export async function listAccounts(
  dealershipId: string,
  options: accountDb.ListAccountsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return accountDb.listAccounts(dealershipId, options);
}

export async function getAccount(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const account = await accountDb.getAccountById(dealershipId, id);
  if (!account) throw new ApiError("NOT_FOUND", "Account not found");
  return account;
}

export async function createAccount(
  dealershipId: string,
  userId: string,
  data: { code: string; name: string; type: AccountingAccountType },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const byCode = await prisma.accountingAccount.findFirst({
    where: { dealershipId, code: data.code.slice(0, 32) },
  });
  if (byCode) throw new ApiError("CONFLICT", "Account code already exists");
  const account = await accountDb.createAccount({
    dealershipId,
    code: data.code,
    name: data.name,
    type: data.type,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "accounting_account.created",
    entity: "AccountingAccount",
    entityId: account.id,
    metadata: { code: account.code, type: account.type },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return account;
}
