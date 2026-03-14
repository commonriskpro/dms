/**
 * Public-safe serializers. Explicit field allowlists only.
 * Internal UUIDs, cost/margin data, and operational fields are excluded.
 *
 * Note: VehiclePhoto does not store URLs directly — photos are referenced by
 * fileObjectId. The public app resolves photo URLs via a public signed-URL
 * endpoint. This serializer returns fileObjectIds for the photo list.
 */
import type { Vehicle, VehicleWebsiteSettings, VehiclePhoto } from "@prisma/client";
import type { PublicVehicleSummary, PublicVehicleDetail } from "@dms/contracts";

type VehicleWithSettings = Vehicle & {
  websiteSettings: VehicleWebsiteSettings | null;
  vehiclePhotos: VehiclePhoto[];
};

export function vehicleToSlug(v: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  stockNumber: string;
}): string {
  const parts = [
    v.year?.toString(),
    v.make?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.model?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.trim?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.vin ? v.vin.slice(-6).toLowerCase() : v.stockNumber.toLowerCase(),
  ]
    .filter(Boolean)
    .join("-");
  return parts || v.stockNumber;
}

function getPrimaryPhotoFileObjectId(
  vehicle: Vehicle & { vehiclePhotos: VehiclePhoto[] },
  overridePhotoId: string | null
): string | null {
  if (overridePhotoId) {
    const override = vehicle.vehiclePhotos.find((p) => p.id === overridePhotoId);
    if (override) return override.fileObjectId;
  }
  const primary = vehicle.vehiclePhotos.find((p) => p.isPrimary) ?? vehicle.vehiclePhotos[0];
  return primary?.fileObjectId ?? null;
}

export function serializePublicVehicleSummary(v: VehicleWithSettings): PublicVehicleSummary {
  const settings = v.websiteSettings;
  const hidePrice = settings?.hidePrice ?? false;
  return {
    slug: vehicleToSlug(v),
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim ?? null,
    condition: "USED",
    mileage: v.mileage,
    price: hidePrice ? null : v.salePriceCents.toString(),
    hidePrice,
    primaryPhotoUrl: getPrimaryPhotoFileObjectId(v, settings?.primaryPhotoOverrideId ?? null),
    isFeatured: settings?.isFeatured ?? false,
    customHeadline: settings?.customHeadline ?? null,
    bodyStyle: null,
    exteriorColor: v.color ?? null,
    stockNumber: v.stockNumber,
  };
}

type VehicleWithSettingsAndVinDecode = VehicleWithSettings & {
  vinDecodes?: Array<{
    bodyStyle?: string | null;
    engine?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
  }>;
};

export function serializePublicVehicleDetail(v: VehicleWithSettingsAndVinDecode): PublicVehicleDetail {
  const settings = v.websiteSettings;
  const hidePrice = settings?.hidePrice ?? false;
  const vinDecode = v.vinDecodes?.[0] ?? null;

  const photos = v.vehiclePhotos
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 20)
    .map((p) => p.fileObjectId);

  return {
    slug: vehicleToSlug(v),
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim ?? null,
    condition: "USED",
    mileage: v.mileage,
    price: hidePrice ? null : v.salePriceCents.toString(),
    hidePrice,
    primaryPhotoUrl: getPrimaryPhotoFileObjectId(v, settings?.primaryPhotoOverrideId ?? null),
    isFeatured: settings?.isFeatured ?? false,
    customHeadline: settings?.customHeadline ?? null,
    bodyStyle: vinDecode?.bodyStyle ?? null,
    exteriorColor: v.color ?? null,
    stockNumber: v.stockNumber,
    interiorColor: null,
    engine: vinDecode?.engine ?? null,
    transmission: vinDecode?.transmission ?? null,
    drivetrain: vinDecode?.drivetrain ?? null,
    vinPartial: v.vin ? v.vin.slice(-6) : null,
    photos,
    customDescription: settings?.customDescription ?? null,
    seoTitle: settings?.customHeadline
      ? settings.customHeadline
      : `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`,
    seoDescription: settings?.customDescription ?? null,
  };
}
