import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("GET /platform/dev-login", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalHeaderAuth = process.env.PLATFORM_USE_HEADER_AUTH;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PLATFORM_USE_HEADER_AUTH = originalHeaderAuth;
    vi.resetModules();
  });

  it("returns 404 when NODE_ENV is production (dev-login disabled)", async () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_USE_HEADER_AUTH = "true"; // still disabled because production
    vi.resetModules();
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/platform/dev-login?userId=00000000-0000-4000-8000-000000000001");
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not available");
  });

  it("returns 404 when PLATFORM_USE_HEADER_AUTH is not set (dev-login disabled)", async () => {
    process.env.NODE_ENV = "development";
    process.env.PLATFORM_USE_HEADER_AUTH = undefined;
    vi.resetModules();
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/platform/dev-login?userId=00000000-0000-4000-8000-000000000001");
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not available");
  });
});
