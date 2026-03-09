/** @jest-environment node */

jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  handleApiError: jest.fn((error: unknown) => {
    const err = error as { code?: string };
    if (err?.code === "FORBIDDEN") {
      return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    }
    return Response.json({ error: { code: "INTERNAL_SERVER_ERROR" } }, { status: 500 });
  }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/modules/inventory/service/listings", () => ({
  listVehicleListings: jest.fn(),
}));

import { ApiError } from "@/lib/auth";
import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { listVehicleListings } from "@/modules/inventory/service/listings";
import { GET } from "./route";

const ctx = {
  userId: "660e8400-e29b-41d4-a716-446655440000",
  email: "inventory@test.local",
  dealershipId: "550e8400-e29b-41d4-a716-446655440000",
  permissions: ["inventory.read"],
};

describe("GET /api/inventory/[id]/listings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (listVehicleListings as jest.Mock).mockResolvedValue([
      {
        id: "listing-1",
        vehicleId: "vehicle-1",
        platform: "WEBSITE",
        status: "PUBLISHED",
        externalListingId: "ext-1",
        lastSyncedAt: new Date("2026-03-09T12:00:00.000Z"),
        createdAt: new Date("2026-03-09T10:00:00.000Z"),
        updatedAt: new Date("2026-03-09T11:00:00.000Z"),
      },
    ]);
  });

  it("requires inventory.read", async () => {
    const response = await GET(
      new Request("http://localhost/api/inventory/vehicle-1/listings") as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "vehicle-1" }) }
    );

    expect(response.status).toBe(200);
    expect(guardPermission).toHaveBeenCalledWith(ctx, "inventory.read");
    expect(listVehicleListings).toHaveBeenCalledWith(ctx.dealershipId, "vehicle-1");
  });

  it("returns 403 when permission check fails", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));

    const response = await GET(
      new Request("http://localhost/api/inventory/vehicle-1/listings") as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "vehicle-1" }) }
    );

    expect(response.status).toBe(403);
    expect(listVehicleListings).not.toHaveBeenCalled();
  });
});
