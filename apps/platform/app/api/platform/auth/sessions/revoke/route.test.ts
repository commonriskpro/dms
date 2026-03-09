/** @jest-environment node */
/**
 * POST /api/platform/auth/sessions/revoke: auth required, rate limit, revoke all others.
 */
jest.mock("@/lib/platform-auth", () => ({
  ...jest.requireActual("@/lib/platform-auth"),
  requirePlatformAuth: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createPlatformSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkPlatformRateLimit: jest.fn(() => true),
  incrementPlatformRateLimit: jest.fn(),
}));
jest.mock("@/lib/sessions", () => ({
  platformSessionIdFromAccessToken: jest.fn(() => "current-session-id"),
}));

import { requirePlatformAuth } from "@/lib/platform-auth";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { checkPlatformRateLimit } from "@/lib/rate-limit";
import { platformAuditLog } from "@/lib/audit";
import { POST } from "./route";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/platform/auth/sessions/revoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (checkPlatformRateLimit as jest.Mock).mockReturnValue(true);
    (createPlatformSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session: {
                access_token: "t",
                refresh_token: "r",
                user: { id: "user-1" },
              },
            },
            error: null,
          }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const { PlatformApiError } = await import("@/lib/platform-auth");
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const res = await POST(nextRequest({ revokeAllOthers: true }));
    expect(res.status).toBe(401);
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    (checkPlatformRateLimit as jest.Mock).mockReturnValue(false);
    const res = await POST(nextRequest({ revokeAllOthers: true }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("revokes all others and returns 200", async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    (createPlatformSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { access_token: "t", refresh_token: "r", user: {} } },
            error: null,
          }),
        signOut: mockSignOut,
      },
    });
    const res = await POST(nextRequest({ revokeAllOthers: true }));
    expect(res.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.sessions_revoked_all_others",
      })
    );
  });
});
