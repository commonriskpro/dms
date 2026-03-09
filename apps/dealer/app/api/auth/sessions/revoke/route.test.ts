/** @jest-environment node */
/**
 * POST /api/auth/sessions/revoke: revoke current or revoke all others, rate limit, audit.
 */
jest.mock("@/lib/auth", () => ({
  requireUserFromRequest: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(() => true),
  incrementRateLimit: jest.fn(),
}));
jest.mock("@/lib/sessions", () => ({
  sessionIdFromAccessToken: jest.fn(() => "current-session-id"),
}));

import { requireUserFromRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { POST } from "./route";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/auth/sessions/revoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session: {
                access_token: "token",
                refresh_token: "ref",
                expires_at: 999,
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
    (requireUserFromRequest as jest.Mock).mockRejectedValue(
      new (require("@/lib/auth").ApiError)("UNAUTHORIZED", "Not authenticated")
    );
    const res = await POST(nextRequest({}));
    expect(res.status).toBe(401);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("revokes all others and audits", async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { access_token: "t", refresh_token: "r", expires_at: 999, user: {} } },
            error: null,
          }),
        signOut: mockSignOut,
      },
    });
    const res = await POST(nextRequest({ revokeAllOthers: true }));
    expect(res.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.sessions_revoked_all_others",
        actorUserId: "user-1",
      })
    );
  });

  it("revokes current session when sessionId matches", async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { access_token: "t", refresh_token: "r", expires_at: 999, user: {} } },
            error: null,
          }),
        signOut: mockSignOut,
      },
    });
    const res = await POST(nextRequest({ sessionId: "current-session-id" }));
    expect(res.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledWith();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.session_revoked",
        metadata: expect.objectContaining({ sessionId: "current-session-id" }),
      })
    );
  });

  it("returns 403 when sessionId is not current session", async () => {
    const res = await POST(nextRequest({ sessionId: "other-session-id" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toMatch(/Cannot revoke/);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 429 with safe message when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await POST(nextRequest({ revokeAllOthers: true }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.message).toMatch(/too many|try again/i);
    expect(body.error?.message).not.toMatch(/token|secret|session_id/i);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when body has neither sessionId nor revokeAllOthers", async () => {
    const res = await POST(nextRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});
