/**
 * Platform job-runs: resolve platformDealershipId to dealerDealershipId via DealershipMapping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
}));

const prismaMock = vi.hoisted(() => ({ dealershipMapping: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const callDealerJobRunsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerJobRuns: callDealerJobRunsMock,
}));

import { GET } from "./route";

describe("platform monitoring job-runs mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAuthMock.mockResolvedValue({ userId: "u1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
  });

  it("returns 404 when platformDealershipId has no mapping", async () => {
    prismaMock.dealershipMapping.findUnique.mockResolvedValueOnce(null);
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000099&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_FOUND");
    expect(json.error?.message).toContain("mapping");
    expect(callDealerJobRunsMock).not.toHaveBeenCalled();
  });

  it("calls dealer with dealerDealershipId when platformDealershipId provided", async () => {
    const platformId = "a0000000-0000-0000-0000-000000000001";
    const dealerId = "d0000000-0000-0000-0000-000000000002";
    prismaMock.dealershipMapping.findUnique.mockResolvedValueOnce({ dealerDealershipId: dealerId });
    callDealerJobRunsMock.mockResolvedValueOnce({ ok: true, data: { data: [], total: 0 } });
    const url = `http://localhost/api/platform/monitoring/job-runs?platformDealershipId=${platformId}&dateFrom=2025-03-01&dateTo=2025-03-02`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(callDealerJobRunsMock).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        dateFrom: "2025-03-01",
        dateTo: "2025-03-02",
      }),
      expect.any(Object)
    );
  });

  it("calls dealer with provided dealershipId when no platformDealershipId", async () => {
    const dealerId = "d0000000-0000-0000-0000-000000000003";
    callDealerJobRunsMock.mockResolvedValueOnce({ ok: true, data: { data: [], total: 0 } });
    const url = `http://localhost/api/platform/monitoring/job-runs?dealershipId=${dealerId}&dateFrom=2025-03-01&dateTo=2025-03-02`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(prismaMock.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerJobRunsMock).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        dateFrom: "2025-03-01",
        dateTo: "2025-03-02",
      }),
      expect.any(Object)
    );
  });
});
