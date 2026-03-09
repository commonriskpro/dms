/** @jest-environment node */
/**
 * POST /api/platform/auth/verify-email/resend: auth required, rate limit, generic message.
 */
jest.mock("@/lib/platform-auth", () => ({
  ...jest.requireActual("@/lib/platform-auth"),
  requirePlatformAuth: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createPlatformSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkPlatformRateLimit: jest.fn(() => true),
  getPlatformClientIdentifier: () => "127.0.0.1",
  incrementPlatformRateLimit: jest.fn(),
}));

import { requirePlatformAuth } from "@/lib/platform-auth";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { checkPlatformRateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

describe("POST /api/platform/auth/verify-email/resend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (checkPlatformRateLimit as jest.Mock).mockReturnValue(true);
    (createPlatformSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: "user-1", email: "user@example.com" } },
            error: null,
          }),
        resend: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    });
  });

  it("returns 200 with generic message when authenticated", async () => {
    const res = await POST(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/verification|link/i);
    expect(body.error).toBeUndefined();
  });

  it("returns 401 when unauthenticated", async () => {
    const { PlatformApiError } = await import("@/lib/platform-auth");
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const res = await POST(nextRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 429 when rate limit exceeded", async () => {
    (checkPlatformRateLimit as jest.Mock).mockReturnValue(false);
    const res = await POST(nextRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
  });
});
