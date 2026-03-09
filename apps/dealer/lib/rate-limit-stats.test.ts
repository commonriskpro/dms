/** @jest-environment node */
jest.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    dealerRateLimitStatsDaily: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    dealerRateLimitEvent: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { aggregateRateLimitDaily, purgeOldRateLimitEvents } from "./rate-limit-stats";

describe("rate-limit-stats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregateRateLimitDaily is idempotent via upsert on (day, routeKey)", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        route_key: "/api/internal/provision/dealership",
        allowed_count: BigInt(10),
        blocked_count: BigInt(2),
        unique_ip_count_approx: BigInt(4),
      },
    ]);
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        route_key: "/api/internal/provision/dealership",
        allowed_count: BigInt(10),
        blocked_count: BigInt(2),
        unique_ip_count_approx: BigInt(4),
      },
    ]);
    prisma.dealerRateLimitStatsDaily.upsert.mockResolvedValue({});

    const first = await aggregateRateLimitDaily("2026-03-01");
    const second = await aggregateRateLimitDaily("2026-03-01");

    expect(first).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(second).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(prisma.dealerRateLimitStatsDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.dealerRateLimitStatsDaily.upsert).toHaveBeenCalledWith(
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
    prisma.dealerRateLimitEvent.findMany
      .mockResolvedValueOnce(Array.from({ length: 5000 }, (_, i) => ({ id: `id-${i}` })))
      .mockResolvedValueOnce([{ id: "id-last-1" }, { id: "id-last-2" }])
      .mockResolvedValueOnce([]);
    prisma.dealerRateLimitEvent.deleteMany
      .mockResolvedValueOnce({ count: 5000 })
      .mockResolvedValueOnce({ count: 2 });

    const result = await purgeOldRateLimitEvents({ olderThanDays: 14 });

    expect(result).toEqual({ deletedCount: 5002 });
    expect(prisma.dealerRateLimitEvent.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.dealerRateLimitEvent.deleteMany).toHaveBeenCalledTimes(2);
  });
});
