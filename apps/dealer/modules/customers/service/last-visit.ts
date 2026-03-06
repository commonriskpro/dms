import * as customersDb from "../db/customers";
import * as lastVisitDb from "../db/last-visit";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

/**
 * Update customer last visit. Verifies customer belongs to dealership then updates.
 * Call from RSC (detail view load) or from POST /api/customers/[id]/last-visit.
 */
export async function updateLastVisit(
  dealershipId: string,
  userId: string,
  customerId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");

  const updated = await lastVisitDb.updateLastVisit(dealershipId, customerId, userId);
  if (!updated) return;

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.last_visit.updated",
    entity: "Customer",
    entityId: customerId,
    metadata: { customerId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
