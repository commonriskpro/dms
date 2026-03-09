import * as vendorDb from "../db/vendor";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function getVendor(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof vendorDb.getVendorById>> | null> {
  await requireTenantActiveForRead(dealershipId);
  return vendorDb.getVendorById(dealershipId, id);
}

export async function listVendors(
  dealershipId: string,
  options: vendorDb.ListVendorsOptions
): Promise<ReturnType<typeof vendorDb.listVendors>> {
  await requireTenantActiveForRead(dealershipId);
  return vendorDb.listVendors(dealershipId, options);
}

export async function createVendor(
  dealershipId: string,
  userId: string,
  data: vendorDb.VendorCreateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof vendorDb.createVendor>>> {
  await requireTenantActiveForWrite(dealershipId);
  const created = await vendorDb.createVendor(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vendor.created",
    entity: "Vendor",
    entityId: created.id,
    metadata: { vendorId: created.id, name: created.name },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateVendor(
  dealershipId: string,
  userId: string,
  id: string,
  data: vendorDb.VendorUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof vendorDb.updateVendor>>> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await vendorDb.getVendorById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Vendor not found");
  const updated = await vendorDb.updateVendor(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Vendor not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vendor.updated",
    entity: "Vendor",
    entityId: id,
    metadata: { vendorId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function deleteVendor(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof vendorDb.softDeleteVendor>>> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await vendorDb.getVendorById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Vendor not found");
  const updated = await vendorDb.softDeleteVendor(dealershipId, id, userId);
  if (!updated) throw new ApiError("NOT_FOUND", "Vendor not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vendor.deleted",
    entity: "Vendor",
    entityId: id,
    metadata: { vendorId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
