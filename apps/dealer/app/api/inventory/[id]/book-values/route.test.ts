/**
 * GET/POST /api/inventory/[id]/book-values:
 * - GET requires inventory.read (403 when missing).
 * - POST requires inventory.write (403 when missing).
 * - POST with negative cents returns 400 validation error.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  incrementRateLimit: jest.fn(),
}));
jest.mock("@/modules/inventory/service/book-values", () => ({
  getBookValues: jest.fn(),
  upsertBookValues: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, POST } from "./route";
import * as bookValuesService from "@/modules/inventory/service/book-values";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";

describe("GET /api/inventory/[id]/book-values", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (bookValuesService.getBookValues as jest.Mock).mockResolvedValue({ vehicleId, bookValues: null });
  });

  it("returns 403 when guardPermission throws (no inventory.read)", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 with data when service returns", async () => {
    (bookValuesService.getBookValues as jest.Mock).mockResolvedValue({
      vehicleId,
      bookValues: { retailCents: 10000, source: "MANUAL", updatedAt: new Date() },
    });
    const req = { nextUrl: new URL("http://localhost"), headers: new Headers() } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.vehicleId).toBe(vehicleId);
    expect(data.data?.bookValues?.retailCents).toBe(10000);
  });
});

describe("POST /api/inventory/[id]/book-values", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (bookValuesService.upsertBookValues as jest.Mock).mockResolvedValue({ vehicleId, bookValues: {} });
  });

  it("returns 403 when guardPermission throws (no inventory.write)", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = {
      json: () => Promise.resolve({ retailCents: 10000 }),
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body has negative retailCents", async () => {
    const req = {
      json: () => Promise.resolve({ retailCents: -100 }),
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBeDefined();
    expect(bookValuesService.upsertBookValues).not.toHaveBeenCalled();
  });
});
