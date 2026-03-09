import * as dealershipsDb from "@/lib/db/dealerships";
import { platformAuditLog } from "@/lib/audit";

export async function activateDealership(actorPlatformUserId: string, dealershipId: string) {
  const before = await dealershipsDb.getDealershipById(dealershipId);
  if (!before) return null;
  const updated = await dealershipsDb.updateDealershipStatus(dealershipId, "ACTIVE");
  await platformAuditLog({
    actorPlatformUserId,
    action: "platform.dealership_activated",
    targetType: "dealership",
    targetId: dealershipId,
    beforeState: { status: before.status },
    afterState: { status: "ACTIVE" },
  });
  return updated;
}

export async function suspendDealership(actorPlatformUserId: string, dealershipId: string) {
  const before = await dealershipsDb.getDealershipById(dealershipId);
  if (!before) return null;
  const updated = await dealershipsDb.updateDealershipStatus(dealershipId, "SUSPENDED");
  await platformAuditLog({
    actorPlatformUserId,
    action: "platform.dealership_suspended",
    targetType: "dealership",
    targetId: dealershipId,
    beforeState: { status: before.status },
    afterState: { status: "SUSPENDED" },
  });
  return updated;
}

export async function listDealerships(options: {
  limit: number;
  offset: number;
  status?: string;
  platformAccountId?: string;
}) {
  return dealershipsDb.listDealerships({
    limit: options.limit,
    offset: options.offset,
    status: options.status as "APPROVED" | "PROVISIONING" | "PROVISIONED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | undefined,
    platformAccountId: options.platformAccountId,
  });
}

export async function getDealershipBySlug(slug: string) {
  return dealershipsDb.getDealershipBySlug(slug);
}
