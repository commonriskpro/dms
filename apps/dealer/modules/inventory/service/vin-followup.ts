import * as vehicleDb from "../db/vehicle";
import * as vinDecodeDb from "../db/vin-decode";
import * as vinDecodeCacheService from "./vin-decode-cache";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";

export type VinFollowUpResult = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
  cacheWarmed: boolean;
  attachedDecode: boolean;
  skippedReason?: string | null;
};

export async function runVinFollowUpJob(
  dealershipId: string,
  vehicleId: string,
  vin: string
): Promise<VinFollowUpResult> {
  await requireTenantActiveForWrite(dealershipId);

  const normalizedVin = vin.trim().toUpperCase();
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) {
    return {
      dealershipId,
      vehicleId,
      vin: normalizedVin,
      cacheWarmed: false,
      attachedDecode: false,
      skippedReason: "vehicle_not_found",
    };
  }

  const decoded = await vinDecodeCacheService.decodeVin(dealershipId, normalizedVin);
  const latestDecode = await vinDecodeDb.getLatestByVehicleId(dealershipId, vehicleId);
  const sameVehicleVin = (vehicle.vin ?? "").trim().toUpperCase() === normalizedVin;

  if (!sameVehicleVin) {
    return {
      dealershipId,
      vehicleId,
      vin: normalizedVin,
      cacheWarmed: true,
      attachedDecode: false,
      skippedReason: "vehicle_vin_changed",
    };
  }

  if (latestDecode?.vin === normalizedVin) {
    return {
      dealershipId,
      vehicleId,
      vin: normalizedVin,
      cacheWarmed: true,
      attachedDecode: false,
      skippedReason: "already_attached",
    };
  }

  await vinDecodeDb.createVinDecode({
    dealershipId,
    vehicleId,
    vin: normalizedVin,
    year: decoded.vehicle.year ?? null,
    make: decoded.vehicle.make ?? null,
    model: decoded.vehicle.model ?? null,
    trim: decoded.vehicle.trim ?? null,
    bodyStyle: decoded.vehicle.bodyStyle ?? null,
    engine: decoded.vehicle.engine ?? null,
    drivetrain: decoded.vehicle.driveType ?? null,
    transmission: decoded.vehicle.transmission ?? null,
    fuelType: decoded.vehicle.fuelType ?? null,
    manufacturedIn: null,
    rawJson: {
      source: decoded.source,
      cached: decoded.cached,
      vehicle: decoded.vehicle,
    },
  });

  return {
    dealershipId,
    vehicleId,
    vin: normalizedVin,
    cacheWarmed: true,
    attachedDecode: true,
  };
}
