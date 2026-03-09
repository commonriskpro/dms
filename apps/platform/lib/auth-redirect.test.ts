const warnMock = jest.fn();

jest.mock("./logger", () => ({
  logger: {
    warn: (...args: unknown[]) => warnMock(...args),
  },
}));

describe("auth redirect helpers", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    warnMock.mockReset();
    jest.resetModules();
  });

  it("prefers request origin and warns when NEXT_PUBLIC_APP_URL mismatches", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const { getValidatedAppBaseUrl } = await import("./auth-redirect");
    const base = getValidatedAppBaseUrl({
      nextUrl: { origin: "http://localhost:3001" },
    } as never);

    expect(base).toBe("http://localhost:3001");
    expect(warnMock).toHaveBeenCalled();
  });

  it("returns env origin when request origin is unavailable", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://platform.example.com";
    const { getValidatedAppBaseUrl } = await import("./auth-redirect");
    const base = getValidatedAppBaseUrl({
      nextUrl: { origin: "" },
    } as never);

    expect(base).toBe("https://platform.example.com");
  });

  it("rejects unsafe next paths and keeps safe internal paths", async () => {
    const { getSafeInternalRedirectPath } = await import("./auth-redirect");

    expect(getSafeInternalRedirectPath("/platform/users")).toBe("/platform/users");
    expect(getSafeInternalRedirectPath("https://evil.test")).toBe("/platform");
    expect(getSafeInternalRedirectPath("//evil.test")).toBe("/platform");
    expect(getSafeInternalRedirectPath(null)).toBe("/platform");
  });
});
