/** @jest-environment node */
/**
 * Audit: create vehicle → vehicle.created; update (status change) → vehicle.updated and vehicle.status_changed;
 * photo upload → file.uploaded and vehicle.photo_uploaded.
 */
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
  }),
}));

import { prisma } from "@/lib/db";
import * as inventoryService from "../service/vehicle";

const dealerId = "c1000000-0000-0000-0000-000000000001";
const userId = "c2000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<{ vehicleId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Audit Inventory Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "audit-inv@test.local" },
    update: {},
  });
  let vehicle = await prisma.vehicle.findFirst({
    where: { dealershipId: dealerId, stockNumber: "AUDIT-001", deletedAt: null },
  });
  if (!vehicle) {
    vehicle = await inventoryService.createVehicle(
      dealerId,
      userId,
      { stockNumber: "AUDIT-001", status: "AVAILABLE" },
      { ip: "127.0.0.1" }
    );
  }
  return { vehicleId: vehicle.id };
}

describe("Inventory audit", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("createVehicle creates vehicle.created audit log row", async () => {
    const stockNumber = `AUDIT-002-${Date.now()}`;
    const created = await inventoryService.createVehicle(
      dealerId,
      userId,
      { stockNumber, status: "HOLD" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Vehicle",
        action: "vehicle.created",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.vehicleId).toBe(created.id);
    expect(meta?.stockNumber).toBe(stockNumber);
    expect(meta?.status).toBe("HOLD");
  });

  it("updateVehicle with status change creates vehicle.status_changed and vehicle.updated", async () => {
    const { vehicleId } = await ensureTestData();
    await inventoryService.updateVehicle(
      dealerId,
      userId,
      vehicleId,
      { status: "SOLD" },
      { ip: "127.0.0.1" }
    );
    const statusChanged = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Vehicle",
        action: "vehicle.status_changed",
        entityId: vehicleId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(statusChanged).toBeDefined();
    const meta = statusChanged?.metadata as Record<string, unknown> | null;
    expect(meta?.previousStatus).toBe("AVAILABLE");
    expect(meta?.newStatus).toBe("SOLD");
    const updated = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Vehicle",
        action: "vehicle.updated",
        entityId: vehicleId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(updated).toBeDefined();
  });

  it("deleteVehicle creates vehicle.deleted audit log row", async () => {
    const stockNumber = `AUDIT-DEL-${Date.now()}`;
    const created = await inventoryService.createVehicle(
      dealerId,
      userId,
      { stockNumber, status: "AVAILABLE" },
      { ip: "127.0.0.1" }
    );
    await inventoryService.deleteVehicle(dealerId, userId, created.id, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Vehicle",
        action: "vehicle.deleted",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
  });

  it("uploadVehiclePhoto creates vehicle_photo.added and file.uploaded audit log rows", async () => {
    const stockNumber = `AUDIT-PHOTO-${Date.now()}`;
    const created = await inventoryService.createVehicle(
      dealerId,
      userId,
      { stockNumber, status: "AVAILABLE" },
      { ip: "127.0.0.1" }
    );
    const fileObject = await inventoryService.uploadVehiclePhoto(
      dealerId,
      userId,
      created.id,
      {
        name: "test.jpg",
        type: "image/jpeg",
        size: 100,
        arrayBuffer: async () => new ArrayBuffer(100),
      },
      { ip: "127.0.0.1" }
    );
    const vehiclePhotoLog = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Vehicle",
        action: "vehicle_photo.added",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(vehiclePhotoLog).toBeDefined();
    const vehicleMeta = vehiclePhotoLog?.metadata as Record<string, unknown> | null;
    expect(vehicleMeta?.fileId).toBe(fileObject.id);

    const fileLog = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "FileObject",
        action: "file.uploaded",
        entityId: fileObject.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(fileLog).toBeDefined();
    const fileMeta = fileLog?.metadata as Record<string, unknown> | null;
    expect(fileMeta?.bucket).toBe("inventory-photos");
    expect(fileMeta?.sizeBytes).toBe(100);
  });
});
