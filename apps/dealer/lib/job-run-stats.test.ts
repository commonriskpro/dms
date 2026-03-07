/** @jest-environment node */
jest.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    dealerJobRunsDaily: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    dealerJobRun: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { aggregateJobRunsDaily, purgeOldJobRuns } from "./job-run-stats";

describe("job-run-stats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregateJobRunsDaily is idempotent via upsert on (day, dealershipId)", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        dealership_id: "d0000000-0000-0000-0000-000000000001",
        total_runs: BigInt(10),
        skipped_runs: BigInt(2),
        processed_runs: BigInt(31),
        failed_runs: BigInt(4),
        avg_duration_ms: BigInt(2500),
      },
    ]);
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        dealership_id: "d0000000-0000-0000-0000-000000000001",
        total_runs: BigInt(10),
        skipped_runs: BigInt(2),
        processed_runs: BigInt(31),
        failed_runs: BigInt(4),
        avg_duration_ms: BigInt(2500),
      },
    ]);
    prisma.dealerJobRunsDaily.upsert.mockResolvedValue({});

    const first = await aggregateJobRunsDaily("2026-03-01");
    const second = await aggregateJobRunsDaily("2026-03-01");

    expect(first).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(second).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(prisma.dealerJobRunsDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.dealerJobRunsDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          day_dealershipId: {
            day: expect.any(Date),
            dealershipId: "d0000000-0000-0000-0000-000000000001",
          },
        },
      })
    );
  });

  it("purgeOldJobRuns deletes in deterministic batches until complete", async () => {
    prisma.dealerJobRun.findMany
      .mockResolvedValueOnce(Array.from({ length: 5000 }, (_, i) => ({ id: `id-${i}` })))
      .mockResolvedValueOnce([{ id: "id-last-1" }, { id: "id-last-2" }])
      .mockResolvedValueOnce([]);
    prisma.dealerJobRun.deleteMany
      .mockResolvedValueOnce({ count: 5000 })
      .mockResolvedValueOnce({ count: 2 });

    const result = await purgeOldJobRuns({ olderThanDays: 30 });

    expect(result).toEqual({ deletedCount: 5002 });
    expect(prisma.dealerJobRun.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.dealerJobRun.deleteMany).toHaveBeenCalledTimes(2);
  });
});
