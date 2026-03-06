/**
 * Platform job-runs: resolve platformDealershipId to dealerDealershipId via DealershipMapping.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));

jest.mock("@/lib/db", () => ({ prisma: { dealershipMapping: { findUnique: jest.fn() } } }));

jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerJobRuns: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { callDealerJobRuns } from "@/lib/call-dealer-internal";
import { GET } from "./route";

describe("platform monitoring job-runs mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 404 when platformDealershipId has no mapping", async () => {
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const url =
      "http://localhost/api/platform/monitoring/job-runs?platformDealershipId=a0000000-0000-0000-0000-000000000099&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_FOUND");
    expect(json.error?.message).toContain("mapping");
    expect(callDealerJobRuns).not.toHaveBeenCalled();
  });

  it("calls dealer with dealerDealershipId when platformDealershipId provided", async () => {
    const platformId = "a0000000-0000-0000-0000-000000000001";
    const dealerId = "d0000000-0000-0000-0000-000000000002";
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValueOnce({ dealerDealershipId: dealerId });
    (callDealerJobRuns as jest.Mock).mockResolvedValueOnce({ ok: true, data: { data: [], total: 0 } });
    const url = `http://localhost/api/platform/monitoring/job-runs?platformDealershipId=${platformId}&dateFrom=2025-03-01&dateTo=2025-03-02`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(callDealerJobRuns).toHaveBeenCalledWith(
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
    (callDealerJobRuns as jest.Mock).mockResolvedValueOnce({ ok: true, data: { data: [], total: 0 } });
    const url = `http://localhost/api/platform/monitoring/job-runs?dealershipId=${dealerId}&dateFrom=2025-03-01&dateTo=2025-03-02`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(prisma.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerJobRuns).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        dateFrom: "2025-03-01",
        dateTo: "2025-03-02",
      }),
      expect.any(Object)
    );
  });
});
