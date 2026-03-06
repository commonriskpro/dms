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
  callDealerRateLimitsDaily: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { callDealerRateLimitsDaily } from "@/lib/call-dealer-internal";
import { GET } from "./route";

describe("daily rate-limits proxy RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (callDealerRateLimitsDaily as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            day: "2026-03-01",
            routeKey: "/api/internal/provision/dealership",
            allowedCount: 20,
            blockedCount: 2,
            uniqueIpCountApprox: 5,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 403 when user has no allowed role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "OTHER" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient role", 403)
    );
    const res = await GET(
      new Request(
        "http://localhost/api/platform/monitoring/rate-limits/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
      )
    );
    expect(res.status).toBe(403);
    expect(callDealerRateLimitsDaily).not.toHaveBeenCalled();
  });

  it("returns 200 for owner/compliance/support", async () => {
    for (const role of ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]) {
      (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role });
      (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
      const res = await GET(
        new Request(
          "http://localhost/api/platform/monitoring/rate-limits/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
        )
      );
      expect(res.status).toBe(200);
      expect(callDealerRateLimitsDaily).toHaveBeenCalled();
    }
  });

  it("returns sanitized upstream failure", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (callDealerRateLimitsDaily as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: { status: 500, message: "postgres://foo token=bar" },
    });

    const res = await GET(
      new Request(
        "http://localhost/api/platform/monitoring/rate-limits/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
      )
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("UPSTREAM_ERROR");
    expect(json.error?.message).toBe("Dealer daily rate-limit stats unavailable");
    expect(JSON.stringify(json)).not.toContain("postgres://");
    expect(JSON.stringify(json)).not.toContain("token=");
  });
});
