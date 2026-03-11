/**
 * DB layer: aggregate dealer rate limit events by routeKey and 1-minute bucket.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DealerInternalRateLimitSnapshot } from "@dms/contracts";

type RateLimitsQuery = {
  dateFrom: string;
  dateTo: string;
  routeKey?: string;
  limit: number;
  offset: number;
};

type Row = {
  route_key: string;
  window_start: Date;
  allowed_count: bigint;
  blocked_count: bigint;
};

export async function listRateLimitSnapshots(
  query: RateLimitsQuery
): Promise<DealerInternalRateLimitSnapshot[]> {
  const dateFrom = new Date(query.dateFrom);
  const dateTo = new Date(query.dateTo);
  const routeKeyFilter =
    query.routeKey !== undefined && query.routeKey !== ""
      ? Prisma.sql`AND route_key = ${query.routeKey}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      route_key,
      date_trunc('minute', created_at) AS window_start,
      count(*) FILTER (WHERE allowed = true)::bigint AS allowed_count,
      count(*) FILTER (WHERE allowed = false)::bigint AS blocked_count
    FROM dealer_rate_limit_events
    WHERE created_at >= ${dateFrom}::timestamptz
      AND created_at <= ${dateTo}::timestamptz
      ${routeKeyFilter}
    GROUP BY route_key, date_trunc('minute', created_at)
    ORDER BY window_start DESC, route_key
    LIMIT ${query.limit}
    OFFSET ${query.offset}
  `);

  return rows.map((r) => ({
    routeKey: r.route_key,
    windowStart: new Date(r.window_start).toISOString(),
    allowedCount: Number(r.allowed_count),
    blockedCount: Number(r.blocked_count),
  }));
}

const PURGE_BATCH_SIZE = 5000;

type DailyRateLimitAggregateRow = {
  route_key: string;
  allowed_count: bigint;
  blocked_count: bigint;
  unique_ip_count_approx: bigint | null;
};

type DealerRateLimitDailyRow = {
  day: string;
  routeKey: string;
  allowedCount: number;
  blockedCount: number;
  uniqueIpCountApprox: number | null;
};

type ListRateLimitDailyInput = {
  dateFrom: string;
  dateTo: string;
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

export async function purgeOldRateLimitEvents(input: { olderThanDays: number }): Promise<{ deletedCount: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - input.olderThanDays * 24 * 60 * 60 * 1000);
  let deletedCount = 0;

  for (;;) {
    const batch = await prisma.dealerRateLimitEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PURGE_BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const ids = batch.map((row) => row.id);
    const deleted = await prisma.dealerRateLimitEvent.deleteMany({
      where: { id: { in: ids } },
    });
    deletedCount += deleted.count;
  }

  return { deletedCount };
}

export async function aggregateRateLimitDaily(day?: string): Promise<{ day: string; upsertedCount: number }> {
  const dayStart = normalizeDayOrYesterday(day);
  const dayEnd = nextUtcDay(dayStart);
  const dayIso = dayStart.toISOString().slice(0, 10);

  const aggregates = await prisma.$queryRaw<DailyRateLimitAggregateRow[]>(Prisma.sql`
    SELECT
      route_key,
      count(*) FILTER (WHERE allowed = true)::bigint AS allowed_count,
      count(*) FILTER (WHERE allowed = false)::bigint AS blocked_count,
      count(DISTINCT ip_hash)::bigint AS unique_ip_count_approx
    FROM dealer_rate_limit_events
    WHERE created_at >= ${dayStart}::timestamptz
      AND created_at < ${dayEnd}::timestamptz
    GROUP BY route_key
  `);

  if (aggregates.length === 0) return { day: dayIso, upsertedCount: 0 };

  await prisma.$transaction(
    aggregates.map((row) =>
      prisma.dealerRateLimitStatsDaily.upsert({
        where: {
          day_routeKey: {
            day: dayStart,
            routeKey: row.route_key,
          },
        },
        create: {
          day: dayStart,
          routeKey: row.route_key,
          allowedCount: Number(row.allowed_count),
          blockedCount: Number(row.blocked_count),
          uniqueIpCountApprox:
            row.unique_ip_count_approx == null ? null : Number(row.unique_ip_count_approx),
        },
        update: {
          allowedCount: Number(row.allowed_count),
          blockedCount: Number(row.blocked_count),
          uniqueIpCountApprox:
            row.unique_ip_count_approx == null ? null : Number(row.unique_ip_count_approx),
          createdAt: new Date(),
        },
      })
    )
  );

  return { day: dayIso, upsertedCount: aggregates.length };
}

export async function listRateLimitDailyStats(
  input: ListRateLimitDailyInput
): Promise<{ items: DealerRateLimitDailyRow[]; total: number }> {
  const where = {
    day: {
      gte: new Date(`${input.dateFrom}T00:00:00.000Z`),
      lte: new Date(`${input.dateTo}T00:00:00.000Z`),
    },
  };

  const [rows, total] = await Promise.all([
    prisma.dealerRateLimitStatsDaily.findMany({
      where,
      orderBy: [{ day: "desc" }, { routeKey: "asc" }],
      take: input.limit,
      skip: input.offset,
    }),
    prisma.dealerRateLimitStatsDaily.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      routeKey: row.routeKey,
      allowedCount: row.allowedCount,
      blockedCount: row.blockedCount,
      uniqueIpCountApprox: row.uniqueIpCountApprox,
    })),
    total,
  };
}
