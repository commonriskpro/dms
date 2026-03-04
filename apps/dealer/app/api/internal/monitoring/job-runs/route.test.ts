/**
 * GET /api/internal/monitoring/job-runs: JWT required, query validation, pagination.
 */
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

const listDealerJobRunsMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/crm-pipeline-automation/db/dealer-job-run", () => ({
  listDealerJobRuns: listDealerJobRunsMock,
}));

import { GET } from "./route";

describe("GET /api/internal/monitoring/job-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkInternalRateLimitMock.mockReturnValue(null);
  });

  it("returns 401 when JWT is missing", async () => {
    verifyInternalApiJwtMock.mockRejectedValueOnce(
      new (await import("@/lib/internal-api-auth")).InternalApiError(
        "UNAUTHORIZED",
        "Missing or invalid Authorization",
        401
      )
    );
    const url =
      "http://localhost/api/internal/monitoring/job-runs?dealershipId=d0000000-0000-0000-0000-000000000001&dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect(listDealerJobRunsMock).not.toHaveBeenCalled();
  });

  it("returns 422 when query validation fails (missing dealershipId)", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    const url = "http://localhost/api/internal/monitoring/job-runs?dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(listDealerJobRunsMock).not.toHaveBeenCalled();
  });

  it("returns 200 with data and total when valid query and JWT", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    const dealershipId = "d0000000-0000-0000-0000-000000000001";
    const runId = "a0000000-0000-0000-0000-000000000001";
    listDealerJobRunsMock.mockResolvedValue({
      data: [
        {
          id: runId,
          dealershipId,
          startedAt: new Date("2025-03-01T10:00:00Z"),
          finishedAt: new Date("2025-03-01T10:01:00Z"),
          processed: 3,
          failed: 0,
          deadLetter: 0,
          skippedReason: null,
          durationMs: 60_000,
        },
      ],
      total: 1,
    });
    const url = `http://localhost/api/internal/monitoring/job-runs?dealershipId=${dealershipId}&dateFrom=2025-03-01&dateTo=2025-03-02&limit=20&offset=0`;
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].runId).toBe(runId);
    expect(json.data[0].processed).toBe(3);
    expect(json.data[0].startedAt).toBe("2025-03-01T10:00:00.000Z");
    expect(json.total).toBe(1);
    expect(listDealerJobRunsMock).toHaveBeenCalledWith(
      dealershipId,
      expect.objectContaining({
        dealershipId,
        limit: 20,
        offset: 0,
      })
    );
  });
});
