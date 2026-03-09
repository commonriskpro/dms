/** @jest-environment node */
/**
 * GET /api/auth/sessions: auth required, returns only own session list (current session).
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
jest.mock("@/lib/sessions", () => ({
  sessionIdFromAccessToken: jest.fn((t: string) => `sid-${t.slice(0, 8)}`),
}));

import { requireUserFromRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sessionIdFromAccessToken } from "@/lib/sessions";
import { GET } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/auth/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
                access_token: "token-abc",
                refresh_token: "ref",
                expires_at: 999999,
                user: { id: "user-1" },
              },
            },
            error: null,
          }),
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (requireUserFromRequest as jest.Mock).mockRejectedValue(
      new (require("@/lib/auth").ApiError)("UNAUTHORIZED", "Not authenticated")
    );
    const req = nextRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with single current session", async () => {
    const req = nextRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].current).toBe(true);
    expect(body.sessions[0].id).toBeDefined();
    expect(sessionIdFromAccessToken).toHaveBeenCalledWith("token-abc");
  });

  it("returns 401 when getSession returns no session", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    });
    const req = nextRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
