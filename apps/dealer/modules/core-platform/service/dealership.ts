import * as dealershipDb from "../db/dealership";
import * as locationDb from "../db/location";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function getDealershipWithLocations(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  const dealership = await dealershipDb.getDealershipById(dealershipId);
  if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
  return dealership;
}

export async function updateDealership(
  dealershipId: string,
  actorId: string,
  data: { name?: string; slug?: string | null; settings?: object },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const before = await dealershipDb.getDealershipById(dealershipId);
  if (!before) throw new ApiError("NOT_FOUND", "Dealership not found");
  const updated = await dealershipDb.updateDealership(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "dealership.updated",
    entity: "Dealership",
    entityId: dealershipId,
    metadata: { before: { name: before.name, slug: before.slug }, after: { name: updated.name, slug: updated.slug } },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function listLocations(dealershipId: string, limit: number, offset: number) {
  await requireTenantActiveForRead(dealershipId);
  return locationDb.listLocations(dealershipId, limit, offset);
}

export async function createLocation(
  dealershipId: string,
  actorId: string,
  data: Parameters<typeof locationDb.createLocation>[1],
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await locationDb.createLocation(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "location.created",
    entity: "DealershipLocation",
    entityId: created.id,
    metadata: { name: created.name },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateLocation(
  dealershipId: string,
  id: string,
  actorId: string,
  data: Parameters<typeof locationDb.updateLocation>[2],
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await locationDb.updateLocation(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Location not found");
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "location.updated",
    entity: "DealershipLocation",
    entityId: id,
    metadata: { name: updated.name },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
