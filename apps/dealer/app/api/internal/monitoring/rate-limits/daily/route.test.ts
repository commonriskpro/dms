import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyInternalApiJwtMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/internal-api-auth", () => ({
  verifyInternalApiJwt: verifyInternalApiJwtMock,
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

const checkInternalRateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/internal-rate-limit", () => ({
  checkInternalRateLimit: checkInternalRateLimitMock,
}));

const listRateLimitDailyStatsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit-stats", () => ({
  listRateLimitDailyStats: listRateLimitDailyStatsMock,
}));

import { GET } from "./route";

describe("GET /api/internal/monitoring/rate-limits/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkInternalRateLimitMock.mockResolvedValue(null);
  });

  it("returns 422 for invalid query", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    const url = "http://localhost/api/internal/monitoring/rate-limits/daily?dateFrom=bad&dateTo=2026-03-01";
    const res = await GET(new Request(url));
    expect(res.status).toBe(422);
    expect(listRateLimitDailyStatsMock).not.toHaveBeenCalled();
  });

  it("returns paginated rows without ipHash in response", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    listRateLimitDailyStatsMock.mockResolvedValue({
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
    expect(listRateLimitDailyStatsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-02",
        limit: 20,
        offset: 0,
      })
    );
  });
});
