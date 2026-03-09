/**
 * GET/POST /api/inventory/[id]/cost-documents:
 * - GET requires inventory.read and documents.read; returns list.
 * - POST requires inventory.write and documents.write; 400 when file missing.
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

jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIdentifier: jest.fn().mockReturnValue("client-1"),
}));

jest.mock("@/modules/inventory/service/vehicle", () => ({ getVehicle: jest.fn() }));
jest.mock("@/modules/inventory/service/cost-ledger", () => ({
  listCostDocuments: jest.fn(),
  getCostEntry: jest.fn(),
  createCostDocument: jest.fn(),
}));
jest.mock("@/modules/core-platform/service/file", () => ({
  uploadFile: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, POST } from "./route";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "documents.read", "inventory.write", "documents.write"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";

describe("GET /api/inventory/[id]/cost-documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({ id: vehicleId });
    (costLedger.listCostDocuments as jest.Mock).mockResolvedValue([]);
  });

  it("returns 403 when guardPermission throws (e.g. missing documents.read)", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
    expect(costLedger.listCostDocuments).not.toHaveBeenCalled();
  });

  it("returns 200 with data array from listCostDocuments", async () => {
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(costLedger.listCostDocuments).toHaveBeenCalledWith(ctx.dealershipId, vehicleId);
  });
});

describe("POST /api/inventory/[id]/cost-documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inventoryService.getVehicle as jest.Mock).mockResolvedValue({ id: vehicleId });
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const formData = new FormData();
    formData.set("kind", "invoice");
    const req = {
      formData: () => Promise.resolve(formData),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when file is missing", async () => {
    const formData = new FormData();
    formData.set("kind", "invoice");
    const req = {
      formData: () => Promise.resolve(formData),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.message).toMatch(/missing|file/i);
  });
});
