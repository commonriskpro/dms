jest.mock("@/lib/internal-api-auth", () => ({
  verifyInternalApiJwt: jest.fn(),
  InternalApiError: class InternalApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 401
    ) {
      super(message);
      this.name = "InternalApiError";
    }
  },
}));

jest.mock("@/lib/internal-rate-limit", () => ({
  checkInternalRateLimit: jest.fn(),
}));

jest.mock("@/lib/rate-limit-stats", () => ({
  listRateLimitDailyStats: jest.fn(),
}));

import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listRateLimitDailyStats } from "@/lib/rate-limit-stats";
import { GET } from "./route";

describe("GET /api/internal/monitoring/rate-limits/daily", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkInternalRateLimit as jest.Mock).mockResolvedValue(null);
  });

  it("returns 422 for invalid query", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const url = "http://localhost/api/internal/monitoring/rate-limits/daily?dateFrom=bad&dateTo=2026-03-01";
    const res = await GET(new Request(url));
    expect(res.status).toBe(422);
    expect(listRateLimitDailyStats).not.toHaveBeenCalled();
  });

  it("returns paginated rows without ipHash in response", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    (listRateLimitDailyStats as jest.Mock).mockResolvedValue({
      items: [
        {
          day: "2026-03-01",
          routeKey: "/api/internal/provision/dealership",
          allowedCount: 10,
          blockedCount: 2,
          uniqueIpCountApprox: 4,
        },
      ],
      total: 1,
    });

    const url =
      "http://localhost/api/internal/monitoring/rate-limits/daily?dateFrom=2026-03-01&dateTo=2026-03-02&limit=20&offset=0";
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.limit).toBe(20);
    expect(json.offset).toBe(0);
    expect(json.total).toBe(1);
    expect(json.items[0].uniqueIpCountApprox).toBe(4);
    expect("ipHash" in json.items[0]).toBe(false);
    expect(listRateLimitDailyStats).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-02",
        limit: 20,
        offset: 0,
      })
    );
  });
});
