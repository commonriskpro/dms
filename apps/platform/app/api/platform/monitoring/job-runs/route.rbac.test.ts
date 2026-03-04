/**
 * Platform job-runs: 403 for insufficient role before any lookup or dealer call.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));

const prismaMock = vi.hoisted(() => ({ dealershipMapping: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const callDealerJobRunsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerJobRuns: callDealerJobRunsMock,
}));

import { GET } from "./route";

describe("platform monitoring job-runs RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user has no platform role (guard before lookup)", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "SOME_OTHER_ROLE" });
    requirePlatformRoleMock.mockImplementationOnce(() => {
      throw new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403);
    });
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
    expect(prismaMock.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerJobRunsMock).not.toHaveBeenCalled();
  });

  it("returns 200 for PLATFORM_OWNER when query valid and mapping exists", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    prismaMock.dealershipMapping.findUnique.mockResolvedValueOnce({
      dealerDealershipId: "d0000000-0000-0000-0000-000000000002",
    });
    callDealerJobRunsMock.mockResolvedValueOnce({
      ok: true,
      data: { data: [{ runId: "r1", dealershipId: "d0000000-0000-0000-0000-000000000002", processed: 1 }], total: 1 },
    });
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(prismaMock.dealershipMapping.findUnique).toHaveBeenCalledWith({
      where: { platformDealershipId: "a0000000-0000-0000-0000-000000000001" },
      select: { dealerDealershipId: true },
    });
    expect(callDealerJobRunsMock).toHaveBeenCalledWith(
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
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    prismaMock.dealershipMapping.findUnique.mockResolvedValueOnce({
      dealerDealershipId: "d0000000-0000-0000-0000-000000000002",
    });
    callDealerJobRunsMock.mockResolvedValueOnce({
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
