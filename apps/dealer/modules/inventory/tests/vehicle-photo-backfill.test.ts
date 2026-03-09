/** @jest-environment node */
/**
 * Backfill: DRY RUN vs APPLY, primary rule, max 20, tenant isolation, no-legacy invariant.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as vehiclePhotoDb from "../db/vehicle-photo";
import * as vehicleDb from "../db/vehicle";
import {
  previewBackfillForDealership,
  runBackfillForDealership,
} from "../service/vehicle-photo-backfill";

const userAId = "b3000000-0000-0000-0000-000000000003";

function freshIds(): { dealershipId: string; vehicleId: string } {
  return { dealershipId: randomUUID(), vehicleId: randomUUID() };
}

async function ensureDealershipsAndVehicle(
  dealershipId: string,
  vehicleId: string
): Promise<void> {
  await prisma.dealership.upsert({
    where: { id: dealershipId },
    create: { id: dealershipId, name: "Backfill Test Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "backfill@test.local" },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: {
      id: vehicleId,
      dealershipId,
      stockNumber: `STK-${vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {
      dealershipId,
      stockNumber: `STK-${vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
  });
}

/** Create a legacy FileObject (inventory-photos, Vehicle, entityId=vehicleId) without VehiclePhoto. */
async function createLegacyFileObject(
  dealershipId: string,
  vehicleId: string,
  id?: string
): Promise<string> {
  const file = await prisma.fileObject.create({
    data: {
      id: id ?? undefined,
      dealershipId,
      bucket: "inventory-photos",
      path: `${dealershipId}/inventory-photos/${vehicleId}/${crypto.randomUUID()}.jpg`,
      filename: "test.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
      uploadedBy: userAId,
      entityType: "Vehicle",
      entityId: vehicleId,
    },
  });
  return file.id;
}

describe("Vehicle photo backfill", () => {
  it("DRY RUN does not create VehiclePhoto rows", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    await createLegacyFileObject(testDealerId, vehicleId);

    const before = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);
    const result = await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: true },
      userAId
    );
    const after = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);

    expect(before).toHaveLength(0);
    expect(after).toHaveLength(0);
    expect(result.summary.vehiclesWithLegacy).toBe(1);
    expect(result.summary.photosCreated).toBe(1);
  });

  it("APPLY creates VehiclePhoto rows for legacy FileObjects", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    await createLegacyFileObject(testDealerId, vehicleId);

    const before = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      testDealerId,
      vehicleId
    );
    expect(before).toHaveLength(1);

    await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: false },
      userAId
    );

    const afterLegacy = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      testDealerId,
      vehicleId
    );
    const afterPhotos = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);
    expect(afterLegacy).toHaveLength(0);
    expect(afterPhotos).toHaveLength(1);
  });

  it("Primary rule: first new photo is primary when vehicle has no primary", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    await createLegacyFileObject(testDealerId, vehicleId);

    await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: false },
      userAId
    );

    const photos = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);
    const primary = photos.find((p) => p.isPrimary);
    expect(photos).toHaveLength(1);
    expect(primary).toBeDefined();
    expect(primary!.isPrimary).toBe(true);
  });

  it("Primary rule: when primary exists, new photos do not override", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    const fileId = await createLegacyFileObject(testDealerId, vehicleId);
    await vehiclePhotoDb.createVehiclePhoto(testDealerId, vehicleId, fileId, 0, true);
    const secondFileId = await createLegacyFileObject(testDealerId, vehicleId);

    await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: false },
      userAId
    );

    const photos = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);
    const primaryCount = photos.filter((p) => p.isPrimary).length;
    expect(primaryCount).toBe(1);
    const firstPhoto = photos.find((p) => p.fileObjectId === fileId);
    expect(firstPhoto?.isPrimary).toBe(true);
    const secondPhoto = photos.find((p) => p.fileObjectId === secondFileId);
    expect(secondPhoto?.isPrimary).toBe(false);
  });

  it("Max 20: never exceed 20 photos per vehicle after backfill", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    for (let i = 0; i < 22; i++) {
      await createLegacyFileObject(testDealerId, vehicleId);
    }

    await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: false },
      userAId
    );

    const photos = await vehiclePhotoDb.listVehiclePhotosWithOrder(testDealerId, vehicleId);
    expect(photos.length).toBeLessThanOrEqual(20);
    const stillLegacy = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      testDealerId,
      vehicleId
    );
    expect(stillLegacy.length).toBeGreaterThanOrEqual(2);
  });

  it("Tenant isolation: backfill only processes requested dealership vehicles", async () => {
    const dealerAId = randomUUID();
    const dealerBId = randomUUID();
    const vehicleAId = randomUUID();
    const vehicleBId = randomUUID();
    await ensureDealershipsAndVehicle(dealerAId, vehicleAId);
    await ensureDealershipsAndVehicle(dealerBId, vehicleBId);
    await createLegacyFileObject(dealerAId, vehicleAId);
    const legacyBFileId = await createLegacyFileObject(dealerBId, vehicleBId);

    await runBackfillForDealership(
      { dealershipId: dealerAId, limitVehicles: 100, cursor: 0, dryRun: false },
      userAId
    );

    const legacyA = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      dealerAId,
      vehicleAId
    );
    const legacyB = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      dealerBId,
      vehicleBId
    );
    expect(legacyA).toHaveLength(0);
    expect(legacyB.map((f) => f.id)).toContain(legacyBFileId);
    expect(legacyB.length).toBeGreaterThanOrEqual(1);
  });

  it("Preview returns plan with summary and nextOffset", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    await createLegacyFileObject(testDealerId, vehicleId);

    const preview = await previewBackfillForDealership({
      dealershipId: testDealerId,
      limitVehicles: 10,
      cursor: 0,
    });

    expect(preview.dealershipId).toBe(testDealerId);
    expect(preview.summary.vehiclesWithLegacy).toBe(1);
    expect(preview.summary.photosWouldCreate).toBe(1);
    expect(preview.vehicles).toHaveLength(1);
    expect(preview.vehicles[0].fileObjectIdsToCreate).toHaveLength(1);
    expect(preview.vehicles[0].wouldSetPrimary).toBe(true);
  });

  it("Invariant: after backfill, legacy count for that vehicle is 0", async () => {
    const { dealershipId: testDealerId, vehicleId } = freshIds();
    await ensureDealershipsAndVehicle(testDealerId, vehicleId);
    await createLegacyFileObject(testDealerId, vehicleId);

    await runBackfillForDealership(
      { dealershipId: testDealerId, limitVehicles: 10, cursor: 0, dryRun: false },
      userAId
    );

    const legacy = await vehiclePhotoDb.listFileObjectsForVehicleWithoutVehiclePhoto(
      testDealerId,
      vehicleId
    );
    expect(legacy).toHaveLength(0);
  });
});

describe("Vehicle listVehicleIds for backfill", () => {
  it("listVehicleIds returns paginated ids scoped by dealership", async () => {
    const { dealershipId: dealerAId, vehicleId } = freshIds();
    const dealerBId = randomUUID();
    await ensureDealershipsAndVehicle(dealerAId, vehicleId);

    const { ids, total } = await vehicleDb.listVehicleIds(dealerAId, 10, 0);
    expect(ids).toContain(vehicleId);
    expect(total).toBe(1);
    const otherDealer = await vehicleDb.listVehicleIds(dealerBId, 10, 0);
    expect(otherDealer.ids).not.toContain(vehicleId);
  });
});
