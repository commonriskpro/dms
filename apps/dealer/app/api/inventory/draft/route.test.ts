jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
    getRequestMeta: jest.fn().mockReturnValue({}),
  };
});

jest.mock("@/modules/inventory/service/vehicle", () => {
  const actual = jest.requireActual<
    typeof import("@/modules/inventory/service/vehicle")
  >("@/modules/inventory/service/vehicle");
  return {
    ...actual,
    createVehicleDraft: jest.fn(),
  };
});

jest.mock("@/modules/inventory/service/cost-ledger", () => {
  const actual = jest.requireActual<
    typeof import("@/modules/inventory/service/cost-ledger")
  >("@/modules/inventory/service/cost-ledger");
  return {
    ...actual,
    getCostTotals: jest.fn(),
  };
});

import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/auth";
import { getAuthContext, guardPermission } from "@/lib/api/handler";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import { POST } from "./route";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.write"],
};

const draftId = "e1000000-0000-0000-0000-000000000011";

describe("POST /api/inventory/draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.createVehicleDraft as jest.Mock).mockResolvedValue({
      id: draftId,
      dealershipId: ctx.dealershipId,
      isDraft: true,
      vin: "1HGCM82633A004352",
      year: 2024,
      make: "Honda",
      model: "Civic",
      trim: "EX",
      stockNumber: "DRAFT-123456",
      mileage: 12345,
      color: "Blue",
      status: "AVAILABLE",
      salePriceCents: BigInt(2599000),
      auctionCostCents: BigInt(0),
      transportCostCents: BigInt(0),
      reconCostCents: BigInt(0),
      miscCostCents: BigInt(0),
      locationId: null,
      createdAt: new Date("2026-03-11T12:00:00.000Z"),
      updatedAt: new Date("2026-03-11T12:00:00.000Z"),
      location: null,
    });
    (costLedger.getCostTotals as jest.Mock).mockResolvedValue({
      acquisitionSubtotalCents: BigInt(0),
      transportCents: BigInt(0),
      reconSubtotalCents: BigInt(0),
      feesSubtotalCents: BigInt(0),
      miscCents: BigInt(0),
      totalInvestedCents: BigInt(0),
    });
  });

  it("returns 201 with an isDraft vehicle response", async () => {
    const req = {
      headers: new Headers(),
      json: async () => ({
        vin: "1HGCM82633A004352",
        make: "Honda",
        model: "Civic",
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    const payload = await res.json();
    expect(res.status).toBe(201);
    expect(payload.data.id).toBe(draftId);
    expect(payload.data.isDraft).toBe(true);
    expect(inventoryService.createVehicleDraft).toHaveBeenCalledWith(
      ctx.dealershipId,
      ctx.userId,
      expect.objectContaining({
        vin: "1HGCM82633A004352",
        make: "Honda",
        model: "Civic",
      }),
      {}
    );
  });

  it("returns 403 when inventory.write is denied", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {
      headers: new Headers(),
      json: async () => ({}),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
