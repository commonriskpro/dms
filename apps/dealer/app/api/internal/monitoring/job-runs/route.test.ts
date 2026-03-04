/**
 * GET /api/internal/monitoring/job-runs: JWT required, query validation, pagination.
 */
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
jest.mock("@/modules/crm-pipeline-automation/db/dealer-job-run", () => ({
  listDealerJobRuns: jest.fn(),
}));

import { GET } from "./route";
import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listDealerJobRuns } from "@/modules/crm-pipeline-automation/db/dealer-job-run";

describe("GET /api/internal/monitoring/job-runs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkInternalRateLimit as jest.Mock).mockReturnValue(null);
  });

  it("returns 401 when JWT is missing", async () => {
    (verifyInternalApiJwt as jest.Mock).mockRejectedValueOnce(
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
    expect(listDealerJobRuns).not.toHaveBeenCalled();
  });

  it("returns 422 when query validation fails (missing dealershipId)", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const url = "http://localhost/api/internal/monitoring/job-runs?dateFrom=2025-03-01&dateTo=2025-03-02";
    const res = await GET(new Request(url));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(listDealerJobRuns).not.toHaveBeenCalled();
  });

  it("returns 200 with data and total when valid query and JWT", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const dealershipId = "d0000000-0000-0000-0000-000000000001";
    const runId = "a0000000-0000-0000-0000-000000000001";
    (listDealerJobRuns as jest.Mock).mockResolvedValue({
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
    const url = `http://localhost/api/internal/monitoring/job-runs?dealershipId=${dealershipId}&dateFrom=2025-03-01&dateTo=2025-03-02`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].runId).toBe(runId);
    expect(json.total).toBe(1);
  });
});
