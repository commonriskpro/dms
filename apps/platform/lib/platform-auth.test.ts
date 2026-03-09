/**
 * requirePlatformAuth: 401 when unauthed, 403 when authed but not in platform_users, ok when in platform_users.
 */
const mockGetUser = jest.fn();
const createSupabaseServerMock = jest.fn(() => ({
  auth: { getUser: mockGetUser },
}));
const prismaFindUniqueMock = jest.fn();

jest.mock("react", () => ({
  cache: (fn: (id: string) => Promise<unknown>) => fn,
}));
jest.mock("./supabase/server", () => ({
  createPlatformSupabaseServerClient: createSupabaseServerMock,
}));
jest.mock("./db", () => ({
  prisma: {
    platformUser: {
      findUnique: prismaFindUniqueMock,
    },
  },
}));

describe("requirePlatformAuth", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_USE_HEADER_AUTH = undefined;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("throws 401 when no Supabase user (unauthenticated)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { requirePlatformAuth, PlatformApiError } = await import("./platform-auth");
    await expect(requirePlatformAuth()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Not authenticated",
    });
    expect(prismaFindUniqueMock).not.toHaveBeenCalled();
  });

  it("throws 403 when Supabase user exists but not in platform_users", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-123" } },
      error: null,
    });
    prismaFindUniqueMock.mockResolvedValueOnce(null);
    const { requirePlatformAuth } = await import("./platform-auth");
    await expect(requirePlatformAuth()).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Not authorized",
    });
    expect(prismaFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "auth-user-123" },
      select: { id: true, role: true, disabledAt: true },
    });
  });

  it("throws 403 when platform user is disabled (disabledAt set)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-disabled" } },
      error: null,
    });
    prismaFindUniqueMock.mockResolvedValueOnce({
      id: "auth-user-disabled",
      role: "PLATFORM_SUPPORT",
      disabledAt: new Date(),
    });
    const { requirePlatformAuth } = await import("./platform-auth");
    await expect(requirePlatformAuth()).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Not authorized",
    });
  });

  it("returns user when Supabase user exists and in platform_users (not disabled)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-456" } },
      error: null,
    });
    prismaFindUniqueMock.mockResolvedValueOnce({
      id: "auth-user-456",
      role: "PLATFORM_OWNER",
      disabledAt: null,
    });
    const { requirePlatformAuth } = await import("./platform-auth");
    const user = await requirePlatformAuth();
    expect(user).toEqual({ userId: "auth-user-456", role: "PLATFORM_OWNER" });
    expect(prismaFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "auth-user-456" },
      select: { id: true, role: true, disabledAt: true },
    });
  });
});

describe("getPlatformUserIdFromRequest", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalHeaderAuth = process.env.PLATFORM_USE_HEADER_AUTH;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.PLATFORM_USE_HEADER_AUTH = originalHeaderAuth;
    jest.resetModules();
  });

  it("returns null in production when Supabase has no user (X-Platform-User-Id header is not used)", async () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_USE_HEADER_AUTH = "true"; // misconfigured: header must still be ignored
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { getPlatformUserIdFromRequest } = await import("./platform-auth");
    const userId = await getPlatformUserIdFromRequest();
    expect(userId).toBeNull();
  });

  it("returns null in production when PLATFORM_USE_HEADER_AUTH is unset and Supabase has no user", async () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_USE_HEADER_AUTH = undefined;
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { getPlatformUserIdFromRequest } = await import("./platform-auth");
    const userId = await getPlatformUserIdFromRequest();
    expect(userId).toBeNull();
  });

  it("returns Supabase user id in development when header auth is disabled", async () => {
    process.env.NODE_ENV = "development";
    process.env.PLATFORM_USE_HEADER_AUTH = undefined;
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "dev-supabase-user-1" } },
      error: null,
    });
    const { getPlatformUserIdFromRequest } = await import("./platform-auth");
    const userId = await getPlatformUserIdFromRequest();
    expect(userId).toBe("dev-supabase-user-1");
  });

  it("returns null in development when header auth is disabled and no Supabase user exists", async () => {
    process.env.NODE_ENV = "development";
    process.env.PLATFORM_USE_HEADER_AUTH = undefined;
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { getPlatformUserIdFromRequest } = await import("./platform-auth");
    const userId = await getPlatformUserIdFromRequest();
    expect(userId).toBeNull();
  });
});
