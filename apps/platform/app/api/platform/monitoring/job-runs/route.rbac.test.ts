/**
 * Platform job-runs: 403 for insufficient role before any lookup or dealer call.
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

jest.mock("@/lib/db", () => ({ prisma: { dealershipMapping: { findUnique: jest.fn() } } }));

jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerJobRuns: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { callDealerJobRuns } from "@/lib/call-dealer-internal";
import { GET } from "./route";

describe("platform monitoring job-runs RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when user has no platform role (guard before lookup)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "SOME_OTHER_ROLE" });
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
    expect(prisma.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerJobRuns).not.toHaveBeenCalled();
  });

  it("returns 200 for PLATFORM_OWNER when query valid and mapping exists", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValueOnce({
      dealerDealershipId: "d0000000-0000-0000-0000-000000000002",
    });
    (callDealerJobRuns as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: [{ runId: "r1", dealershipId: "d0000000-0000-0000-0000-000000000002", processed: 1 }], total: 1 },
    });
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(prisma.dealershipMapping.findUnique).toHaveBeenCalledWith({
      where: { platformDealershipId: "a0000000-0000-0000-0000-000000000001" },
      select: { dealerDealershipId: true },
    });
    expect(callDealerJobRuns).toHaveBeenCalledWith(
      "d0000000-0000-0000-0000-000000000002",
      expect.objectContaining({
        dateFrom: "2025-03-01",
        dateTo: "2025-03-02",
      }),
      expect.any(Object)
    );
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.total).toBe(1);
  });

  it("returns sanitized body when dealer upstream fails", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValueOnce({
      dealerDealershipId: "d0000000-0000-0000-0000-000000000002",
    });
    (callDealerJobRuns as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        status: 500,
        message: "database_url=postgres://user:pass@db.example.com:5432/postgres",
      },
    });
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.total).toBe(0);
    expect(JSON.stringify(json)).not.toContain("database_url");
    expect(JSON.stringify(json)).not.toContain("postgres://");
  });
});
