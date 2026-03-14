import * as vinDecodeDb from "../db/vin-decode";
import * as vehicleDb from "../db/vehicle";
import * as vinDecodeCacheService from "./vin-decode-cache";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite, requireTenantActiveForRead } from "@/lib/tenant-status";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";

export type GetVinOptions = {
  latestOnly?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Trigger VIN decode for a vehicle. Vehicle must belong to dealership.
 * Uses canonical NHTSA/cache decode (vin-decode-cache); creates VehicleVinDecode and audits.
 */
export async function decodeVin(
  dealershipId: string,
  vehicleId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ decodeId: string; status: "completed" }> {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const vin = vehicle.vin?.trim();
  if (!vin) throw new ApiError("VALIDATION_ERROR", "Vehicle has no VIN to decode");
  const result = await vinDecodeCacheService.decodeVin(dealershipId, vin);
  const v = result.vehicle;
  const created = await vinDecodeDb.createVinDecode({
    dealershipId,
    vehicleId,
    vin: result.vin,
    make: v.make ?? null,
    model: v.model ?? null,
    year: v.year ?? null,
    trim: v.trim ?? null,
    bodyStyle: v.bodyStyle ?? null,
    engine: v.engine ?? null,
    drivetrain: v.driveType ?? null,
    transmission: v.transmission ?? null,
    fuelType: v.fuelType ?? null,
    rawJson: { source: result.source, cached: result.cached, vehicle: v },
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vin_decode.requested",
    entity: "VehicleVinDecode",
    entityId: created.id,
    metadata: { vehicleId, decodeId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("vehicle.vin_decoded", {
    dealershipId,
    vehicleId,
    vin: result.vin,
    source: "api",
  });
  return { decodeId: created.id, status: "completed" };
}

export type GetVinResultLatest = {
  vin: string;
  decoded: Awaited<ReturnType<typeof vinDecodeDb.getLatestByVehicleId>>;
};

export type GetVinResultList = {
  data: Awaited<ReturnType<typeof vinDecodeDb.listByVehicleId>>;
  meta: { total: number; limit: number; offset: number };
};

/**
 * Get decoded VIN data for vehicle. Returns NOT_FOUND if vehicle does not exist or does not belong to dealership.
 */
export async function getVin(
  dealershipId: string,
  vehicleId: string,
  options: GetVinOptions = {}
): Promise<GetVinResultLatest | GetVinResultList> {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const vin = vehicle.vin ?? "";

  const latestOnly = options.latestOnly !== false;
  if (latestOnly) {
    const decoded = await vinDecodeDb.getLatestByVehicleId(dealershipId, vehicleId);
    return { vin, decoded };
  }

  const limit = Math.min(options.limit ?? 50, 50);
  const offset = options.offset ?? 0;
  const [list, total] = await Promise.all([
    vinDecodeDb.listByVehicleId(dealershipId, vehicleId, limit, offset),
    vinDecodeDb.getTotalByVehicleId(dealershipId, vehicleId),
  ]);
  return { data: list, meta: { total, limit, offset } };
}
