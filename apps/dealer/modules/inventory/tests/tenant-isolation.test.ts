/** @jest-environment node */
/**
 * Tenant isolation: Dealer A cannot list/get/update/delete Dealer B vehicles;
 * cannot list photos for Dealer B vehicle. Service layer throws NOT_FOUND for
 * cross-tenant access; API route handler maps NOT_FOUND → 404.
 */
import { prisma } from "@/lib/db";
import * as vehicleDb from "../db/vehicle";
import * as inventoryService from "../service/vehicle";

const dealerAId = "a1000000-0000-0000-0000-000000000001";
const dealerBId = "a2000000-0000-0000-0000-000000000002";
const userAId = "a3000000-0000-0000-0000-000000000003";

async function ensureTestData(): Promise<{ vehicleBId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "tenant-a@test.local" },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000004" },
    create: {
      id: "a4000000-0000-0000-0000-000000000004",
      dealershipId: dealerBId,
      stockNumber: "B-001",
      status: "AVAILABLE",
    },
    update: {},
  });
  return { vehicleBId: vehicleB.id };
}

describe("Inventory tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listVehicles for Dealer A does not return Dealer B vehicles (search, filter, pagination tenant-scoped)", async () => {
    const { data } = await vehicleDb.listVehicles(dealerAId, {
      limit: 25,
      offset: 0,
    });
    const fromB = data.filter((v) => v.dealershipId === dealerBId);
    expect(fromB).toHaveLength(0);
  });

  it("getVehicleById with wrong dealership returns null", async () => {
    const { vehicleBId } = await ensureTestData();
    const found = await vehicleDb.getVehicleById(dealerAId, vehicleBId);
    expect(found).toBeNull();
  });

  it("getVehicle (service) with wrong dealership throws NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    await expect(inventoryService.getVehicle(dealerAId, vehicleBId)).rejects.toThrow();
  });

  it("updateVehicle with wrong dealership throws NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    await expect(
      inventoryService.updateVehicle(dealerAId, userAId, vehicleBId, { status: "SOLD" })
    ).rejects.toThrow();
  });

  it("deleteVehicle with wrong dealership returns null", async () => {
    const { vehicleBId } = await ensureTestData();
    const result = await inventoryService.deleteVehicle(dealerAId, userAId, vehicleBId);
    expect(result).toBeNull();
  });

  it("listVehiclePhotos for Dealer B vehicle when called as Dealer A throws NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    await expect(
      inventoryService.listVehiclePhotos(dealerAId, vehicleBId)
    ).rejects.toThrow();
  });

  it("uploadVehiclePhoto for Dealer B vehicle when called as Dealer A throws NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    await expect(
      inventoryService.uploadVehiclePhoto(
        dealerAId,
        userAId,
        vehicleBId,
        {
          name: "photo.jpg",
          type: "image/jpeg",
          size: 100,
          arrayBuffer: async () => new ArrayBuffer(100),
        }
      )
    ).rejects.toThrow();
  });

  it("deleteVehiclePhoto for Dealer B vehicle when called as Dealer A throws NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    await expect(
      inventoryService.deleteVehiclePhoto(
        dealerAId,
        userAId,
        vehicleBId,
        "a6000000-0000-0000-0000-000000000006"
      )
    ).rejects.toThrow();
  });

  it("deleteVehiclePhoto with fileId belonging to another dealer's vehicle returns NOT_FOUND", async () => {
    const { vehicleBId } = await ensureTestData();
    const vehicleA = await prisma.vehicle.upsert({
      where: { id: "a5000000-0000-0000-0000-000000000005" },
      create: {
        id: "a5000000-0000-0000-0000-000000000005",
        dealershipId: dealerAId,
        stockNumber: "A-002",
        status: "AVAILABLE",
      },
      update: {},
    });
    const fileB = await prisma.fileObject.create({
      data: {
        dealershipId: dealerBId,
        bucket: "inventory-photos",
        path: `${dealerBId}/inventory-photos/${vehicleBId}/test.jpg`,
        filename: "test.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        uploadedBy: userAId,
        entityType: "Vehicle",
        entityId: vehicleBId,
      },
    });
    await expect(
      inventoryService.deleteVehiclePhoto(
        dealerAId,
        userAId,
        vehicleA.id,
        fileB.id,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow();
    await prisma.fileObject.delete({ where: { id: fileB.id } });
  });
});
