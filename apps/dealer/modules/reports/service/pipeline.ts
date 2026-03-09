/**
 * Pipeline: count deals by status; optional trend (CONTRACTED grouped by day or week).
 */
import * as reportsDb from "../db/sales";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { reportKey, paramsHash } from "@/lib/infrastructure/cache/cacheKeys";

function toDateStart(isoDate: string): Date {
  const d = new Date(isoDate);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateEnd(isoDate: string): Date {
  const d = new Date(isoDate);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type PipelineParams = {
  dealershipId: string;
  from: string;
  to: string;
  groupBy?: "day" | "week";
  timezone?: string;
};

export type PipelineResult = {
  byStatus: Array<{ status: string; count: number }>;
  trend?: Array<{ period: string; contractedCount: number }>;
};

export async function getPipeline(params: PipelineParams): Promise<PipelineResult> {
  const { dealershipId, from, to, groupBy } = params;
  const cacheKey = reportKey(dealershipId, "pipeline", paramsHash({ from, to, groupBy }));

  return withCache(cacheKey, 30, async () => {
    const fromDate = toDateStart(from);
    const toDate = toDateEnd(to);

    const [byStatus, trendRows] = await Promise.all([
      reportsDb.countDealsByStatus(dealershipId, fromDate, toDate),
      groupBy
        ? reportsDb.contractedCountByPeriod(dealershipId, fromDate, toDate, groupBy)
        : Promise.resolve([]),
    ]);

    return {
      byStatus,
      ...(trendRows.length > 0 && {
        trend: trendRows.map((r) => ({
          period: r.period,
          contractedCount: r.contractedCount,
        })),
      }),
    };
  });
}
