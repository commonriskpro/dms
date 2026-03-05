import * as customersDb from "../db/customers";
import * as callbacksDb from "../db/callbacks";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { CustomerCallbackStatus } from "@prisma/client";

export type CallbackListOptions = {
  limit: number;
  offset: number;
  status?: CustomerCallbackStatus;
};

export async function listCallbacks(
  dealershipId: string,
  customerId: string,
  options: CallbackListOptions
) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return callbacksDb.getCallbacksByCustomerId(dealershipId, customerId, options);
}

export async function createCallback(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: {
    callbackAt: Date;
    reason?: string | null;
    assignedToUserId?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (data.callbackAt < oneDayAgo) {
    throw new ApiError("VALIDATION_ERROR", "callbackAt cannot be more than 1 day in the past");
  }
  if (data.reason != null && data.reason.length > 2000) {
    throw new ApiError("VALIDATION_ERROR", "reason must be at most 2000 characters");
  }

  const created = await callbacksDb.createCallback(dealershipId, customerId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer_callback.scheduled",
    entity: "CustomerCallback",
    entityId: created.id,
    metadata: { customerId, callbackId: created.id, callbackAt: data.callbackAt.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateCallback(
  dealershipId: string,
  userId: string,
  customerId: string,
  callbackId: string,
  data: { status?: CustomerCallbackStatus; snoozedUntil?: Date | null },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");

  const existing = await callbacksDb.getCallbackById(dealershipId, callbackId);
  if (!existing || existing.customerId !== customerId) {
    throw new ApiError("NOT_FOUND", "Callback not found");
  }

  const updated = await callbacksDb.updateCallback(dealershipId, callbackId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Callback not found");

  if (data.status === "DONE") {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "customer_callback.completed",
      entity: "CustomerCallback",
      entityId: callbackId,
      metadata: { customerId, callbackId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  } else if (data.status === "CANCELLED") {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "customer_callback.cancelled",
      entity: "CustomerCallback",
      entityId: callbackId,
      metadata: { customerId, callbackId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  } else if (data.snoozedUntil !== undefined) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "customer_callback.snoozed",
      entity: "CustomerCallback",
      entityId: callbackId,
      metadata: { customerId, callbackId, snoozedUntil: data.snoozedUntil?.toISOString() ?? null },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  return updated;
}
