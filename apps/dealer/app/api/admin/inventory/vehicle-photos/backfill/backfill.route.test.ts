/**
 * Admin backfill: RBAC (non-admin gets 403), validation, tenant isolation (cannot backfill other dealership).
 */
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/auth";
import { POST as previewPost } from "./preview/route";
import { POST as applyPost } from "./apply/route";

jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardAnyPermission: jest.fn(),
  };
});
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(() => true),
  incrementRateLimit: jest.fn(),
}));
jest.mock("@/modules/inventory/service/vehicle-photo-backfill", () => ({
  previewBackfillForDealership: jest.fn().mockResolvedValue({
    dealershipId: "d1000000-0000-0000-0000-000000000001",
    vehicles: [],
    summary: {
      vehiclesProcessed: 0,
      vehiclesWithLegacy: 0,
      photosWouldCreate: 0,
      photosWouldSkip: 0,
    },
    nextOffset: null,
  }),
  runBackfillForDealership: jest.fn().mockResolvedValue({
    dealershipId: "d1000000-0000-0000-0000-000000000001",
    summary: {
      vehiclesProcessed: 0,
      vehiclesWithLegacy: 0,
      photosCreated: 0,
      photosSkipped: 0,
    },
    nextOffset: null,
  }),
}));

const { getAuthContext, guardAnyPermission } = require("@/lib/api/handler") as {
  getAuthContext: jest.Mock;
  guardAnyPermission: jest.Mock;
};

describe("Admin vehicle photos backfill API", () => {
  const dealerId = "d1000000-0000-0000-0000-000000000001";
  const otherDealerId = "d2000000-0000-0000-0000-000000000002";
  const userId = "d3000000-0000-0000-0000-000000000003";

  beforeEach(() => {
    jest.clearAllMocks();
    getAuthContext.mockResolvedValue({
      userId,
      email: "admin@test.local",
      dealershipId: dealerId,
      permissions: ["admin.roles.write"],
    });
    guardAnyPermission.mockResolvedValue(undefined);
  });

  it("preview returns 403 when user lacks admin permission", async () => {
    guardAnyPermission.mockRejectedValue(new ApiError("FORBIDDEN", "Forbidden"));
    getAuthContext.mockResolvedValue({
      userId,
      email: "sales@test.local",
      dealershipId: dealerId,
      permissions: ["inventory.read"],
    });

    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/preview", {
      method: "POST",
      body: JSON.stringify({ dealershipId: dealerId }),
    });
    const res = await previewPost(req);
    expect(res.status).toBe(403);
  });

  it("apply returns 403 when user lacks admin permission", async () => {
    guardAnyPermission.mockRejectedValue(new ApiError("FORBIDDEN", "Forbidden"));
    getAuthContext.mockResolvedValue({
      userId,
      email: "sales@test.local",
      dealershipId: dealerId,
      permissions: ["inventory.read"],
    });

    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/apply", {
      method: "POST",
      body: JSON.stringify({ dealershipId: dealerId }),
    });
    const res = await applyPost(req);
    expect(res.status).toBe(403);
  });

  it("preview returns 403 when body dealershipId is not session dealership", async () => {
    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/preview", {
      method: "POST",
      body: JSON.stringify({ dealershipId: otherDealerId }),
    });
    const res = await previewPost(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(data.error?.message).toMatch(/own dealership/);
  });

  it("apply returns 403 when body dealershipId is not session dealership", async () => {
    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/apply", {
      method: "POST",
      body: JSON.stringify({ dealershipId: otherDealerId }),
    });
    const res = await applyPost(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });

  it("preview returns 200 and plan when admin and dealershipId matches", async () => {
    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/preview", {
      method: "POST",
      body: JSON.stringify({ dealershipId: dealerId, limitVehicles: 50 }),
    });
    const res = await previewPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dealershipId).toBe(dealerId);
    expect(data.summary).toBeDefined();
  });

  it("preview returns 400 for invalid body (missing dealershipId)", async () => {
    const req = new NextRequest("http://localhost/api/admin/inventory/vehicle-photos/backfill/preview", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await previewPost(req);
    expect(res.status).toBe(400);
  });
});
