import { prisma } from "@/lib/db";
import * as vehicleDb from "../db/vehicle";
import * as vehiclePhotoDb from "../db/vehicle-photo";
import { auditLog } from "@/lib/audit";

const MAX_PHOTOS_PER_VEHICLE = 20;
const DEFAULT_BATCH_VEHICLES = 100;
const MAX_LIMIT_VEHICLES = 500;

export type BackfillPreviewVehicle = {
  vehicleId: string;
  fileObjectIdsToCreate: string[];
  skippedCount: number;
  wouldSetPrimary: boolean;
};

export type BackfillPreviewResult = {
  dealershipId: string;
  vehicles: BackfillPreviewVehicle[];
  summary: {
    vehiclesProcessed: number;
    vehiclesWithLegacy: number;
    photosWouldCreate: number;
    photosWouldSkip: number;
  };
  nextOffset: number | null;
};

export type BackfillRunResult = {
  dealershipId: string;
  summary: {
    vehiclesProcessed: number;
    vehiclesWithLegacy: number;
    photosCreated: number;
    photosSkipped: number;
  };
  nextOffset: number | null;
  errors?: Array<{ vehicleId: string; message: string }>;
};

export type BackfillDealershipOptions = {
  dealershipId: string;
  limitVehicles?: number;
  /** Offset for vehicle batch (cursor). */
  cursor?: number;
};

export type BackfillAllOptions = {
  limitDealerships?: number;
  dryRun: boolean;
};

/**
 * Preview what would be backfilled for a dealership (no writes).
 */
export async function previewBackfillForDealership(
  options: BackfillDealershipOptions
): Promise<BackfillPreviewResult> {
  const {
    dealershipId,
    limitVehicles = DEFAULT_BATCH_VEHICLES,
    cursor = 0,
  } = options;
  const limit = Math.min(limitVehicles, MAX_LIMIT_VEHICLES);
  const { ids, total } = await vehicleDb.listVehicleIds(dealershipId, limit, cursor);

  const vehicles: BackfillPreviewVehicle[] = [];
  let photosWouldCreate = 0;
  let photosWouldSkip = 0;

  for (const vehicleId of ids) {
    const legacy = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      dealershipId,
      vehicleId
    );
    if (legacy.length === 0) continue;

    const existing = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
    const existingCount = existing.length;
    const hasPrimary = existing.some((p) => p.isPrimary);
    const slotCount = Math.max(0, MAX_PHOTOS_PER_VEHICLE - existingCount);
    const toCreate = legacy.slice(0, slotCount);
    const skipped = legacy.length - toCreate.length;

    vehicles.push({
      vehicleId,
      fileObjectIdsToCreate: toCreate.map((f) => f.id),
      skippedCount: skipped,
      wouldSetPrimary: !hasPrimary && toCreate.length > 0,
    });
    photosWouldCreate += toCreate.length;
    photosWouldSkip += skipped;
  }

  const nextOffset = cursor + ids.length < total ? cursor + ids.length : null;
  return {
    dealershipId,
    vehicles,
    summary: {
      vehiclesProcessed: ids.length,
      vehiclesWithLegacy: vehicles.length,
      photosWouldCreate,
      photosWouldSkip,
    },
    nextOffset,
  };
}

/**
 * Run backfill for a dealership. If dryRun, returns same shape as preview (no writes).
 */
export async function runBackfillForDealership(
  options: BackfillDealershipOptions & { dryRun: boolean },
  actorUserId: string | null
): Promise<BackfillRunResult> {
  const {
    dealershipId,
    limitVehicles = DEFAULT_BATCH_VEHICLES,
    cursor = 0,
    dryRun,
  } = options;
  const limit = Math.min(limitVehicles, MAX_LIMIT_VEHICLES);
  const { ids, total } = await vehicleDb.listVehicleIds(dealershipId, limit, cursor);

  let vehiclesWithLegacy = 0;
  let photosCreated = 0;
  let photosSkipped = 0;
  const errors: Array<{ vehicleId: string; message: string }> = [];

  for (const vehicleId of ids) {
    const legacy = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      dealershipId,
      vehicleId
    );
    if (legacy.length === 0) continue;
    vehiclesWithLegacy += 1;

    const existing = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
    const existingCount = existing.length;
    const hasPrimary = existing.some((p) => p.isPrimary);
    const slotCount = Math.max(0, MAX_PHOTOS_PER_VEHICLE - existingCount);
    const toCreate = legacy.slice(0, slotCount);
    const skipped = legacy.length - toCreate.length;
    photosSkipped += skipped;

    if (dryRun) {
      photosCreated += toCreate.length;
      continue;
    }

    try {
      const maxSort = existing.length > 0
        ? Math.max(...existing.map((p) => p.sortOrder), -1)
        : -1;
      const startSort = maxSort + 1;
      const isFirstNew = !hasPrimary;

      await prisma.vehiclePhoto.createMany({
        data: toCreate.map((fileObj, i) => ({
          dealershipId,
          vehicleId,
          fileObjectId: fileObj.id,
          sortOrder: startSort + i,
          isPrimary: isFirstNew && i === 0,
        })),
      });
      photosCreated += toCreate.length;

      await auditLog({
        dealershipId,
        actorUserId,
        action: "vehicle_photo.backfilled",
        entity: "Vehicle",
        entityId: vehicleId,
        metadata: {
          countCreated: toCreate.length,
          countSkipped: skipped,
          fileObjectIds: toCreate.map((f) => f.id),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ vehicleId, message });
    }
  }

  const nextOffset = cursor + ids.length < total ? cursor + ids.length : null;
  return {
    dealershipId,
    summary: {
      vehiclesProcessed: ids.length,
      vehiclesWithLegacy,
      photosCreated,
      photosSkipped,
    },
    nextOffset,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Run backfill for all dealerships (batches of dealerships). Uses Prisma to list dealership IDs.
 */
export async function runBackfillForAllDealerships(
  options: BackfillAllOptions,
  actorUserId: string | null
): Promise<{
  dealershipsProcessed: number;
  totalPhotosCreated: number;
  totalPhotosSkipped: number;
  results: BackfillRunResult[];
}> {
  const limitDealerships = options.limitDealerships ?? 50;
  const dealerships = await prisma.dealership.findMany({
    take: limitDealerships,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results: BackfillRunResult[] = [];
  let totalPhotosCreated = 0;
  let totalPhotosSkipped = 0;

  for (const d of dealerships) {
    const result = await runBackfillForDealership(
      {
        dealershipId: d.id,
        limitVehicles: DEFAULT_BATCH_VEHICLES,
        cursor: 0,
        dryRun: options.dryRun,
      },
      actorUserId
    );
    results.push(result);
    totalPhotosCreated += result.summary.photosCreated;
    totalPhotosSkipped += result.summary.photosSkipped;
  }

  return {
    dealershipsProcessed: results.length,
    totalPhotosCreated,
    totalPhotosSkipped,
    results,
  };
}
