import { prisma } from "@/lib/db";

export type UpsertVehicleWebsiteSettingsInput = {
  isPublished?: boolean;
  isFeatured?: boolean;
  hidePrice?: boolean;
  customHeadline?: string | null;
  customDescription?: string | null;
  sortPriority?: number;
  primaryPhotoOverrideId?: string | null;
};

export async function getVehicleWebsiteSettings(dealershipId: string, vehicleId: string) {
  return prisma.vehicleWebsiteSettings.findFirst({
    where: { vehicleId, dealershipId },
  });
}

export async function upsertVehicleWebsiteSettings(
  dealershipId: string,
  vehicleId: string,
  data: UpsertVehicleWebsiteSettingsInput
) {
  return prisma.vehicleWebsiteSettings.upsert({
    where: { vehicleId },
    create: {
      dealershipId,
      vehicleId,
      isPublished: data.isPublished ?? false,
      isFeatured: data.isFeatured ?? false,
      hidePrice: data.hidePrice ?? false,
      customHeadline: data.customHeadline ?? null,
      customDescription: data.customDescription ?? null,
      sortPriority: data.sortPriority ?? 0,
      primaryPhotoOverrideId: data.primaryPhotoOverrideId ?? null,
    },
    update: {
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      ...(data.hidePrice !== undefined && { hidePrice: data.hidePrice }),
      ...(data.customHeadline !== undefined && { customHeadline: data.customHeadline }),
      ...(data.customDescription !== undefined && { customDescription: data.customDescription }),
      ...(data.sortPriority !== undefined && { sortPriority: data.sortPriority }),
      ...(data.primaryPhotoOverrideId !== undefined && { primaryPhotoOverrideId: data.primaryPhotoOverrideId }),
    },
  });
}

export async function listPublishedVehicleSettings(dealershipId: string, limit = 100) {
  return prisma.vehicleWebsiteSettings.findMany({
    where: {
      dealershipId,
      isPublished: true,
      vehicle: { deletedAt: null },
    },
    include: {
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          trim: true,
          vin: true,
          stockNumber: true,
          status: true,
          salePriceCents: true,
          mileage: true,
          color: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { sortPriority: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}
