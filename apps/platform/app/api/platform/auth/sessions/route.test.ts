/** @jest-environment node */
/**
 * GET /api/platform/auth/sessions: auth required, returns current session only.
 */
const { PlatformApiError } = jest.requireActual<typeof import("@/lib/platform-auth")>("@/lib/platform-auth");
jest.mock("@/lib/platform-auth", () => ({
  ...jest.requireActual("@/lib/platform-auth"),
  requirePlatformAuth: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createPlatformSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/sessions", () => ({
  platformSessionIdFromAccessToken: jest.fn((t: string) => `sid-${t.slice(0, 8)}`),
}));

import { requirePlatformAuth } from "@/lib/platform-auth";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/platform/auth/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (createPlatformSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session: {
                access_token: "token-abc",
                refresh_token: "ref",
                user: { id: "user-1" },
              },
            },
            error: null,
          }),
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const res = await GET(nextRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with single current session when authenticated", async () => {
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].current).toBe(true);
    expect(body.sessions[0].id).toBeDefined();
  });
});
