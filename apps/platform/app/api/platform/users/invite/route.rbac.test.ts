/**
 * Platform users invite: 401 when unauthenticated, 403 for non-OWNER before any Supabase or platform_users lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
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

const invitePlatformUserByEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform-invite-service", () => ({
  invitePlatformUserByEmail: invitePlatformUserByEmailMock,
}));

import { POST } from "./route";

describe("POST /api/platform/users/invite RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePlatformAuthMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(requirePlatformRoleMock).not.toHaveBeenCalled();
    expect(invitePlatformUserByEmailMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-OWNER before any Supabase or platform_users lookup", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(invitePlatformUserByEmailMock).not.toHaveBeenCalled();
  });

  it("returns 403 for PLATFORM_COMPLIANCE (not OWNER)", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "c-1", role: "PLATFORM_COMPLIANCE" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(invitePlatformUserByEmailMock).not.toHaveBeenCalled();
  });
});
