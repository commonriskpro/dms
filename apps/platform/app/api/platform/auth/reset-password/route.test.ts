/** @jest-environment node */
/**
 * POST /api/platform/auth/reset-password: generic invalid/expired message, auth required.
 */
const mockGetSession = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createPlatformSupabaseServerClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getSession: mockGetSession,
        updateUser: mockUpdateUser,
      },
    })
  ),
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));

import { POST } from "./route";

const validPassword = "SecurePass123!";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/platform/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
          access_token: "x",
          refresh_token: "y",
        },
      },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("returns 200 when session valid and password valid", async () => {
    const res = await POST(nextRequest({ password: validPassword, confirmPassword: validPassword }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/updated|sign in/i);
    expect(body.error).toBeUndefined();
  });

  it("returns 401 with generic message when no session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const res = await POST(nextRequest({ password: validPassword, confirmPassword: validPassword }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(body.error?.message).toMatch(/expired|already used/i);
  });
});
