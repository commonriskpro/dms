import * as reconItemDb from "../db/recon-item";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { ReconItemStatus } from "@prisma/client";

export type ReconItemCreateInput = {
  description: string;
  costCents: number;
  status?: ReconItemStatus;
};

export type ReconItemUpdateInput = {
  description?: string;
  costCents?: number;
  status?: ReconItemStatus;
};

export type ReconTotals = {
  totalCostCents: number;
  completedCostCents: number;
  openCostCents: number;
  counts: { PENDING: number; IN_PROGRESS: number; COMPLETED: number };
};

export async function listReconItems(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return reconItemDb.listByVehicleId(dealershipId, vehicleId);
}

export async function addReconItem(
  dealershipId: string,
  vehicleId: string,
  data: ReconItemCreateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const item = await reconItemDb.createReconItem({
    dealershipId,
    vehicleId,
    description: data.description,
    costCents: data.costCents,
    status: data.status,
    createdByUserId: userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "ReconItem.created",
    entity: "ReconItem",
    entityId: item.id,
    metadata: { vehicleId, description: item.description, costCents: item.costCents },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return item;
}

export async function updateReconItem(
  dealershipId: string,
  reconItemId: string,
  patch: ReconItemUpdateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await reconItemDb.getById(dealershipId, reconItemId);
  if (!existing) throw new ApiError("NOT_FOUND", "Recon item not found");
  const updated = await reconItemDb.updateReconItem(dealershipId, reconItemId, patch);
  if (!updated) throw new ApiError("NOT_FOUND", "Recon item not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "ReconItem.updated",
    entity: "ReconItem",
    entityId: reconItemId,
    metadata: { vehicleId: existing.vehicleId, ...patch },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function getReconTotals(dealershipId: string, vehicleId: string): Promise<ReconTotals> {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const items = await reconItemDb.listByVehicleId(dealershipId, vehicleId);
  let totalCostCents = 0;
  let completedCostCents = 0;
  const counts = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const i of items) {
    totalCostCents += i.costCents;
    if (i.status === "COMPLETED") completedCostCents += i.costCents;
    counts[i.status]++;
  }
  return {
    totalCostCents,
    completedCostCents,
    openCostCents: totalCostCents - completedCostCents,
    counts,
  };
}
