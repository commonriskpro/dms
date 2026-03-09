/**
 * GET/PATCH/DELETE /api/vendors/[id]:
 * - GET requires inventory.read; 404 when not found; 200 with vendor.
 * - PATCH/DELETE require inventory.write; 404 when not found; 200 with updated vendor.
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

jest.mock("@/modules/vendors/service/vendor", () => ({
  getVendor: jest.fn(),
  updateVendor: jest.fn(),
  deleteVendor: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, PATCH, DELETE } from "./route";
import * as vendorService from "@/modules/vendors/service/vendor";
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
  contactName: null,
  phone: null,
  email: null,
  address: null,
  notes: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  deletedBy: null,
};

describe("GET /api/vendors/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.getVendor as jest.Mock).mockResolvedValue(mockVendor);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(403);
    expect(vendorService.getVendor).not.toHaveBeenCalled();
  });

  it("returns 404 when vendor not found", async () => {
    (vendorService.getVendor as jest.Mock).mockResolvedValue(null);
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(404);
    expect(vendorService.getVendor).toHaveBeenCalledWith(ctx.dealershipId, vendorId);
  });

  it("returns 200 with vendor when found", async () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(vendorId);
    expect(body.data.name).toBe(mockVendor.name);
  });
});

describe("PATCH /api/vendors/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.updateVendor as jest.Mock).mockResolvedValue({
      ...mockVendor,
      name: "Updated Name",
    });
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {
      json: () => Promise.resolve({ name: "Updated Name" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(403);
    expect(vendorService.updateVendor).not.toHaveBeenCalled();
  });

  it("returns 200 with updated vendor", async () => {
    const req = {
      json: () => Promise.resolve({ name: "Updated Name" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Updated Name");
    expect(vendorService.updateVendor).toHaveBeenCalledWith(
      ctx.dealershipId,
      ctx.userId,
      vendorId,
      expect.objectContaining({ name: "Updated Name" }),
      expect.anything()
    );
  });
});

describe("DELETE /api/vendors/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.deleteVendor as jest.Mock).mockResolvedValue({
      ...mockVendor,
      deletedAt: new Date(),
      deletedBy: ctx.userId,
    });
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(403);
    expect(vendorService.deleteVendor).not.toHaveBeenCalled();
  });

  it("returns 200 with soft-deleted vendor", async () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vendorId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(vendorId);
    expect(vendorService.deleteVendor).toHaveBeenCalledWith(
      ctx.dealershipId,
      ctx.userId,
      vendorId,
      expect.anything()
    );
  });
});
