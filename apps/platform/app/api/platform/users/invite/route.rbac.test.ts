/**
 * Platform users invite: 401 when unauthenticated, 403 for non-OWNER before any Supabase or platform_users lookup.
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

jest.mock("@/lib/platform-invite-service", () => ({
  invitePlatformUserByEmail: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { invitePlatformUserByEmail } from "@/lib/platform-invite-service";
import { POST } from "./route";

describe("POST /api/platform/users/invite RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(requirePlatformRole).not.toHaveBeenCalled();
    expect(invitePlatformUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 403 for non-OWNER before any Supabase or platform_users lookup", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(invitePlatformUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 403 for PLATFORM_COMPLIANCE (not OWNER)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "c-1", role: "PLATFORM_COMPLIANCE" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(invitePlatformUserByEmail).not.toHaveBeenCalled();
  });
});
