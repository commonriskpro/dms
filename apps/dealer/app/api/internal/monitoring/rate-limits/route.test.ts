/**
 * GET /api/internal/monitoring/rate-limits:
 * JWT required, query validation/pagination, and no ipHash exposure.
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

const listRateLimitSnapshotsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit-stats", () => ({
  listRateLimitSnapshots: listRateLimitSnapshotsMock,
}));

import { GET } from "./route";

describe("GET /api/internal/monitoring/rate-limits", () => {
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
      "http://localhost/api/internal/monitoring/rate-limits?dateFrom=2025-03-01T00:00:00.000Z&dateTo=2025-03-01T23:59:59.999Z";
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect(listRateLimitSnapshotsMock).not.toHaveBeenCalled();
  });

  it("returns 422 when daily range validation fails", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    const url =
      "http://localhost/api/internal/monitoring/rate-limits?dateFrom=not-a-date&dateTo=2025-03-01T23:59:59.999Z";
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(listRateLimitSnapshotsMock).not.toHaveBeenCalled();
  });

  it("applies pagination and does not expose ipHash", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    listRateLimitSnapshotsMock.mockResolvedValueOnce([
      {
        routeKey: "/api/internal/monitoring/rate-limits",
        windowStart: "2025-03-01T12:00:00.000Z",
        allowedCount: 8,
        blockedCount: 1,
      },
    ]);
    const url =
      "http://localhost/api/internal/monitoring/rate-limits?dateFrom=2025-03-01T00:00:00.000Z&dateTo=2025-03-01T23:59:59.999Z&limit=10&offset=5";
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));
    expect(res.status).toBe(200);
    expect(listRateLimitSnapshotsMock).toHaveBeenCalledWith({
      dateFrom: "2025-03-01T00:00:00.000Z",
      dateTo: "2025-03-01T23:59:59.999Z",
      routeKey: undefined,
      limit: 10,
      offset: 5,
    });
    const json = await res.json();
    expect(json.limit).toBe(10);
    expect(json.offset).toBe(5);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].routeKey).toBe("/api/internal/monitoring/rate-limits");
    expect(json.items[0]).not.toHaveProperty("ipHash");
  });
});
