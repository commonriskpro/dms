/**
 * Dealer job run telemetry: insert and list (pagination). Unit tests with mocked Prisma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  dealerJobRun: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { createDealerJobRun, listDealerJobRuns } from "../db/dealer-job-run";

describe("dealer-job-run db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createDealerJobRun inserts one row with correct shape", async () => {
    prismaMock.dealerJobRun.create.mockResolvedValue(undefined);
    const dealershipId = "d0000000-0000-0000-0000-000000000001";
    const runId = "r0000000-0000-0000-0000-000000000002";
    const startedAt = new Date("2025-03-01T10:00:00Z");
    const finishedAt = new Date("2025-03-01T10:01:00Z");

    await createDealerJobRun(dealershipId, {
      runId,
      dealershipId,
      startedAt,
      finishedAt,
      processed: 5,
      failed: 1,
      deadLetter: 0,
      skippedReason: null,
      durationMs: 60_000,
    });

    expect(prismaMock.dealerJobRun.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.dealerJobRun.create).toHaveBeenCalledWith({
      data: {
        id: runId,
        dealershipId,
        startedAt,
        finishedAt,
        processed: 5,
        failed: 1,
        deadLetter: 0,
        skippedReason: null,
        durationMs: 60_000,
      },
    });
  });

  it("listDealerJobRuns returns paginated data and total", async () => {
    const dealershipId = "d0000000-0000-0000-0000-000000000001";
    const row = {
      id: "a0000000-0000-0000-0000-000000000002",
      dealershipId,
      startedAt: new Date("2025-03-01T10:00:00Z"),
      finishedAt: new Date("2025-03-01T10:01:00Z"),
      processed: 2,
      failed: 0,
      deadLetter: 0,
      skippedReason: null as string | null,
      durationMs: 60_000,
    };
    prismaMock.dealerJobRun.findMany.mockResolvedValue([row]);
    prismaMock.dealerJobRun.count.mockResolvedValue(1);

    const result = await listDealerJobRuns(dealershipId, {
      dealershipId,
      dateFrom: new Date("2025-03-01"),
      dateTo: new Date("2025-03-02"),
      limit: 20,
      offset: 0,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("a0000000-0000-0000-0000-000000000002");
    expect(result.data[0].processed).toBe(2);
    expect(result.total).toBe(1);
    expect(prismaMock.dealerJobRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dealershipId,
          startedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
        skip: 0,
      })
    );
    expect(prismaMock.dealerJobRun.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dealershipId,
          startedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        },
      })
    );
  });
});
