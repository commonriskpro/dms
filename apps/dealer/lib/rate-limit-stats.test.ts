import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  dealerRateLimitStatsDaily: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  dealerRateLimitEvent: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { aggregateRateLimitDaily, purgeOldRateLimitEvents } from "./rate-limit-stats";

describe("rate-limit-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregateRateLimitDaily is idempotent via upsert on (day, routeKey)", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        route_key: "/api/internal/provision/dealership",
        allowed_count: BigInt(10),
        blocked_count: BigInt(2),
        unique_ip_count_approx: BigInt(4),
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        route_key: "/api/internal/provision/dealership",
        allowed_count: BigInt(10),
        blocked_count: BigInt(2),
        unique_ip_count_approx: BigInt(4),
      },
    ]);
    prismaMock.dealerRateLimitStatsDaily.upsert.mockResolvedValue({});

    const first = await aggregateRateLimitDaily("2026-03-01");
    const second = await aggregateRateLimitDaily("2026-03-01");

    expect(first).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(second).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(prismaMock.dealerRateLimitStatsDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.dealerRateLimitStatsDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          day_routeKey: {
            day: expect.any(Date),
            routeKey: "/api/internal/provision/dealership",
          },
        },
      })
    );
  });

  it("purgeOldRateLimitEvents deletes in deterministic batches until complete", async () => {
    prismaMock.dealerRateLimitEvent.findMany
      .mockResolvedValueOnce(Array.from({ length: 5000 }, (_, i) => ({ id: `id-${i}` })))
      .mockResolvedValueOnce([{ id: "id-last-1" }, { id: "id-last-2" }])
      .mockResolvedValueOnce([]);
    prismaMock.dealerRateLimitEvent.deleteMany
      .mockResolvedValueOnce({ count: 5000 })
      .mockResolvedValueOnce({ count: 2 });

    const result = await purgeOldRateLimitEvents({ olderThanDays: 14 });

    expect(result).toEqual({ deletedCount: 5002 });
    expect(prismaMock.dealerRateLimitEvent.findMany).toHaveBeenCalledTimes(3);
    expect(prismaMock.dealerRateLimitEvent.deleteMany).toHaveBeenCalledTimes(2);
  });
});
