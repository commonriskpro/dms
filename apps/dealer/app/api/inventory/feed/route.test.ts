/**
 * Route tests for GET /api/inventory/feed:
 * - RBAC: guardPermission(inventory.read) → 403 when missing.
 * - Validation: invalid format or limit → 400.
 * - Uses ctx.dealershipId for cache key and buildFeed.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/integrations/service/marketplace", () => ({
  buildFeed: jest.fn(),
}));

jest.mock("@/lib/infrastructure/cache/cacheHelpers", () => ({
  withCache: jest.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import * as marketplaceService from "@/modules/integrations/service/marketplace";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read"],
};

describe("GET /api/inventory/feed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (marketplaceService.buildFeed as jest.Mock).mockResolvedValue({ items: [], format: "facebook" });
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/feed?format=facebook"),
    } as unknown as NextRequest;
    const res = await GET(request);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(marketplaceService.buildFeed).not.toHaveBeenCalled();
  });

  it("returns 400 when format is invalid", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/feed?format=invalid"),
    } as unknown as NextRequest;
    const res = await GET(request);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(marketplaceService.buildFeed).not.toHaveBeenCalled();
  });

  it("returns 400 when limit is out of range", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/feed?format=facebook&limit=9999"),
    } as unknown as NextRequest;
    const res = await GET(request);
    expect(res.status).toBe(400);
    expect(marketplaceService.buildFeed).not.toHaveBeenCalled();
  });

  it("returns 200 and calls buildFeed with ctx.dealershipId when valid", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/inventory/feed?format=autotrader&limit=50"),
    } as unknown as NextRequest;
    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(marketplaceService.buildFeed).toHaveBeenCalledWith(ctx.dealershipId, "autotrader", {
      limit: 50,
    });
    const data = await res.json();
    expect(data.data?.items).toEqual([]);
    expect(data.data?.format).toBe("facebook");
    expect(data.meta?.format).toBe("autotrader");
  });
});
