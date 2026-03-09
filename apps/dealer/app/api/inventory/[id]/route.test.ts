/**
 * Route tests for GET/PATCH/DELETE /api/inventory/[id]:
 * - Invalid UUID id returns 400.
 * - RBAC denial (guardPermission throws) returns 403.
 */
jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { statusCode?: number; code?: string; message?: string };
    return Response.json(
      { error: { code: err.code ?? "ERROR", message: err.message ?? "Error" } },
      { status: err.statusCode ?? 500 }
    );
  }),
  jsonResponse: jest.fn((body: unknown) => Response.json(body)),
  getRequestMeta: jest.fn(() => ({})),
}));

jest.mock("@/modules/inventory/service/vehicle", () => ({
  getVehicle: jest.fn(),
  listVehiclePhotos: jest.fn().mockResolvedValue([]),
  updateVehicle: jest.fn(),
  deleteVehicle: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = "ApiError";
      this.statusCode = code === "FORBIDDEN" ? 403 : 500;
    }
  },
}));

jest.mock("@/modules/inventory/service/price-to-market", () => ({
  getPriceToMarketForVehicle: jest.fn().mockResolvedValue({
    marketStatus: "At Market",
    marketDeltaCents: 0,
    marketDeltaPercent: 0,
    sourceLabel: "Internal comps",
  }),
  computeDaysInStock: jest.fn().mockReturnValue(30),
  agingBucketFromDays: jest.fn().mockReturnValue("30-60"),
  turnRiskStatus: jest.fn().mockReturnValue("good"),
  DAYS_TO_TURN_TARGET: 45,
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, PATCH, DELETE } from "./route";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

function makeGetRequest(id: string): { request: NextRequest; params: Promise<{ id: string }> } {
  return {
    request: { nextUrl: new URL("http://localhost/api/inventory/" + id), headers: new Headers() } as unknown as NextRequest,
    params: Promise.resolve({ id }),
  };
}

describe("GET /api/inventory/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({
      id: idValid,
      stockNumber: "S1",
      status: "AVAILABLE",
      make: "Make",
      model: "Model",
      salePriceCents: BigInt(1000000),
      createdAt: new Date(),
    });
  });

  const idValid = "e1000000-0000-0000-0000-000000000001";

  it("returns 400 when id is not a valid UUID", async () => {
    const { request, params } = makeGetRequest("not-a-uuid");
    const res = await GET(request, { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBeDefined();
    expect(inventoryService.getVehicle).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const { request, params } = makeGetRequest(idValid);
    const res = await GET(request, { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });
});

describe("PATCH /api/inventory/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  const idValid = "e1000000-0000-0000-0000-000000000001";

  it("returns 400 when id is not a valid UUID", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/not-a-uuid"),
      headers: new Headers(),
      json: () => Promise.resolve({ stockNumber: "S2" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
    expect(inventoryService.updateVehicle).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/" + idValid),
      headers: new Headers(),
      json: () => Promise.resolve({ stockNumber: "S2" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/inventory/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.deleteVehicle as jest.Mock).mockResolvedValue({});
  });

  const idValid = "e1000000-0000-0000-0000-000000000001";

  it("returns 400 when id is not a valid UUID", async () => {
    const request = { nextUrl: new URL("http://localhost/api/inventory/not-a-uuid"), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(400);
    expect(inventoryService.deleteVehicle).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = { nextUrl: new URL("http://localhost/api/inventory/" + idValid), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(403);
  });
});
