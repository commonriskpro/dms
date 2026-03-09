/** @jest-environment node */
/**
 * POST /api/auth/verify-email/resend: auth required, rate limit, audit, generic message.
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
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
  incrementRateLimit: jest.fn(),
}));

import { requireUserFromRequest, ApiError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { POST } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

const mockResend = jest.fn().mockResolvedValue({ data: {}, error: null });

describe("POST /api/auth/verify-email/resend", () => {
  beforeEach(() => {
    (auditLog as jest.Mock).mockClear();
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { resend: mockResend },
    });
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });
  it("returns 200 with generic message when authenticated", async () => {
    const req = nextRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
    expect(body.error).toBeUndefined();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.email_verification_resent",
        entity: "Auth",
        actorUserId: "user-1",
        dealershipId: null,
      })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    (requireUserFromRequest as jest.Mock).mockRejectedValue(
      new ApiError("UNAUTHORIZED", "Not authenticated")
    );
    const req = nextRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit exceeded", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const req = nextRequest();
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("invokes resend with type signup and user email", async () => {
    const req = nextRequest();
    await POST(req);
    expect(createClient).toHaveBeenCalled();
    expect(mockResend).toHaveBeenCalled();
    expect(mockResend).toHaveBeenLastCalledWith({
      type: "signup",
      email: "user@example.com",
    });
  });
});
