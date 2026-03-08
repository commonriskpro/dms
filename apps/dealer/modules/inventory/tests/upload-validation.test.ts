/** @jest-environment node */
/**
 * Upload validation: disallowed mime rejected; oversized rejected.
 * Path/filename sanitization and path prefixed by dealershipId/vehicleId are in core file service.
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
import { ApiError } from "@/lib/auth";

const dealerId = "d1000000-0000-0000-0000-000000000001";
const userId = "d2000000-0000-0000-0000-000000000002";

async function ensureVehicle(): Promise<string> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Upload Validation Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "upload-val@test.local" },
    update: {},
  });
  let vehicle = await prisma.vehicle.findFirst({
    where: { dealershipId: dealerId, stockNumber: "UV-001", deletedAt: null },
  });
  if (!vehicle) {
    vehicle = await inventoryService.createVehicle(
      dealerId,
      userId,
      { stockNumber: "UV-001", status: "AVAILABLE" },
      { ip: "127.0.0.1" }
    );
  }
  return vehicle.id;
}

describe("Inventory photo upload validation", () => {
  beforeAll(async () => {
    await ensureVehicle();
  });

  it("rejects disallowed mime type with VALIDATION_ERROR", async () => {
    const vehicleId = await ensureVehicle();
    await expect(
      inventoryService.uploadVehiclePhoto(
        dealerId,
        userId,
        vehicleId,
        {
          name: "file.txt",
          type: "text/plain",
          size: 100,
          arrayBuffer: async () => new ArrayBuffer(100),
        },
        { ip: "127.0.0.1" }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("Allowed types"),
    });
    await expect(
      inventoryService.uploadVehiclePhoto(
        dealerId,
        userId,
        vehicleId,
        {
          name: "file.gif",
          type: "image/gif",
          size: 100,
          arrayBuffer: async () => new ArrayBuffer(100),
        },
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
  });

  it("rejects oversized file with VALIDATION_ERROR", async () => {
    const vehicleId = await ensureVehicle();
    const overSize = 10 * 1024 * 1024 + 1; // 10MB + 1 byte
    await expect(
      inventoryService.uploadVehiclePhoto(
        dealerId,
        userId,
        vehicleId,
        {
          name: "large.jpg",
          type: "image/jpeg",
          size: overSize,
          arrayBuffer: async () => new ArrayBuffer(overSize),
        },
        { ip: "127.0.0.1" }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("too large"),
    });
  });
});
