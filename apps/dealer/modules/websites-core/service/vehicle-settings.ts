import * as vsDb from "../db/vehicle-settings";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { prisma } from "@/lib/db";
import type { UpsertVehicleWebsiteSettingsInput } from "../db/vehicle-settings";

async function requireVehicleBelongsToDealership(dealershipId: string, vehicleId: string) {
  const v = await prisma.vehicle.findFirst({
    where: { id: vehicleId, dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!v) throw new ApiError("NOT_FOUND", "Vehicle not found");
}

export async function getVehicleWebsiteSettings(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  await requireVehicleBelongsToDealership(dealershipId, vehicleId);
  return vsDb.getVehicleWebsiteSettings(dealershipId, vehicleId);
}

export async function upsertVehicleWebsiteSettings(
  dealershipId: string,
  vehicleId: string,
  data: UpsertVehicleWebsiteSettingsInput
) {
  await requireTenantActiveForWrite(dealershipId);
  await requireVehicleBelongsToDealership(dealershipId, vehicleId);
  return vsDb.upsertVehicleWebsiteSettings(dealershipId, vehicleId, data);
}
