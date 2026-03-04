/**
 * Platform rate-limits proxy: RBAC — 403 without allowed role; 200 with PLATFORM_OWNER, PLATFORM_COMPLIANCE, or PLATFORM_SUPPORT.
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
jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerRateLimits: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { callDealerRateLimits } from "@/lib/call-dealer-internal";
import { GET } from "./route";

describe("rate-limits proxy RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (callDealerRateLimits as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        items: [{ routeKey: "/api/internal/provision/dealership", windowStart: "2025-03-02T12:00:00.000Z", allowedCount: 10, blockedCount: 0 }],
        limit: 20,
        offset: 0,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 403 when user has no allowed role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "SOME_OTHER_ROLE" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient role", 403)
    );

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(callDealerRateLimits).not.toHaveBeenCalled();
  });

  it("returns 200 and calls dealer when user is PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2025-03-02T00:00:00.000Z",
        dateTo: "2025-03-02T23:59:59.999Z",
        limit: 20,
        offset: 0,
      }),
      expect.any(Object)
    );
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].routeKey).toBe("/api/internal/provision/dealership");
    expect(json.items[0].allowedCount).toBe(10);
    expect(json.items[0].blockedCount).toBe(0);
  });

  it("returns 200 when user is PLATFORM_COMPLIANCE", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_COMPLIANCE" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimits).toHaveBeenCalled();
  });

  it("returns 200 when user is PLATFORM_SUPPORT", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimits).toHaveBeenCalled();
  });

  it("returns sanitized upstream error response", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (callDealerRateLimits as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        status: 500,
        message: "postgres://user:pass@db.example.com:5432/postgres token=abc",
      },
    });

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("UPSTREAM_ERROR");
    expect(json.error?.message).toBe("Dealer rate-limit monitoring unavailable");
    expect(JSON.stringify(json)).not.toContain("postgres://");
    expect(JSON.stringify(json)).not.toContain("token=");
  });
});
