import * as lenderDb from "../db/lender";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function getLender(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof lenderDb.getLenderById>> | null> {
  await requireTenantActiveForRead(dealershipId);
  return lenderDb.getLenderById(dealershipId, id);
}

export async function listLenders(
  dealershipId: string,
  options: lenderDb.ListLendersOptions
): Promise<ReturnType<typeof lenderDb.listLenders>> {
  await requireTenantActiveForRead(dealershipId);
  return lenderDb.listLenders(dealershipId, options);
}

export async function createLender(
  dealershipId: string,
  userId: string,
  data: lenderDb.LenderCreateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof lenderDb.createLender>>> {
  await requireTenantActiveForWrite(dealershipId);
  const created = await lenderDb.createLender(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender.created",
    entity: "lender",
    entityId: created.id,
    metadata: { lenderId: created.id, dealershipId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateLender(
  dealershipId: string,
  userId: string,
  id: string,
  data: lenderDb.LenderUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof lenderDb.updateLender>>> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await lenderDb.getLenderById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Lender not found");
  const changedFields = Object.keys(data) as string[];
  const updated = await lenderDb.updateLender(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Lender not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender.updated",
    entity: "lender",
    entityId: id,
    metadata: { lenderId: id, changedFields },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  if (data.isActive === false && existing.isActive) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "lender.deactivated",
      entity: "lender",
      entityId: id,
      metadata: { lenderId: id },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function deactivateLender(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof lenderDb.deactivateLender>>> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await lenderDb.getLenderById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Lender not found");
  const updated = await lenderDb.deactivateLender(dealershipId, id);
  if (!updated) throw new ApiError("NOT_FOUND", "Lender not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender.deactivated",
    entity: "lender",
    entityId: id,
    metadata: { lenderId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
