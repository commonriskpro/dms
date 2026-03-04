/**
 * Platform RBAC: non-platform user gets 403; guard runs before any DB read.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  platformDealership: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
const PlatformApiErrorClass = vi.hoisted(() => {
  class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  }
  return PlatformApiError;
});
vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ platformAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { GET, POST } from "./route";

describe("Platform API RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when requirePlatformAuth throws (guard runs before dealership lookup)", async () => {
    requirePlatformAuthMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Platform access required", 403)
    );
    const req = new Request("http://localhost/api/platform/dealerships", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
    expect(prismaMock.platformDealership.findMany).not.toHaveBeenCalled();
    expect(prismaMock.platformDealership.count).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    requirePlatformAuthMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/dealerships", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prismaMock.platformDealership.findMany).not.toHaveBeenCalled();
  });

  it("POST returns 403 when user is not PLATFORM_OWNER (guard before DB)", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "user-1" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "PLATFORM_OWNER required", 403)
    );
    const req = new Request("http://localhost/api/platform/dealerships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: "Acme Motors",
        displayName: "Acme",
        planKey: "starter",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(prismaMock.platformDealership.create).not.toHaveBeenCalled();
  });
});
