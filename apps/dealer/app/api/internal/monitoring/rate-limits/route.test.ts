/**
 * GET /api/internal/monitoring/rate-limits:
 * JWT required, query validation/pagination, and no ipHash exposure.
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

jest.mock("@/lib/rate-limit-stats", () => ({
  listRateLimitSnapshots: jest.fn(),
}));

import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listRateLimitSnapshots } from "@/lib/rate-limit-stats";
import { GET } from "./route";

describe("GET /api/internal/monitoring/rate-limits", () => {
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
      "http://localhost/api/internal/monitoring/rate-limits?dateFrom=2025-03-01T00:00:00.000Z&dateTo=2025-03-01T23:59:59.999Z";
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect(listRateLimitSnapshots).not.toHaveBeenCalled();
  });

  it("returns 422 when daily range validation fails", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const url =
      "http://localhost/api/internal/monitoring/rate-limits?dateFrom=not-a-date&dateTo=2025-03-01T23:59:59.999Z";
    const res = await GET(new Request(url, { headers: { Authorization: "Bearer valid.jwt" } }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(listRateLimitSnapshots).not.toHaveBeenCalled();
  });

  it("applies pagination and does not expose ipHash", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    (listRateLimitSnapshots as jest.Mock).mockResolvedValueOnce([
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
    expect(listRateLimitSnapshots).toHaveBeenCalledWith({
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
