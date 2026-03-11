import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const PURGE_BATCH_SIZE = 5000;

type DailyJobRunAggregateRow = {
  dealership_id: string;
  total_runs: bigint;
  skipped_runs: bigint;
  processed_runs: bigint;
  failed_runs: bigint;
  avg_duration_ms: number | bigint | null;
};

type DealerJobRunDailyRow = {
  day: string;
  dealershipId: string;
  totalRuns: number;
  skippedRuns: number;
  processedRuns: number;
  failedRuns: number;
  avgDurationMs: number;
};

type ListJobRunsDailyInput = {
  dateFrom: string;
  dateTo: string;
  dealershipId?: string;
  limit: number;
  offset: number;
};

function startOfUtcDay(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
}

function nextUtcDay(day: Date): Date {
  return new Date(day.getTime() + 24 * 60 * 60 * 1000);
}

function normalizeDayOrYesterday(day?: string): Date {
  if (day != null) {
    const parsed = new Date(`${day}T00:00:00.000Z`);
    return startOfUtcDay(parsed);
  }
  const now = new Date();
  const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return startOfUtcDay(yesterdayUtc);
}

function toInteger(value: number | bigint | null): number {
  if (value == null) return 0;
  return typeof value === "number" ? Math.round(value) : Number(value);
}

export async function purgeOldJobRuns(input: { olderThanDays: number }): Promise<{ deletedCount: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - input.olderThanDays * 24 * 60 * 60 * 1000);
  let deletedCount = 0;

  for (;;) {
    const batch = await prisma.dealerJobRun.findMany({
      where: { startedAt: { lt: cutoff } },
      select: { id: true },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      take: PURGE_BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const ids = batch.map((row) => row.id);
    const deleted = await prisma.dealerJobRun.deleteMany({
      where: { id: { in: ids } },
    });
    deletedCount += deleted.count;
  }

  return { deletedCount };
}

export async function aggregateJobRunsDaily(day?: string): Promise<{ day: string; upsertedCount: number }> {
  const dayStart = normalizeDayOrYesterday(day);
  const dayEnd = nextUtcDay(dayStart);
  const dayIso = dayStart.toISOString().slice(0, 10);

  const aggregates = await prisma.$queryRaw<DailyJobRunAggregateRow[]>(Prisma.sql`
    SELECT
      dealership_id,
      count(*)::bigint AS total_runs,
      count(*) FILTER (WHERE skipped_reason IS NOT NULL)::bigint AS skipped_runs,
      coalesce(sum(processed), 0)::bigint AS processed_runs,
      coalesce(sum(failed + dead_letter), 0)::bigint AS failed_runs,
      round(avg(duration_ms))::bigint AS avg_duration_ms
    FROM dealer_job_runs
    WHERE started_at >= ${dayStart}::timestamptz
      AND started_at < ${dayEnd}::timestamptz
    GROUP BY dealership_id
  `);

  if (aggregates.length === 0) return { day: dayIso, upsertedCount: 0 };

  await prisma.$transaction(
    aggregates.map((row) =>
      prisma.dealerJobRunsDaily.upsert({
        where: {
          day_dealershipId: {
            day: dayStart,
            dealershipId: row.dealership_id,
          },
        },
        create: {
          day: dayStart,
          dealershipId: row.dealership_id,
          totalRuns: Number(row.total_runs),
          skippedRuns: Number(row.skipped_runs),
          processedRuns: Number(row.processed_runs),
          failedRuns: Number(row.failed_runs),
          avgDurationMs: toInteger(row.avg_duration_ms),
        },
        update: {
          totalRuns: Number(row.total_runs),
          skippedRuns: Number(row.skipped_runs),
          processedRuns: Number(row.processed_runs),
          failedRuns: Number(row.failed_runs),
          avgDurationMs: toInteger(row.avg_duration_ms),
          createdAt: new Date(),
        },
      })
    )
  );

  return { day: dayIso, upsertedCount: aggregates.length };
}

export async function listJobRunsDailyStats(
  input: ListJobRunsDailyInput
): Promise<{ items: DealerJobRunDailyRow[]; total: number }> {
  const where = {
    day: {
      gte: new Date(`${input.dateFrom}T00:00:00.000Z`),
      lte: new Date(`${input.dateTo}T00:00:00.000Z`),
    },
    ...(input.dealershipId != null ? { dealershipId: input.dealershipId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.dealerJobRunsDaily.findMany({
      where,
      orderBy: [{ day: "desc" }, { dealershipId: "asc" }],
      take: input.limit,
      skip: input.offset,
    }),
    prisma.dealerJobRunsDaily.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      dealershipId: row.dealershipId,
      totalRuns: row.totalRuns,
      skippedRuns: row.skippedRuns,
      processedRuns: row.processedRuns,
      failedRuns: row.failedRuns,
      avgDurationMs: row.avgDurationMs,
    })),
    total,
  };
}
