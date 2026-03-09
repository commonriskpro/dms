/**
 * GET/POST /api/vendors:
 * - GET requires inventory.read; returns list and meta.
 * - POST requires inventory.write; 201 with created vendor.
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
  listVendors: jest.fn(),
  createVendor: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, POST } from "./route";
import * as vendorService from "@/modules/vendors/service/vendor";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

const mockVendor = {
  id: "a1000000-0000-0000-0000-000000000001",
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

describe("GET /api/vendors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.listVendors as jest.Mock).mockResolvedValue({
      data: [mockVendor],
      total: 1,
    });
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {
      nextUrl: new URL("http://localhost/api/vendors"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(vendorService.listVendors).not.toHaveBeenCalled();
  });

  it("returns 200 with data and meta from listVendors", async () => {
    const req = {
      nextUrl: new URL("http://localhost/api/vendors"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe(mockVendor.name);
    expect(body.meta).toBeDefined();
    expect(body.meta.total).toBe(1);
    expect(vendorService.listVendors).toHaveBeenCalledWith(
      ctx.dealershipId,
      expect.objectContaining({ limit: 25, offset: 0 })
    );
  });
});

describe("POST /api/vendors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (vendorService.createVendor as jest.Mock).mockResolvedValue(mockVendor);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {
      json: () =>
        Promise.resolve({ name: "New Vendor", type: "other" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(vendorService.createVendor).not.toHaveBeenCalled();
  });

  it("returns 201 with created vendor when body is valid", async () => {
    const req = {
      json: () =>
        Promise.resolve({
          name: "New Vendor",
          type: "transporter",
          isActive: true,
        }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe(mockVendor.id);
    expect(body.data.name).toBe(mockVendor.name);
    expect(vendorService.createVendor).toHaveBeenCalledWith(
      ctx.dealershipId,
      ctx.userId,
      expect.objectContaining({ name: "New Vendor", type: "transporter" }),
      expect.anything()
    );
  });
});
