/** @jest-environment node */
/**
 * Dealer job run telemetry: insert and list (pagination). Unit tests with mocked Prisma.
 */
jest.mock("@/lib/db", () => ({
  prisma: {
    dealerJobRun: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createDealerJobRun, listDealerJobRuns } from "../db/dealer-job-run";

describe("dealer-job-run db", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("createDealerJobRun inserts one row with correct shape", async () => {
    (prisma.dealerJobRun.create as jest.Mock).mockResolvedValue(undefined);
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

    expect(prisma.dealerJobRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.dealerJobRun.create).toHaveBeenCalledWith({
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
    (prisma.dealerJobRun.findMany as jest.Mock).mockResolvedValue([row]);
    (prisma.dealerJobRun.count as jest.Mock).mockResolvedValue(1);

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
    expect(prisma.dealerJobRun.findMany).toHaveBeenCalledWith(
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
    expect(prisma.dealerJobRun.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dealershipId,
          startedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        },
      })
    );
  });
});
