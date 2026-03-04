/**
 * Platform RBAC: non-platform user gets 403; guard runs before any DB read.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformDealership: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn().mockResolvedValue(undefined) }));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "./route";

describe("Platform API RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when requirePlatformAuth throws (guard runs before dealership lookup)", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Platform access required", 403)
    );
    const req = new Request("http://localhost/api/platform/dealerships", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
    expect(prisma.platformDealership.findMany).not.toHaveBeenCalled();
    expect(prisma.platformDealership.count).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/dealerships", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prisma.platformDealership.findMany).not.toHaveBeenCalled();
  });

  it("POST returns 403 when user is not PLATFORM_OWNER (guard before DB)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "PLATFORM_OWNER required", 403)
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
    expect(prisma.platformDealership.create).not.toHaveBeenCalled();
  });
});
