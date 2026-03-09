import * as customersDb from "../db/customers";
import * as activityDb from "../db/activity";
import * as taskService from "./task";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { CustomerStatus } from "@prisma/client";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { customerMetricsKey } from "@/lib/infrastructure/cache/cacheKeys";

export type CustomerListOptions = customersDb.CustomerListOptions;
export type CustomerCreateInput = customersDb.CustomerCreateInput;
export type CustomerUpdateInput = customersDb.CustomerUpdateInput;
export type CustomerSummaryMetrics = customersDb.CustomerSummaryMetrics;

export async function listCustomers(dealershipId: string, options: CustomerListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return customersDb.listCustomers(dealershipId, options);
}

export async function getCustomer(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, id);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return customer;
}

export async function createCustomer(
  dealershipId: string,
  userId: string,
  data: CustomerCreateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await customersDb.createCustomer(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.created",
    entity: "Customer",
    entityId: created.id,
    metadata: { customerId: created.id, status: created.status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    created.id,
    "customer_created",
    "Customer",
    created.id,
    null,
    userId
  );
  emitEvent("customer.created", { customerId: created.id, dealershipId });
  return created;
}

export async function updateCustomer(
  dealershipId: string,
  userId: string,
  id: string,
  data: CustomerUpdateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await customersDb.getCustomerById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Customer not found");
  const updated = await customersDb.updateCustomer(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Customer not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.updated",
    entity: "Customer",
    entityId: id,
    metadata: { customerId: id, changedFields: Object.keys(data) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    id,
    "customer_updated",
    "Customer",
    id,
    { changedFields: Object.keys(data) },
    userId
  );
  return updated;
}

export async function deleteCustomer(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await customersDb.getCustomerById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Customer not found");
  await customersDb.softDeleteCustomer(dealershipId, id, userId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.deleted",
    entity: "Customer",
    entityId: id,
    metadata: { customerId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    id,
    "customer_deleted",
    "Customer",
    id,
    null,
    userId
  );
  return { id };
}

export async function getCustomerMetrics(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  const cacheKey = customerMetricsKey(dealershipId);
  return withCache(cacheKey, 15, () => customersDb.getCustomerMetrics(dealershipId));
}

export async function getCustomerSummaryMetrics(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  return customersDb.getCustomerSummaryMetrics(dealershipId);
}

export type LeadSourceValue = { source: string | null; campaign: string | null; medium: string | null };

export async function listLeadSourceValues(
  dealershipId: string,
  options: { limit?: number } = {}
): Promise<LeadSourceValue[]> {
  await requireTenantActiveForRead(dealershipId);
  return customersDb.listLeadSourceValues(dealershipId, {
    limit: Math.min(options.limit ?? 100, 100),
  });
}

export async function setDisposition(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: {
    status: CustomerStatus;
    followUpTask?: { title: string; dueAt?: Date | null };
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const fromStatus = customer.status;
  let taskId: string | undefined;
  if (data.followUpTask) {
    const task = await taskService.createTask(
      dealershipId,
      userId,
      customerId,
      {
        title: data.followUpTask.title,
        dueAt: data.followUpTask.dueAt ?? null,
      },
      meta
    );
    taskId = task.id;
  }
  const updated = await customersDb.updateCustomer(dealershipId, customerId, {
    status: data.status,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Customer not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.updated",
    entity: "Customer",
    entityId: customerId,
    metadata: { customerId: customerId, changedFields: ["status"], disposition: true },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    customerId,
    "disposition_set",
    "Customer",
    customerId,
    { fromStatus, toStatus: data.status, ...(taskId && { taskId }) },
    userId
  );
  return { customer: updated, taskId };
}
