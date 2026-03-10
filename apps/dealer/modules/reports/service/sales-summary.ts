/**
 * Sales summary report: totals, averages, optional groupBy (salesperson, location, leadSource).
 * CONTRACTED only; CANCELED and deletedAt excluded. Money as string cents.
 */
import * as reportsDb from "../db/sales";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { reportKey, paramsHash } from "@/lib/infrastructure/cache/cacheKeys";
import { MS_PER_DAY } from "@/lib/db/date-utils";
import { logger } from "@/lib/logger";

const reportsPerfProfileEnabled = process.env.REPORTS_PERF_PROFILE === "1";

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

type DealAgg = { saleVolumeCents: bigint; frontGrossCents: bigint; count: number };

function groupDealsByKey<T extends { salePriceCents: bigint; frontGrossCents: bigint }>(
  deals: T[],
  getKey: (d: T) => string
): Map<string, DealAgg> {
  const map = new Map<string, DealAgg>();
  for (const d of deals) {
    const key = getKey(d);
    const cur = map.get(key) ?? { saleVolumeCents: BigInt(0), frontGrossCents: BigInt(0), count: 0 };
    cur.saleVolumeCents += d.salePriceCents;
    cur.frontGrossCents += d.frontGrossCents;
    cur.count += 1;
    map.set(key, cur);
  }
  return map;
}

export type SalesSummaryParams = {
  dealershipId: string;
  from: string;
  to: string;
  groupBy?: "none" | "salesperson" | "location" | "leadSource";
  timezone?: string;
};

export type SalesSummaryResult = {
  totalDealsCount: number;
  totalSaleVolumeCents: string;
  totalFrontGrossCents: string;
  averageFrontGrossCents: string;
  averageDaysToClose: number | null;
  breakdown?: {
    bySalesperson?: Array<{
      userId: string | null;
      displayName: string | null;
      dealCount: number;
      saleVolumeCents: string;
      frontGrossCents: string;
    }>;
    byLocation?: Array<{
      locationId: string | null;
      locationName: string | null;
      dealCount: number;
      saleVolumeCents: string;
      frontGrossCents: string;
    }>;
    byLeadSource?: Array<{
      leadSource: string | null;
      dealCount: number;
      saleVolumeCents: string;
      frontGrossCents: string;
    }>;
  };
};

export async function getSalesSummary(params: SalesSummaryParams): Promise<SalesSummaryResult> {
  const { dealershipId, from, to, groupBy = "none" } = params;
  return withCache(
    reportKey(dealershipId, "sales-summary", paramsHash({ from, to, groupBy })),
    60,
    () => computeSalesSummary(params)
  );
}

async function computeSalesSummary(params: SalesSummaryParams): Promise<SalesSummaryResult> {
  const { dealershipId, from, to, groupBy = "none" } = params;
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);
  const startedAt = Date.now();

  const dealsStartedAt = Date.now();
  const deals = await reportsDb.listContractedDealsInRange(dealershipId, fromDate, toDate);
  const dealsMs = Date.now() - dealsStartedAt;
  const historyStartedAt = Date.now();
  const firstContractedMap = await reportsDb.getFirstContractedHistoryByDeal(
    dealershipId,
    deals.map((d) => d.id)
  );
  const historyMs = Date.now() - historyStartedAt;

  const totalDealsCount = deals.length;
  let totalSaleVolumeCents = BigInt(0);
  let totalFrontGrossCents = BigInt(0);
  let totalDaysToClose = 0;
  let daysToCloseCount = 0;

  for (const d of deals) {
    totalSaleVolumeCents += d.salePriceCents;
    totalFrontGrossCents += d.frontGrossCents;
    const first = firstContractedMap.get(d.id);
    if (first) {
      const days =
        (first.createdAt.getTime() - d.createdAt.getTime()) / MS_PER_DAY;
      totalDaysToClose += days;
      daysToCloseCount += 1;
    }
  }

  // HALF_UP rounding: (total*2 + count) / (2*count) gives round(total/count) in integer math
  const averageFrontGrossCents =
    totalDealsCount > 0
      ? (totalFrontGrossCents * BigInt(2) + BigInt(totalDealsCount)) /
        (BigInt(2) * BigInt(totalDealsCount))
      : BigInt(0);
  const averageDaysToClose =
    daysToCloseCount > 0 ? Math.round((totalDaysToClose / daysToCloseCount) * 10) / 10 : null;

  const result: SalesSummaryResult = {
    totalDealsCount,
    totalSaleVolumeCents: totalSaleVolumeCents.toString(),
    totalFrontGrossCents: totalFrontGrossCents.toString(),
    averageFrontGrossCents: averageFrontGrossCents.toString(),
    averageDaysToClose,
  };

  if (groupBy !== "none" && totalDealsCount > 0) {
    const breakdownStartedAt = Date.now();
    if (groupBy === "salesperson") {
      const byUser = groupDealsByKey(deals, (d) => firstContractedMap.get(d.id)?.changedBy ?? "__null__");
      const userIds = Array.from(byUser.keys()).filter((k) => k !== "__null__");
      const displayNames = await reportsDb.getDisplayNamesForUserIds(userIds);
      result.breakdown = {
        bySalesperson: Array.from(byUser.entries()).map(([key, agg]) => ({
          userId: key === "__null__" ? null : key,
          displayName: key === "__null__" ? null : displayNames.get(key) ?? null,
          dealCount: agg.count,
          saleVolumeCents: agg.saleVolumeCents.toString(),
          frontGrossCents: agg.frontGrossCents.toString(),
        })),
      };
    } else if (groupBy === "location") {
      const vehicleIds = [...new Set(deals.map((d) => d.vehicleId))];
      const locationMap = await reportsDb.getLocationByVehicleId(dealershipId, vehicleIds);
      const byLoc = new Map<
        string,
        { locationId: string | null; locationName: string | null; saleVolumeCents: bigint; frontGrossCents: bigint; count: number }
      >();
      for (const d of deals) {
        const loc = locationMap.get(d.vehicleId);
        const locationId = loc?.locationId ?? null;
        const locationName = loc?.locationName ?? null;
        const key = locationId ?? "__null__";
        const cur = byLoc.get(key);
        if (cur) {
          cur.saleVolumeCents += d.salePriceCents;
          cur.frontGrossCents += d.frontGrossCents;
          cur.count += 1;
        } else {
          byLoc.set(key, { locationId, locationName, saleVolumeCents: d.salePriceCents, frontGrossCents: d.frontGrossCents, count: 1 });
        }
      }
      result.breakdown = {
        byLocation: Array.from(byLoc.values()).map((v) => ({
          locationId: v.locationId,
          locationName: v.locationName,
          dealCount: v.count,
          saleVolumeCents: v.saleVolumeCents.toString(),
          frontGrossCents: v.frontGrossCents.toString(),
        })),
      };
    } else if (groupBy === "leadSource") {
      const customerIds = [...new Set(deals.map((d) => d.customerId))];
      const leadSourceMap = await reportsDb.getLeadSourceByCustomerId(dealershipId, customerIds);
      const bySource = groupDealsByKey(deals, (d) => leadSourceMap.get(d.customerId) ?? "__null__");
      result.breakdown = {
        byLeadSource: Array.from(bySource.entries()).map(([key, agg]) => ({
          leadSource: key === "__null__" ? null : key,
          dealCount: agg.count,
          saleVolumeCents: agg.saleVolumeCents.toString(),
          frontGrossCents: agg.frontGrossCents.toString(),
        })),
      };
    }
    if (reportsPerfProfileEnabled) {
      logger.debug("reports.sales_summary.breakdown_profile", {
        dealershipIdTail: dealershipId.slice(-6),
        groupBy,
        breakdownMs: Date.now() - breakdownStartedAt,
      });
    }
  }

  if (reportsPerfProfileEnabled) {
    logger.debug("reports.sales_summary.profile", {
      dealershipIdTail: dealershipId.slice(-6),
      groupBy,
      dealsCount: deals.length,
      contractedHistoryCount: firstContractedMap.size,
      dealsMs,
      historyMs,
      totalMs: Date.now() - startedAt,
    });
  }

  return result;
}
