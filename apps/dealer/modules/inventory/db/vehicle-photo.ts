import { prisma } from "@/lib/db";

const BUCKET = "inventory-photos";
const ENTITY_TYPE = "Vehicle";

export async function listVehiclePhotosWithOrder(
  dealershipId: string,
  vehicleId: string
): Promise<
  Array<{
    id: string;
    fileObjectId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }>
> {
  const rows = await prisma.vehiclePhoto.findMany({
    where: { dealershipId, vehicleId },
    orderBy: { sortOrder: "asc" },
    include: {
      fileObject: true,
    },
  });
  return rows
    .filter((r) => r.fileObject.deletedAt == null)
    .map((r) => ({
      id: r.id,
      fileObjectId: r.fileObjectId,
      filename: r.fileObject.filename,
      mimeType: r.fileObject.mimeType,
      sizeBytes: r.fileObject.sizeBytes,
      sortOrder: r.sortOrder,
      isPrimary: r.isPrimary,
      createdAt: r.fileObject.createdAt,
    }));
}

export async function countVehiclePhotos(dealershipId: string, vehicleId: string): Promise<number> {
  const count = await prisma.vehiclePhoto.count({
    where: {
      dealershipId,
      vehicleId,
      fileObject: { deletedAt: null },
    },
  });
  return count;
}

export async function createVehiclePhoto(
  dealershipId: string,
  vehicleId: string,
  fileObjectId: string,
  sortOrder: number,
  isPrimary: boolean
) {
  return prisma.vehiclePhoto.create({
    data: {
      dealershipId,
      vehicleId,
      fileObjectId,
      sortOrder,
      isPrimary,
    },
  });
}

export async function getVehiclePhotoByFileId(
  dealershipId: string,
  vehicleId: string,
  fileObjectId: string
) {
  return prisma.vehiclePhoto.findFirst({
    where: { dealershipId, vehicleId, fileObjectId },
    include: { fileObject: true },
  });
}

export async function setPrimaryByFileId(
  dealershipId: string,
  vehicleId: string,
  fileObjectId: string
) {
  await prisma.$transaction([
    prisma.vehiclePhoto.updateMany({
      where: { dealershipId, vehicleId },
      data: { isPrimary: false },
    }),
    prisma.vehiclePhoto.updateMany({
      where: { dealershipId, vehicleId, fileObjectId },
      data: { isPrimary: true },
    }),
  ]);
}

export async function reorderVehiclePhotos(
  dealershipId: string,
  vehicleId: string,
  fileObjectIdsInOrder: string[]
) {
  const updates = fileObjectIdsInOrder.map((fileObjectId, index) =>
    prisma.vehiclePhoto.updateMany({
      where: { dealershipId, vehicleId, fileObjectId },
      data: { sortOrder: index },
    })
  );
  await prisma.$transaction(updates);
}

export async function deleteVehiclePhotoByFileId(
  dealershipId: string,
  vehicleId: string,
  fileObjectId: string
) {
  return prisma.vehiclePhoto.deleteMany({
    where: { dealershipId, vehicleId, fileObjectId },
  });
}

/** Backfill: find FileObjects for vehicle in inventory-photos bucket (not deleted) and return for VehiclePhoto creation. */
export async function listFileObjectsForVehicleWithoutVehiclePhoto(
  dealershipId: string,
  vehicleId: string
) {
  const files = await prisma.fileObject.findMany({
    where: {
      dealershipId,
      bucket: BUCKET,
      entityType: ENTITY_TYPE,
      entityId: vehicleId,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
  const linkedFileIds = await prisma.vehiclePhoto
    .findMany({
      where: { dealershipId, vehicleId },
      select: { fileObjectId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.fileObjectId)));
  return files.filter((f) => !linkedFileIds.has(f.id));
}

/**
 * List legacy-only FileObject IDs (inventory-photos, Vehicle, entityId not null, no VehiclePhoto).
 * Used for optional cleanup report/delete. Paginated.
 */
export async function listLegacyOnlyVehicleFileObjectIds(
  dealershipId: string,
  limit: number,
  offset: number
): Promise<{ ids: string[]; total: number }> {
  const where = {
    dealershipId,
    bucket: BUCKET,
    entityType: ENTITY_TYPE,
    entityId: { not: null },
    deletedAt: null,
    vehiclePhoto: null,
  };
  const [rows, total] = await Promise.all([
    prisma.fileObject.findMany({
      where,
      select: { id: true },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "asc" },
    }),
    prisma.fileObject.count({ where }),
  ]);
  return { ids: rows.map((r) => r.id), total };
}
