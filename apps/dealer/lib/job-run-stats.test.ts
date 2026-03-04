import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  dealerJobRunsDaily: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  dealerJobRun: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { aggregateJobRunsDaily, purgeOldJobRuns } from "./job-run-stats";

describe("job-run-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregateJobRunsDaily is idempotent via upsert on (day, dealershipId)", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        dealership_id: "d0000000-0000-0000-0000-000000000001",
        total_runs: BigInt(10),
        skipped_runs: BigInt(2),
        processed_runs: BigInt(31),
        failed_runs: BigInt(4),
        avg_duration_ms: BigInt(2500),
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        dealership_id: "d0000000-0000-0000-0000-000000000001",
        total_runs: BigInt(10),
        skipped_runs: BigInt(2),
        processed_runs: BigInt(31),
        failed_runs: BigInt(4),
        avg_duration_ms: BigInt(2500),
      },
    ]);
    prismaMock.dealerJobRunsDaily.upsert.mockResolvedValue({});

    const first = await aggregateJobRunsDaily("2026-03-01");
    const second = await aggregateJobRunsDaily("2026-03-01");

    expect(first).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(second).toEqual({ day: "2026-03-01", upsertedCount: 1 });
    expect(prismaMock.dealerJobRunsDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.dealerJobRunsDaily.upsert).toHaveBeenCalledWith(
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
    prismaMock.dealerJobRun.findMany
      .mockResolvedValueOnce(Array.from({ length: 5000 }, (_, i) => ({ id: `id-${i}` })))
      .mockResolvedValueOnce([{ id: "id-last-1" }, { id: "id-last-2" }])
      .mockResolvedValueOnce([]);
    prismaMock.dealerJobRun.deleteMany
      .mockResolvedValueOnce({ count: 5000 })
      .mockResolvedValueOnce({ count: 2 });

    const result = await purgeOldJobRuns({ olderThanDays: 30 });

    expect(result).toEqual({ deletedCount: 5002 });
    expect(prismaMock.dealerJobRun.findMany).toHaveBeenCalledTimes(3);
    expect(prismaMock.dealerJobRun.deleteMany).toHaveBeenCalledTimes(2);
  });
});
