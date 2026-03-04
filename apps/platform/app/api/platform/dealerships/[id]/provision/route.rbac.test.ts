/**
 * Platform RBAC: non-owner calling provision returns 403 before any dealership lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  platformDealership: { findUnique: vi.fn(), update: vi.fn() },
  dealershipMapping: { create: vi.fn() },
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
vi.mock("@/lib/call-dealer-internal", () => ({ callDealerProvision: vi.fn() }));
vi.mock("@/lib/audit", () => ({ platformAuditLog: vi.fn() }));

import { POST } from "./route";

describe("Platform POST provision RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when non-owner calls provision (guard before dealership lookup)", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ id: "user-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockImplementationOnce(() => {
      throw new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403);
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
    expect(prismaMock.platformDealership.findUnique).not.toHaveBeenCalled();
  });
});
