/**
 * Platform RBAC: non-owner calling provision returns 403 before any dealership lookup.
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
    platformDealership: { findUnique: jest.fn(), update: jest.fn() },
    dealershipMapping: { create: jest.fn() },
  },
}));
jest.mock("@/lib/call-dealer-internal", () => ({ callDealerProvision: jest.fn() }));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { POST } from "./route";

describe("Platform POST provision RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when non-owner calls provision (guard before dealership lookup)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ id: "user-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });
    const req = new Request("http://localhost/api/platform/dealerships/deal-1/provision", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "key-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "deal-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
    expect(prisma.platformDealership.findUnique).not.toHaveBeenCalled();
  });
});
