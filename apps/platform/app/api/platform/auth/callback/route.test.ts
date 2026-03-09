import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = jest.fn();
const createSupabaseServerClientMock = jest.fn(async () => ({
  auth: {
    exchangeCodeForSession: exchangeCodeForSessionMock,
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  createPlatformSupabaseServerClient: (options: unknown) => createSupabaseServerClientMock(options),
}));

describe("platform auth callback route", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("sanitizes external next redirect to /platform", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(
      "http://localhost:3001/api/platform/auth/callback?code=test-code&next=https://evil.test"
    );

    const response = await GET(request);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3001/platform");
  });

  it("keeps safe internal next redirect", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(
      "http://localhost:3001/api/platform/auth/callback?code=test-code&next=/platform/users"
    );

    const response = await GET(request);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3001/platform/users");
  });

  it("redirects to login with generic error when code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: { message: "invalid_grant" } });
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost:3001/api/platform/auth/callback?code=bad");

    const response = await GET(request);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/platform/login?error=invalid_link"
    );
  });
});
