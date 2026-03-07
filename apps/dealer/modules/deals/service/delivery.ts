import * as dealDb from "../db/deal";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

/**
 * Mark deal as ready for delivery. Deal must be CONTRACTED; deliveryStatus must be null or CANCELLED.
 */
export async function markDealReadyForDelivery(
  dealershipId: string,
  userId: string,
  dealId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (deal.status !== "CONTRACTED") {
    throw new ApiError("CONFLICT", "Deal must be CONTRACTED to mark ready for delivery");
  }
  if (deal.deliveryStatus && deal.deliveryStatus !== "CANCELLED") {
    throw new ApiError("CONFLICT", "Deal is already in delivery workflow");
  }
  const updated = await dealDb.updateDealDelivery(dealershipId, dealId, {
    deliveryStatus: "READY_FOR_DELIVERY",
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Deal not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.delivery_ready",
    entity: "Deal",
    entityId: dealId,
    metadata: { dealId, deliveryStatus: "READY_FOR_DELIVERY" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

/**
 * Mark deal as delivered. deliveryStatus must be READY_FOR_DELIVERY.
 */
export async function markDealDelivered(
  dealershipId: string,
  userId: string,
  dealId: string,
  deliveredAt?: Date | null,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (deal.deliveryStatus !== "READY_FOR_DELIVERY") {
    throw new ApiError("CONFLICT", "Deal must be ready for delivery before marking delivered");
  }
  const dateToSet = deliveredAt ?? new Date();
  const updated = await dealDb.updateDealDelivery(dealershipId, dealId, {
    deliveryStatus: "DELIVERED",
    deliveredAt: dateToSet,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Deal not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.delivered",
    entity: "Deal",
    entityId: dealId,
    metadata: { dealId, deliveryStatus: "DELIVERED", deliveredAt: dateToSet.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
