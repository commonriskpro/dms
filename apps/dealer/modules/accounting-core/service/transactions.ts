/**
 * Accounting transactions and entries. Create transaction (draft), add entries, post (must balance).
 */
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import * as transactionDb from "../db/transaction";
import * as entryDb from "../db/entry";
import * as accountDb from "../db/account";
import type { AccountingReferenceType } from "@prisma/client";
import type { AccountingEntryDirection } from "@prisma/client";

export async function listTransactions(
  dealershipId: string,
  options: transactionDb.ListTransactionsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return transactionDb.listTransactions(dealershipId, options);
}

export async function getTransaction(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const tx = await transactionDb.getTransactionById(dealershipId, id);
  if (!tx) throw new ApiError("NOT_FOUND", "Transaction not found");
  return tx;
}

export async function createTransaction(
  dealershipId: string,
  userId: string,
  params: {
    referenceType: AccountingReferenceType;
    referenceId?: string | null;
    memo?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const tx = await transactionDb.createTransaction({
    dealershipId,
    referenceType: params.referenceType,
    referenceId: params.referenceId ?? null,
    memo: params.memo ?? null,
    createdByUserId: userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "accounting_transaction.created",
    entity: "AccountingTransaction",
    entityId: tx.id,
    metadata: { referenceType: params.referenceType },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return tx;
}

export async function addEntry(
  dealershipId: string,
  userId: string,
  transactionId: string,
  params: {
    accountId: string;
    direction: AccountingEntryDirection;
    amountCents: bigint;
    memo?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const tx = await transactionDb.getTransactionById(dealershipId, transactionId);
  if (!tx) throw new ApiError("NOT_FOUND", "Transaction not found");
  if (tx.postedAt != null) throw new ApiError("CONFLICT", "Cannot add entry to posted transaction");
  if (params.amountCents <= BigInt(0)) throw new ApiError("VALIDATION_ERROR", "Amount must be positive");
  const account = await accountDb.getAccountById(dealershipId, params.accountId);
  if (!account) throw new ApiError("NOT_FOUND", "Account not found");
  const entry = await entryDb.addEntry({
    dealershipId,
    transactionId,
    accountId: params.accountId,
    direction: params.direction,
    amountCents: params.amountCents,
    memo: params.memo ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "accounting_entry.added",
    entity: "AccountingEntry",
    entityId: entry.id,
    metadata: { transactionId, accountId: params.accountId, direction: params.direction },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return entry;
}

export async function postTransaction(
  dealershipId: string,
  userId: string,
  transactionId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const tx = await transactionDb.getTransactionById(dealershipId, transactionId);
  if (!tx) throw new ApiError("NOT_FOUND", "Transaction not found");
  if (tx.postedAt != null) throw new ApiError("CONFLICT", "Transaction already posted");
  const entries = await entryDb.getEntriesByTransactionId(dealershipId, transactionId);
  const { debits, credits } = entryDb.sumDebitsAndCredits(entries);
  if (debits !== credits) {
    throw new ApiError("VALIDATION_ERROR", "Transaction must balance: debits must equal credits");
  }
  if (entries.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Transaction must have at least one entry");
  }
  const postedAt = new Date();
  await transactionDb.setTransactionPosted(dealershipId, transactionId, postedAt);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "accounting_transaction.posted",
    entity: "AccountingTransaction",
    entityId: transactionId,
    metadata: { postedAt: postedAt.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return transactionDb.getTransactionById(dealershipId, transactionId);
}
