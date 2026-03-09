/**
 * GET /api/inventory/[id]/cost — ledger-derived totals only.
 * - 400 when id is not a valid UUID.
 * - 403 when inventory.read is denied.
 * - 200 with ledger-only response shape (no Vehicle flat cost fields).
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/inventory/service/vehicle", () => ({
  getVehicle: jest.fn(),
}));

jest.mock("@/modules/inventory/service/cost-ledger", () => ({
  getCostTotals: jest.fn(),
  ledgerTotalsToCostBreakdown: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";

const mockTotals = {
  acquisitionSubtotalCents: BigInt(1000000),
  transportCents: BigInt(50000),
  reconSubtotalCents: BigInt(200000),
  feesSubtotalCents: BigInt(75000),
  miscCents: BigInt(0),
  totalInvestedCents: BigInt(1325000),
};

const mockBreakdown = {
  auctionCostCents: BigInt(1000000),
  transportCostCents: BigInt(50000),
  reconCostCents: BigInt(200000),
  miscCostCents: BigInt(75000),
  totalCostCents: BigInt(1325000),
};

describe("GET /api/inventory/[id]/cost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({ id: vehicleId });
    (costLedger.getCostTotals as jest.Mock).mockResolvedValue(mockTotals);
    (costLedger.ledgerTotalsToCostBreakdown as jest.Mock).mockReturnValue(mockBreakdown);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
    expect(costLedger.getCostTotals).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
    expect(costLedger.getCostTotals).not.toHaveBeenCalled();
  });

  it("returns 200 with ledger-only totals (no Vehicle flat cost fields)", async () => {
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.vehicleId).toBe(vehicleId);
    expect(data.data.totalInvestedCents).toBe("1325000");
    expect(data.data.acquisitionSubtotalCents).toBe("1000000");
    expect(data.data.reconSubtotalCents).toBe("200000");
    expect(data.data.feesSubtotalCents).toBe("75000");
    expect(data.data.auctionCostCents).toBeDefined();
    expect(data.data.transportCostCents).toBeDefined();
    expect(data.data.reconCostCents).toBeDefined();
    expect(data.data.miscCostCents).toBeDefined();
    expect(data.data.totalCostCents).toBeDefined();
    expect(inventoryService.getVehicle).toHaveBeenCalledWith(ctx.dealershipId, vehicleId);
    expect(costLedger.getCostTotals).toHaveBeenCalledWith(ctx.dealershipId, vehicleId);
    expect(costLedger.ledgerTotalsToCostBreakdown).toHaveBeenCalledWith(mockTotals);
  });
});
