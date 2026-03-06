import * as floorplanDb from "../db/floorplan";
import * as vehicleDb from "../db/vehicle";
import * as lenderDb from "@/modules/lender-integration/db/lender";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type FloorplanUpsertInput = {
  lenderId: string;
  principalCents: number;
  aprBps?: number | null;
  startDate: Date;
  nextCurtailmentDueDate?: Date | null;
};

export async function getFloorplan(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return floorplanDb.getByVehicleId(dealershipId, vehicleId);
}

export async function upsertFloorplan(
  dealershipId: string,
  vehicleId: string,
  data: FloorplanUpsertInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const lender = await lenderDb.getLenderById(dealershipId, data.lenderId);
  if (!lender) throw new ApiError("VALIDATION_ERROR", "Lender not found or does not belong to dealership");
  const existing = await floorplanDb.getByVehicleId(dealershipId, vehicleId);
  const floorplan = await floorplanDb.upsertFloorplan(dealershipId, vehicleId, {
    lenderId: data.lenderId,
    principalCents: data.principalCents,
    aprBps: data.aprBps,
    startDate: data.startDate,
    nextCurtailmentDueDate: data.nextCurtailmentDueDate,
  });
  const action = existing ? "vehicle_floorplan.updated" : "vehicle_floorplan.created";
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action,
    entity: "VehicleFloorplan",
    entityId: floorplan.id,
    metadata: { vehicleId, lenderId: data.lenderId, principalCents: data.principalCents },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return floorplan;
}

export async function addCurtailment(
  dealershipId: string,
  vehicleId: string,
  amountCents: number,
  paidAt: Date,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const floorplan = await floorplanDb.getByVehicleId(dealershipId, vehicleId);
  if (!floorplan) throw new ApiError("NOT_FOUND", "Floorplan not found");
  const curtailment = await floorplanDb.addCurtailment(
    dealershipId,
    floorplan.id,
    amountCents,
    paidAt
  );
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_floorplan.curtailment",
    entity: "VehicleFloorplanCurtailment",
    entityId: curtailment.id,
    metadata: { vehicleId, floorplanId: floorplan.id, amountCents, paidAt: paidAt.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return curtailment;
}

export async function setPayoffQuote(
  dealershipId: string,
  vehicleId: string,
  payoffQuoteCents: number,
  payoffQuoteExpiresAt: Date,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const floorplan = await floorplanDb.getByVehicleId(dealershipId, vehicleId);
  if (!floorplan) throw new ApiError("NOT_FOUND", "Floorplan not found");
  await floorplanDb.updatePayoffQuote(
    dealershipId,
    vehicleId,
    payoffQuoteCents,
    payoffQuoteExpiresAt
  );
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_floorplan.payoff_quote",
    entity: "VehicleFloorplan",
    entityId: floorplan.id,
    metadata: { vehicleId, payoffQuoteCents, payoffQuoteExpiresAt: payoffQuoteExpiresAt.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return floorplanDb.getByVehicleId(dealershipId, vehicleId);
}
