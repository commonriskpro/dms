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

jest.mock("@/lib/env", () => ({
  getTelemetryRetentionConfig: jest.fn(),
}));

jest.mock("@/lib/rate-limit-stats", () => ({
  purgeOldRateLimitEvents: jest.fn(),
  aggregateRateLimitDaily: jest.fn(),
}));

jest.mock("@/lib/job-run-stats", () => ({
  purgeOldJobRuns: jest.fn(),
  aggregateJobRunsDaily: jest.fn(),
}));

import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { getTelemetryRetentionConfig } from "@/lib/env";
import { purgeOldRateLimitEvents, aggregateRateLimitDaily } from "@/lib/rate-limit-stats";
import { purgeOldJobRuns, aggregateJobRunsDaily } from "@/lib/job-run-stats";
import { POST } from "./route";

describe("POST /api/internal/monitoring/maintenance/run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkInternalRateLimit as jest.Mock).mockResolvedValue(null);
    (getTelemetryRetentionConfig as jest.Mock).mockReturnValue({
      rateLimitDays: 14,
      jobRunsDays: 30,
    });
  });

  it("requires JWT", async () => {
    (verifyInternalApiJwt as jest.Mock).mockRejectedValueOnce(
      new (await import("@/lib/internal-api-auth")).InternalApiError(
        "UNAUTHORIZED",
        "Missing or invalid Authorization",
        401
      )
    );
    const res = await POST(
      new Request("http://localhost/api/internal/monitoring/maintenance/run", {
        method: "POST",
        body: JSON.stringify({ kind: "all" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns sanitized success payload for kind=all", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    (purgeOldRateLimitEvents as jest.Mock).mockResolvedValue({ deletedCount: 4 });
    (purgeOldJobRuns as jest.Mock).mockResolvedValue({ deletedCount: 3 });
    (aggregateRateLimitDaily as jest.Mock).mockResolvedValue({ day: "2026-03-01", upsertedCount: 2 });
    (aggregateJobRunsDaily as jest.Mock).mockResolvedValue({ day: "2026-03-01", upsertedCount: 1 });

    const res = await POST(
      new Request("http://localhost/api/internal/monitoring/maintenance/run", {
        method: "POST",
        headers: { Authorization: "Bearer valid.jwt" },
        body: JSON.stringify({ kind: "all", date: "2026-03-01" }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(json).toEqual({
      ok: true,
      requestId: expect.any(String),
      purged: {
        rateLimitEventsDeleted: 4,
        jobRunsDeleted: 3,
      },
      aggregated: {
        day: "2026-03-01",
        rateLimitRowsUpserted: 2,
        jobRunRowsUpserted: 1,
      },
    });
  });
});
