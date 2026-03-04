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
  callDealerJobRunsDaily: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { callDealerJobRunsDaily } from "@/lib/call-dealer-internal";
import { GET } from "./route";

describe("daily job-runs proxy RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (callDealerJobRunsDaily as jest.Mock).mockResolvedValue({
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
    jest.restoreAllMocks();
  });

  it("returns 403 when user has no allowed role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "OTHER" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient role", 403)
    );
    const res = await GET(
      new Request(
        "http://localhost/api/platform/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
      )
    );
    expect(res.status).toBe(403);
    expect(callDealerJobRunsDaily).not.toHaveBeenCalled();
  });

  it("returns 200 for owner/compliance/support", async () => {
    for (const role of ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]) {
      (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role });
      (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
      const res = await GET(
        new Request(
          "http://localhost/api/platform/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02"
        )
      );
      expect(res.status).toBe(200);
      expect(callDealerJobRunsDaily).toHaveBeenCalled();
    }
  });

  it("returns sanitized upstream failure", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (callDealerJobRunsDaily as jest.Mock).mockResolvedValueOnce({
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
