import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const callDealerJobRunsDailyMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));
vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerJobRunsDaily: callDealerJobRunsDailyMock,
}));

import { GET } from "./route";

describe("daily job-runs proxy RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callDealerJobRunsDailyMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            day: "2026-03-01",
            dealershipId: "11111111-1111-1111-1111-111111111111",
            totalRuns: 8,
            skippedRuns: 1,
            processedRuns: 20,
            failedRuns: 2,
            avgDurationMs: 501,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 when user has no allowed role", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "OTHER" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient role", 403)
    );
    const res = await GET(
      new Request(
        "http://localhost/api/platform/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
      )
    );
    expect(res.status).toBe(403);
    expect(callDealerJobRunsDailyMock).not.toHaveBeenCalled();
  });

  it("returns 200 for owner/compliance/support", async () => {
    for (const role of ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]) {
      requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role });
      requirePlatformRoleMock.mockResolvedValueOnce(undefined);
      const res = await GET(
        new Request(
          "http://localhost/api/platform/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
        )
      );
      expect(res.status).toBe(200);
      expect(callDealerJobRunsDailyMock).toHaveBeenCalled();
    }
  });

  it("returns sanitized upstream failure", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    callDealerJobRunsDailyMock.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, message: "postgres://foo token=bar" },
    });

    const res = await GET(
      new Request(
        "http://localhost/api/platform/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
      )
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("UPSTREAM_ERROR");
    expect(json.error?.message).toBe("Dealer daily job-run stats unavailable");
    expect(JSON.stringify(json)).not.toContain("postgres://");
    expect(JSON.stringify(json)).not.toContain("token=");
  });
});
