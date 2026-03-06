/**
 * Dealer job run telemetry: one row per worker run. Tenant-scoped.
 */

import { prisma } from "@/lib/db";

export type CreateDealerJobRunInput = {
  runId: string;
  dealershipId: string;
  startedAt: Date;
  finishedAt: Date;
  processed: number;
  failed: number;
  deadLetter: number;
  skippedReason: string | null;
  durationMs: number;
};

export async function createDealerJobRun(dealershipId: string, data: CreateDealerJobRunInput): Promise<void> {
  await prisma.dealerJobRun.create({
    data: {
      id: data.runId,
      dealershipId,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      processed: data.processed,
      failed: data.failed,
      deadLetter: data.deadLetter,
      skippedReason: data.skippedReason,
      durationMs: data.durationMs,
    },
  });
}

export type ListDealerJobRunsInput = {
  dealershipId: string;
  dateFrom: Date;
  dateTo: Date;
  limit: number;
  offset: number;
};

export type DealerJobRunRow = {
  id: string;
  dealershipId: string;
  startedAt: Date;
  finishedAt: Date;
  processed: number;
  failed: number;
  deadLetter: number;
  skippedReason: string | null;
  durationMs: number;
};

export async function listDealerJobRuns(
  dealershipId: string,
  input: ListDealerJobRunsInput
): Promise<{ data: DealerJobRunRow[]; total: number }> {
  const where = {
    dealershipId,
    startedAt: { gte: input.dateFrom, lte: input.dateTo },
  };
  const [data, total] = await Promise.all([
    prisma.dealerJobRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.dealerJobRun.count({ where }),
  ]);
  return {
    data: data.map((r) => ({
      id: r.id,
      dealershipId: r.dealershipId,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      processed: r.processed,
      failed: r.failed,
      deadLetter: r.deadLetter,
      skippedReason: r.skippedReason,
      durationMs: r.durationMs,
    })),
    total,
  };
}
