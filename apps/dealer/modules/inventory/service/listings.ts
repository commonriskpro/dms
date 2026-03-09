/**
 * Vehicle listing (marketing distribution): list, publish, unpublish. Publish readiness enforced.
 */
import * as vehicleDb from "../db/vehicle";
import * as vehicleListingDb from "../db/vehicle-listing";
import * as vehiclePhotoDb from "../db/vehicle-photo";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { VehicleListingPlatform } from "@prisma/client";

export async function listVehicleListings(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return vehicleListingDb.listVehicleListings(dealershipId, vehicleId);
}

function assertPublishReadiness(vehicle: { salePriceCents: bigint; vin: string | null; stockNumber: string }) {
  if (vehicle.salePriceCents <= 0) throw new ApiError("VALIDATION_ERROR", "Vehicle must have a price to publish");
  if (!vehicle.vin?.trim() && !vehicle.stockNumber?.trim())
    throw new ApiError("VALIDATION_ERROR", "Vehicle must have VIN or stock number");
}

/** Publish vehicle to a platform. Validates readiness (price, identity). Optionally require at least one photo. */
export async function publishVehicleToPlatform(
  dealershipId: string,
  vehicleId: string,
  platform: VehicleListingPlatform,
  options?: { requirePhoto?: boolean }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  assertPublishReadiness(vehicle);
  if (options?.requirePhoto) {
    const photos = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
    if (photos.length === 0) throw new ApiError("VALIDATION_ERROR", "Vehicle must have at least one photo to publish");
  }
  const listing = await vehicleListingDb.upsertVehicleListing(dealershipId, vehicleId, platform, {
    status: "PUBLISHED",
    lastSyncedAt: new Date(),
  });
  return listing;
}

/** Unpublish listing for a platform. */
export async function unpublishVehicleListing(
  dealershipId: string,
  vehicleId: string,
  platform: VehicleListingPlatform
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  await vehicleListingDb.setVehicleListingStatus(dealershipId, vehicleId, platform, "UNPUBLISHED");
  return vehicleListingDb.getVehicleListingByPlatform(dealershipId, vehicleId, platform);
}
