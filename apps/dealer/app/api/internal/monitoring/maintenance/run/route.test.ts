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

const getTelemetryRetentionConfigMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/env", () => ({
  getTelemetryRetentionConfig: getTelemetryRetentionConfigMock,
}));

const purgeOldRateLimitEventsMock = vi.hoisted(() => vi.fn());
const aggregateRateLimitDailyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit-stats", () => ({
  purgeOldRateLimitEvents: purgeOldRateLimitEventsMock,
  aggregateRateLimitDaily: aggregateRateLimitDailyMock,
}));

const purgeOldJobRunsMock = vi.hoisted(() => vi.fn());
const aggregateJobRunsDailyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/job-run-stats", () => ({
  purgeOldJobRuns: purgeOldJobRunsMock,
  aggregateJobRunsDaily: aggregateJobRunsDailyMock,
}));

import { POST } from "./route";

describe("POST /api/internal/monitoring/maintenance/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkInternalRateLimitMock.mockResolvedValue(null);
    getTelemetryRetentionConfigMock.mockReturnValue({
      rateLimitDays: 14,
      jobRunsDays: 30,
    });
  });

  it("requires JWT", async () => {
    verifyInternalApiJwtMock.mockRejectedValueOnce(
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
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    purgeOldRateLimitEventsMock.mockResolvedValue({ deletedCount: 4 });
    purgeOldJobRunsMock.mockResolvedValue({ deletedCount: 3 });
    aggregateRateLimitDailyMock.mockResolvedValue({ day: "2026-03-01", upsertedCount: 2 });
    aggregateJobRunsDailyMock.mockResolvedValue({ day: "2026-03-01", upsertedCount: 1 });

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
