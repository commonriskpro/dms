/**
 * Platform rate-limits proxy: RBAC — 403 without allowed role; 200 with PLATFORM_OWNER, PLATFORM_COMPLIANCE, or PLATFORM_SUPPORT.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const PlatformApiErrorClass = vi.hoisted(() => {
  class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  }
  return PlatformApiError;
});
const callDealerRateLimitsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));
vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerRateLimits: callDealerRateLimitsMock,
}));

import { GET } from "./route";

describe("rate-limits proxy RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callDealerRateLimitsMock.mockResolvedValue({
      ok: true,
      data: {
        items: [{ routeKey: "/api/internal/provision/dealership", windowStart: "2025-03-02T12:00:00.000Z", allowedCount: 10, blockedCount: 0 }],
        limit: 20,
        offset: 0,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 when user has no allowed role", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "SOME_OTHER_ROLE" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient role", 403)
    );

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(callDealerRateLimitsMock).not.toHaveBeenCalled();
  });

  it("returns 200 and calls dealer when user is PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimitsMock).toHaveBeenCalledWith(
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
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_COMPLIANCE" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimitsMock).toHaveBeenCalled();
  });

  it("returns 200 when user is PLATFORM_SUPPORT", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);

    const req = new Request(
      "http://localhost/api/platform/monitoring/rate-limits?dateFrom=2025-03-02T00:00:00.000Z&dateTo=2025-03-02T23:59:59.999Z"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(callDealerRateLimitsMock).toHaveBeenCalled();
  });

  it("returns sanitized upstream error response", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    callDealerRateLimitsMock.mockResolvedValueOnce({
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
