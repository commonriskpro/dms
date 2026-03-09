/** @jest-environment node */
/**
 * POST /api/auth/forgot-password: generic success, rate limit, audit, no enumeration.
 */
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
  checkRateLimitPasswordResetByEmail: jest.fn(),
  incrementRateLimitPasswordResetByEmail: jest.fn(),
  incrementRateLimit: jest.fn(),
}));
jest.mock("@/lib/auth-password-reset", () => ({
  getPasswordResetRedirectUrl: () => "https://app.example.com/reset-password",
}));

import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import {
  checkRateLimit,
  checkRateLimitPasswordResetByEmail,
  incrementRateLimitPasswordResetByEmail,
  incrementRateLimit,
} from "@/lib/api/rate-limit";
import { POST } from "./route";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
    (checkRateLimitPasswordResetByEmail as jest.Mock).mockReturnValue(true);
    const mockAuth = {
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };
    (createClient as jest.Mock).mockResolvedValue({ auth: mockAuth });
  });

  it("returns 200 with generic message for valid email", async () => {
    const req = nextRequest({ email: "user@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/account exists|receive.*reset/i);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.password_reset_requested",
        entity: "Auth",
        dealershipId: null,
        actorUserId: null,
      })
    );
    expect(body.error).toBeUndefined();
  });

  it("returns same 200 for unknown email (no enumeration)", async () => {
    const req = nextRequest({ email: "nobody@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
    expect(body.error).toBeUndefined();
  });

  it("returns 429 with safe message when IP rate limit exceeded", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const req = nextRequest({ email: "user@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.message).toMatch(/too many|try again/i);
    expect(body.error?.message).not.toMatch(/email|account|exist/i);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 429 when per-email rate limit exceeded", async () => {
    (checkRateLimitPasswordResetByEmail as jest.Mock).mockReturnValue(false);
    const req = nextRequest({ email: "user@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid email format", async () => {
    const req = nextRequest({ email: "not-an-email" });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for missing email", async () => {
    const req = nextRequest({});
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("calls Supabase resetPasswordForEmail with redirectTo", async () => {
    const mockReset = jest.fn().mockResolvedValue({ data: {}, error: null });
    (createClient as jest.Mock).mockResolvedValue({ auth: { resetPasswordForEmail: mockReset } });
    const req = nextRequest({ email: "u@example.com" });
    await POST(req);
    expect(mockReset).toHaveBeenCalledWith(
      "u@example.com",
      expect.objectContaining({ redirectTo: "https://app.example.com/reset-password" })
    );
  });

  it("increments rate limits and audits on success", async () => {
    const req = nextRequest({ email: "user@example.com" });
    await POST(req);
    expect(incrementRateLimit).toHaveBeenCalled();
    expect(incrementRateLimitPasswordResetByEmail).toHaveBeenCalledWith("user@example.com");
    expect(auditLog).toHaveBeenCalled();
  });
});
