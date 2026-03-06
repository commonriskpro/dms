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

jest.mock("@/lib/job-run-stats", () => ({
  listJobRunsDailyStats: jest.fn(),
}));

import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listJobRunsDailyStats } from "@/lib/job-run-stats";
import { GET } from "./route";

describe("GET /api/internal/monitoring/job-runs/daily", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkInternalRateLimit as jest.Mock).mockResolvedValue(null);
  });

  it("returns 422 when query fails validation", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const res = await GET(
      new Request("http://localhost/api/internal/monitoring/job-runs/daily?dateFrom=2026-03-01")
    );
    expect(res.status).toBe(422);
    expect(listJobRunsDailyStats).not.toHaveBeenCalled();
  });

  it("returns paginated daily rows", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    (listJobRunsDailyStats as jest.Mock).mockResolvedValue({
      items: [
        {
          day: "2026-03-01",
          dealershipId: "d0000000-0000-0000-0000-000000000001",
          totalRuns: 9,
          skippedRuns: 2,
          processedRuns: 25,
          failedRuns: 1,
          avgDurationMs: 1200,
        },
      ],
      total: 1,
    });

    const url =
      "http://localhost/api/internal/monitoring/job-runs/daily?dateFrom=2026-03-01&dateTo=2026-03-02&dealershipId=d0000000-0000-0000-0000-000000000001&limit=10&offset=5";
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(json.total).toBe(1);
    expect(json.limit).toBe(10);
    expect(json.offset).toBe(5);
    expect(json.items[0].dealershipId).toBe("d0000000-0000-0000-0000-000000000001");
    expect(listJobRunsDailyStats).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-02",
        dealershipId: "d0000000-0000-0000-0000-000000000001",
        limit: 10,
        offset: 5,
      })
    );
  });
});
