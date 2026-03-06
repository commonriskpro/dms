/**
 * Dealer-health proxy: 401 when unauthenticated; 200 with sanitized body when ok; 502 on upstream error.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { GET } from "./route";

describe("dealer-health proxy", () => {
  const baseEnv = process.env.DEALER_INTERNAL_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEALER_INTERNAL_API_URL = "https://dealer.example.com";
  });

  afterEach(() => {
    process.env.DEALER_INTERNAL_API_URL = baseEnv;
  });

  it("returns 401 when unauthenticated", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/monitoring/dealer-health");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 200 with sanitized body when upstream returns 200", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          app: "dealer",
          version: "abc123",
          time: "2025-01-01T00:00:00.000Z",
          db: "ok",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const req = new Request("http://localhost/api/platform/monitoring/dealer-health");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.app).toBe("dealer");
    expect(json.version).toBe("abc123");
    expect(json.time).toBe("2025-01-01T00:00:00.000Z");
    expect(json.db).toBe("ok");
    expect(json.upstreamStatus).toBe(200);
    expect(json).not.toHaveProperty("missingVars");
    expect(json).not.toHaveProperty("dbError");
  });

  it("returns 502 with safe body when upstream returns 503", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, db: "error", dbError: "Connection refused" }),
        { status: 503 }
      )
    );
    const req = new Request("http://localhost/api/platform/monitoring/dealer-health");
    const res = await GET(req);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.upstreamStatus).toBe(503);
    expect(json.error).toContain("503");
    expect(json).not.toHaveProperty("dbError");
  });

  it("returns 502 when upstream fetch throws", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_COMPLIANCE" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const req = new Request("http://localhost/api/platform/monitoring/dealer-health");
    const res = await GET(req);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.upstreamStatus).toBe(0);
    expect(json.error).toContain("Upstream unreachable");
  });
});
