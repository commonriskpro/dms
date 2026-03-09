/**
 * Vehicle appraisal workflow: create, list, get, update, approve, reject, convert to inventory.
 * Conversion creates Vehicle, links appraisal, audit. Only APPROVED appraisals can be converted.
 */
import * as appraisalDb from "../db/appraisal";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { VehicleAppraisalStatus } from "@prisma/client";

export type AppraisalListOptions = appraisalDb.AppraisalListOptions;
export type AppraisalCreateInput = appraisalDb.AppraisalCreateInput;
export type AppraisalUpdateInput = appraisalDb.AppraisalUpdateInput;

export async function listAppraisals(dealershipId: string, options: appraisalDb.AppraisalListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return appraisalDb.listAppraisals(dealershipId, options);
}

export async function getAppraisal(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const row = await appraisalDb.getAppraisalById(dealershipId, id);
  if (!row) throw new ApiError("NOT_FOUND", "Appraisal not found");
  return row;
}

export async function createAppraisal(
  dealershipId: string,
  userId: string,
  data: appraisalDb.AppraisalCreateInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const vin = data.vin?.trim();
  if (!vin || vin.length > 17) throw new ApiError("VALIDATION_ERROR", "VIN required (max 17 chars)");
  const created = await appraisalDb.createAppraisal(dealershipId, {
    ...data,
    vin,
    appraisedByUserId: data.appraisedByUserId ?? userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_appraisal.created",
    entity: "VehicleAppraisal",
    entityId: created.id,
    metadata: { appraisalId: created.id, vin: created.vin, status: created.status },
  });
  return created;
}

export async function updateAppraisal(
  dealershipId: string,
  id: string,
  data: appraisalDb.AppraisalUpdateInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await appraisalDb.updateAppraisal(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Appraisal not found or not in DRAFT");
  return updated;
}

export async function approveAppraisal(dealershipId: string, userId: string, id: string) {
  await requireTenantActiveForWrite(dealershipId);
  const appraisal = await appraisalDb.getAppraisalById(dealershipId, id);
  if (!appraisal) throw new ApiError("NOT_FOUND", "Appraisal not found");
  if (appraisal.status !== "DRAFT") throw new ApiError("CONFLICT", "Only DRAFT appraisals can be approved");
  const updated = await appraisalDb.setAppraisalStatus(dealershipId, id, "APPROVED");
  if (!updated) throw new ApiError("NOT_FOUND", "Appraisal not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_appraisal.approved",
    entity: "VehicleAppraisal",
    entityId: id,
    metadata: { appraisalId: id },
  });
  return updated;
}

export async function rejectAppraisal(dealershipId: string, userId: string, id: string) {
  await requireTenantActiveForWrite(dealershipId);
  const appraisal = await appraisalDb.getAppraisalById(dealershipId, id);
  if (!appraisal) throw new ApiError("NOT_FOUND", "Appraisal not found");
  if (appraisal.status !== "DRAFT") throw new ApiError("CONFLICT", "Only DRAFT appraisals can be rejected");
  const updated = await appraisalDb.setAppraisalStatus(dealershipId, id, "REJECTED");
  if (!updated) throw new ApiError("NOT_FOUND", "Appraisal not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_appraisal.rejected",
    entity: "VehicleAppraisal",
    entityId: id,
    metadata: { appraisalId: id },
  });
  return updated;
}

/** Convert approved appraisal to inventory: create Vehicle, link appraisal, audit. Rejected cannot be converted. */
export async function convertAppraisalToInventory(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const appraisal = await appraisalDb.getAppraisalById(dealershipId, id);
  if (!appraisal) throw new ApiError("NOT_FOUND", "Appraisal not found");
  if (appraisal.status === "REJECTED") throw new ApiError("CONFLICT", "Rejected appraisals cannot be converted");
  if (appraisal.status === "CONVERTED" && appraisal.vehicleId)
    throw new ApiError("CONFLICT", "Appraisal already converted");
  if (appraisal.status !== "DRAFT" && appraisal.status !== "APPROVED")
    throw new ApiError("CONFLICT", "Only DRAFT or APPROVED appraisals can be converted");

  const vin = appraisal.vin?.trim() || null;
  if (vin) {
    const existingVin = await vehicleDb.findActiveVehicleByVin(dealershipId, vin);
    if (existingVin) throw new ApiError("CONFLICT", "VIN already in use for this dealership");
  }

  const stockNumber = `APP-${id.slice(0, 8).toUpperCase()}`;
  const existingStock = await vehicleDb.findActiveVehicleByStockNumber(dealershipId, stockNumber);
  const finalStock = existingStock ? `APP-${Date.now().toString(36).toUpperCase()}` : stockNumber;

  const vehicle = await vehicleDb.createVehicle(dealershipId, {
    vin: vin || undefined,
    stockNumber: finalStock,
    salePriceCents: appraisal.expectedRetailCents,
    auctionCostCents: appraisal.acquisitionCostCents,
    transportCostCents: appraisal.transportEstimateCents,
    reconCostCents: appraisal.reconEstimateCents,
    miscCostCents: appraisal.feesEstimateCents,
  });

  await appraisalDb.setAppraisalVehicleId(dealershipId, id, vehicle.id);

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_appraisal.converted",
    entity: "VehicleAppraisal",
    entityId: id,
    metadata: { appraisalId: id, vehicleId: vehicle.id, stockNumber: vehicle.stockNumber },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("vehicle.created", {
    vehicleId: vehicle.id,
    dealershipId,
    vin: vehicle.vin ?? undefined,
  });
  const updatedAppraisal = await appraisalDb.getAppraisalById(dealershipId, id);
  return { vehicle, appraisal: updatedAppraisal };
}
