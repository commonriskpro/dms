/**
 * GET/POST /api/inventory/[id]/cost-entries:
 * - GET requires inventory.read; returns list from ledger.
 * - POST requires inventory.write; 400 on invalid body; 201 with created entry.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
    getRequestMeta: jest.fn(() => ({})),
  };
});

jest.mock("@/modules/inventory/service/vehicle", () => ({ getVehicle: jest.fn() }));
jest.mock("@/modules/inventory/service/cost-ledger", () => ({
  listCostEntries: jest.fn(),
  createCostEntry: jest.fn(),
}));
jest.mock("@/modules/vendors/service/vendor", () => ({ getVendor: jest.fn() }));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, POST } from "./route";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import * as vendorService from "@/modules/vendors/service/vendor";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";

const mockEntry = {
  id: "entry-1",
  vehicleId,
  category: "acquisition",
  amountCents: BigInt(1000000),
  vendorName: "Auction Co",
  occurredAt: new Date("2025-01-15"),
  memo: "Purchase",
  createdByUserId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/inventory/[id]/cost-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({ id: vehicleId });
    (costLedger.listCostEntries as jest.Mock).mockResolvedValue([mockEntry]);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
    expect(costLedger.listCostEntries).not.toHaveBeenCalled();
  });

  it("returns 200 with data array from listCostEntries", async () => {
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(mockEntry.id);
    expect(data.data[0].category).toBe("acquisition");
    expect(data.data[0].amountCents).toBe("1000000");
    expect(costLedger.listCostEntries).toHaveBeenCalledWith(ctx.dealershipId, vehicleId);
  });
});

describe("POST /api/inventory/[id]/cost-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({ id: vehicleId });
    (costLedger.createCostEntry as jest.Mock).mockResolvedValue(mockEntry);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = {
      json: () => Promise.resolve({ category: "acquisition", amountCents: 1000000, occurredAt: "2025-01-15T00:00:00.000Z" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
    expect(costLedger.createCostEntry).not.toHaveBeenCalled();
  });

  it("returns 201 with created entry when body is valid", async () => {
    const req = {
      json: () =>
        Promise.resolve({
          category: "acquisition",
          amountCents: "1000000",
          occurredAt: "2025-01-15T00:00:00.000Z",
          vendorName: "Auction Co",
          memo: "Purchase",
        }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.id).toBe(mockEntry.id);
    expect(data.data.vehicleId).toBe(vehicleId);
    expect(costLedger.createCostEntry).toHaveBeenCalledWith(
      ctx.dealershipId,
      vehicleId,
      ctx.userId,
      expect.objectContaining({
        category: "acquisition",
        vendorName: "Auction Co",
        memo: "Purchase",
      }),
      expect.anything()
    );
  });

  it("returns 400 when vendorId is supplied but vendor not found (wrong tenant or missing)", async () => {
    (vendorService.getVendor as jest.Mock).mockResolvedValue(null);
    const req = {
      json: () =>
        Promise.resolve({
          category: "acquisition",
          amountCents: "1000000",
          occurredAt: "2025-01-15T00:00:00.000Z",
          vendorId: "a1000000-0000-0000-0000-000000000001",
        }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("Vendor");
    expect(costLedger.createCostEntry).not.toHaveBeenCalled();
  });
});
