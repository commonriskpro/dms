import * as reconDb from "../db/recon";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { VehicleReconStatus } from "@prisma/client";

async function recomputeAndSyncReconCost(
  dealershipId: string,
  vehicleId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const recon = await reconDb.getByVehicleId(dealershipId, vehicleId);
  const total = recon?.lineItems?.reduce((sum, i) => sum + i.costCents, 0) ?? 0;
  await reconDb.updateVehicleReconCostCents(dealershipId, vehicleId, total);
}

export type UpdateReconBody = {
  status?: VehicleReconStatus;
  dueDate?: Date | null;
};

export type ReconLineItemBody = {
  description: string;
  costCents: number;
  category?: string | null;
  sortOrder?: number;
};

export async function getRecon(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const recon = await reconDb.getByVehicleId(dealershipId, vehicleId);
  return recon;
}

export async function updateRecon(
  dealershipId: string,
  vehicleId: string,
  body: UpdateReconBody,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const existing = await reconDb.getByVehicleId(dealershipId, vehicleId);
  const recon = await reconDb.upsertRecon(dealershipId, vehicleId, {
    status: body.status,
    dueDate: body.dueDate,
  });
  const totalCents = recon.lineItems.reduce((s, i) => s + i.costCents, 0);
  const action = existing ? "vehicle_recon.updated" : "vehicle_recon.created";
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action,
    entity: "VehicleRecon",
    entityId: recon.id,
    metadata: { vehicleId, status: recon.status, dueDate: recon.dueDate?.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { ...recon, totalCents };
}

export async function addLineItem(
  dealershipId: string,
  vehicleId: string,
  body: ReconLineItemBody,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  let recon = await reconDb.getByVehicleId(dealershipId, vehicleId);
  if (!recon) {
    recon = await reconDb.upsertRecon(dealershipId, vehicleId, {});
  }
  const lineItem = await reconDb.createLineItem({
    dealershipId,
    reconId: recon.id,
    description: body.description,
    costCents: body.costCents,
    category: body.category,
    sortOrder: body.sortOrder,
  });
  await recomputeAndSyncReconCost(dealershipId, vehicleId, meta);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_recon_line_item.added",
    entity: "VehicleReconLineItem",
    entityId: lineItem.id,
    metadata: { vehicleId, reconId: recon.id, description: lineItem.description, costCents: lineItem.costCents },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return lineItem;
}

export async function updateLineItem(
  dealershipId: string,
  vehicleId: string,
  lineItemId: string,
  body: Partial<ReconLineItemBody>,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const lineItem = await reconDb.getLineItemById(dealershipId, lineItemId);
  if (!lineItem) throw new ApiError("NOT_FOUND", "Line item not found");
  const recon = await reconDb.getReconById(dealershipId, lineItem.reconId);
  if (!recon || recon.vehicleId !== vehicleId) throw new ApiError("NOT_FOUND", "Line item not found");
  await reconDb.updateLineItem(dealershipId, lineItemId, {
    description: body.description,
    costCents: body.costCents,
    category: body.category,
    sortOrder: body.sortOrder,
  });
  await recomputeAndSyncReconCost(dealershipId, vehicleId, meta);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_recon_line_item.updated",
    entity: "VehicleReconLineItem",
    entityId: lineItemId,
    metadata: { vehicleId, reconId: recon.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  const updated = await reconDb.getLineItemById(dealershipId, lineItemId);
  return updated!;
}

export async function deleteLineItem(
  dealershipId: string,
  vehicleId: string,
  lineItemId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const lineItem = await reconDb.getLineItemById(dealershipId, lineItemId);
  if (!lineItem) throw new ApiError("NOT_FOUND", "Line item not found");
  const recon = await reconDb.getReconById(dealershipId, lineItem.reconId);
  if (!recon || recon.vehicleId !== vehicleId) throw new ApiError("NOT_FOUND", "Line item not found");
  await reconDb.deleteLineItem(dealershipId, lineItemId);
  await recomputeAndSyncReconCost(dealershipId, vehicleId, meta);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_recon_line_item.removed",
    entity: "VehicleReconLineItem",
    entityId: lineItemId,
    metadata: { vehicleId, reconId: recon.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
