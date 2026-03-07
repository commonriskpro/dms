import { prisma } from "@/lib/db";
import type { VehicleListingPlatform, VehicleListingStatus } from "@prisma/client";

export async function listVehicleListings(dealershipId: string, vehicleId: string) {
  return prisma.vehicleListing.findMany({
    where: { dealershipId, vehicleId },
    orderBy: { platform: "asc" },
  });
}

export async function getVehicleListingByPlatform(
  dealershipId: string,
  vehicleId: string,
  platform: VehicleListingPlatform
) {
  return prisma.vehicleListing.findFirst({
    where: { dealershipId, vehicleId, platform },
  });
}

export async function upsertVehicleListing(
  dealershipId: string,
  vehicleId: string,
  platform: VehicleListingPlatform,
  data: {
    status: VehicleListingStatus;
    externalListingId?: string | null;
    lastSyncedAt?: Date | null;
  }
) {
  return prisma.vehicleListing.upsert({
    where: {
      dealershipId_vehicleId_platform: { dealershipId, vehicleId, platform },
    },
    create: {
      dealershipId,
      vehicleId,
      platform,
      status: data.status,
      externalListingId: data.externalListingId ?? null,
      lastSyncedAt: data.lastSyncedAt ?? null,
    },
    update: {
      status: data.status,
      externalListingId: data.externalListingId ?? null,
      lastSyncedAt: data.lastSyncedAt ?? null,
    },
  });
}

export async function setVehicleListingStatus(
  dealershipId: string,
  vehicleId: string,
  platform: VehicleListingPlatform,
  status: VehicleListingStatus
) {
  return prisma.vehicleListing.updateMany({
    where: { dealershipId, vehicleId, platform },
    data: { status },
  });
}
