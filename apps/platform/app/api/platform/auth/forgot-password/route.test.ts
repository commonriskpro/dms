/** @jest-environment node */
/**
 * POST /api/platform/auth/forgot-password: generic success, rate limit, no enumeration.
 */
const mockResetPasswordForEmail = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockIncrementRateLimit = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createPlatformSupabaseServerClient: jest.fn(() =>
    Promise.resolve({ auth: { resetPasswordForEmail: mockResetPasswordForEmail } })
  ),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkPlatformRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getPlatformClientIdentifier: () => "127.0.0.1",
  incrementPlatformRateLimit: (...args: unknown[]) => mockIncrementRateLimit(...args),
}));
jest.mock("@/lib/auth-password-reset", () => ({
  getPlatformPasswordResetRedirectUrl: () => "https://platform.example.com/platform/reset-password",
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));

import { POST } from "./route";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/platform/auth/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(true);
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("returns 200 with generic message for valid email", async () => {
    const res = await POST(nextRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/account exists|receive.*reset/i);
    expect(body.error).toBeUndefined();
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const res = await POST(nextRequest({ email: "user@example.com" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.message).toMatch(/too many|try again/i);
  });

  it("returns 422 for invalid email", async () => {
    const res = await POST(nextRequest({ email: "not-an-email" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});
