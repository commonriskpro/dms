/**
 * Dealership expenses: list, create, update. Tenant-scoped.
 */
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import * as expenseDb from "../db/expense";
import type { DealershipExpenseStatus } from "@prisma/client";

export async function listExpenses(
  dealershipId: string,
  options: expenseDb.ListExpensesOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return expenseDb.listExpenses(dealershipId, options);
}

export async function getExpense(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const expense = await expenseDb.getExpenseById(dealershipId, id);
  if (!expense) throw new ApiError("NOT_FOUND", "Expense not found");
  return expense;
}

export async function createExpense(
  dealershipId: string,
  userId: string,
  data: expenseDb.CreateExpenseInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const expense = await expenseDb.createExpense({
    ...data,
    dealershipId,
    createdByUserId: userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "dealership_expense.created",
    entity: "DealershipExpense",
    entityId: expense.id,
    metadata: { category: expense.category, amountCents: expense.amountCents.toString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return expense;
}

export async function updateExpense(
  dealershipId: string,
  userId: string,
  id: string,
  data: expenseDb.UpdateExpenseInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await expenseDb.getExpenseById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Expense not found");
  const updated = await expenseDb.updateExpense(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Expense not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "dealership_expense.updated",
    entity: "DealershipExpense",
    entityId: id,
    metadata: { status: data.status ?? existing.status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
