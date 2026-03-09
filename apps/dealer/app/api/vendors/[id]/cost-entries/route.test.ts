/**
 * GET /api/vendors/[id]/cost-entries:
 * - Requires inventory.read; 404 when vendor not found; 200 with data array.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/vendors/service/vendor", () => ({ getVendor: jest.fn() }));
jest.mock("@/modules/inventory/service/cost-ledger", () => ({
  listCostEntriesByVendor: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import * as vendorService from "@/modules/vendors/service/vendor";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

const vendorId = "a1000000-0000-0000-0000-000000000001";
const mockVendor = {
  id: vendorId,
  dealershipId: ctx.dealershipId,
  name: "Auction Co",
  type: "auction" as const,
};

const mockEntries = [
  {
    id: "entry-1",
    vehicleId: "e1000000-0000-0000-0000-000000000001",
    vehicle: { id: "e1000000-0000-0000-0000-000000000001", year: 2024, make: "Honda", model: "Civic", stockNumber: "S1" },
    category: "acquisition",
    amountCents: BigInt(1000000),
    occurredAt: new Date("2025-01-15"),
    memo: null,
  },
];

describe("GET /api/vendors/[id]/cost-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.getVendor as jest.Mock).mockResolvedValue(mockVendor);
    (costLedger.listCostEntriesByVendor as jest.Mock).mockResolvedValue(mockEntries);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(403);
    expect(vendorService.getVendor).not.toHaveBeenCalled();
    expect(costLedger.listCostEntriesByVendor).not.toHaveBeenCalled();
  });

  it("returns 404 when vendor not found", async () => {
    (vendorService.getVendor as jest.Mock).mockResolvedValue(null);
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(404);
    expect(vendorService.getVendor).toHaveBeenCalledWith(ctx.dealershipId, vendorId);
    expect(costLedger.listCostEntriesByVendor).not.toHaveBeenCalled();
  });

  it("returns 200 with data array when vendor found", async () => {
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].vehicleSummary).toBe("2024 Honda Civic");
    expect(body.data[0].amountCents).toBe("1000000");
    expect(costLedger.listCostEntriesByVendor).toHaveBeenCalledWith(
      ctx.dealershipId,
      vendorId,
      25
    );
  });
});
