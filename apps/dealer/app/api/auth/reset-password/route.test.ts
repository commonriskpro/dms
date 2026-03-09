/** @jest-environment node */
/**
 * POST /api/auth/reset-password: recovery session required, password policy, audit, generic errors.
 */
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));

import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { POST } from "./route";

const validPassword = "SecurePass123!";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 and audits when session valid and password valid", async () => {
    const mockUpdateUser = jest.fn().mockResolvedValue({ data: { user: {} }, error: null });
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session: {
                user: { id: "user-uuid" },
                access_token: "x",
                refresh_token: "y",
              },
            },
            error: null,
          }),
        updateUser: mockUpdateUser,
      },
    });
    const req = nextRequest({ password: validPassword, confirmPassword: validPassword });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/updated|sign in/i);
    expect(body.error).toBeUndefined();
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: validPassword });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.password_reset_completed",
        entity: "Auth",
        actorUserId: "user-uuid",
        dealershipId: null,
      })
    );
  });

  it("returns 401 with generic message when no session", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        updateUser: jest.fn(),
      },
    });
    const req = nextRequest({ password: validPassword, confirmPassword: validPassword });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(body.error?.message).toMatch(/expired|already used/i);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 401 with generic message when updateUser fails (expired link)", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session: {
                user: { id: "user-uuid" },
                access_token: "x",
                refresh_token: "y",
              },
            },
            error: null,
          }),
        updateUser: () => Promise.resolve({ data: {}, error: { message: "Token expired" } }),
      },
    });
    const req = nextRequest({ password: validPassword, confirmPassword: validPassword });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(body.error?.message).toMatch(/expired|already used/i);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when password does not meet policy", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u" } } }, error: null }) },
    });
    const req = nextRequest({ password: "short", confirmPassword: "short" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when password and confirmPassword do not match", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u" } } }, error: null }) },
    });
    const req = nextRequest({ password: validPassword, confirmPassword: "OtherPass123!" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toMatch(/do not match/i);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = {
      json: () => Promise.reject(new Error("Invalid JSON")),
      headers: new Headers(),
    } as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});
