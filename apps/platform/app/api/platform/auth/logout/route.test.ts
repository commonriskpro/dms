import { NextRequest } from "next/server";

const signOutMock = jest.fn();
const createSupabaseServerClientMock = jest.fn(async () => ({
  auth: {
    signOut: signOutMock,
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  createPlatformSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

describe("platform auth logout route", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    signOutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("signs out and redirects to login on request origin", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost:3001/api/platform/auth/logout");

    const response = await GET(request);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3001/platform/login");
  });
});
