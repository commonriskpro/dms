/**
 * Finance penetration: CONTRACTED deals in range; join DealFinance.
 * financedCount = financingMode FINANCE; penetration %; average APR/term; products and backend gross.
 * Missing finance row = not financed. Money as string cents.
 */
import * as reportsDb from "../db/sales";
import * as reportsFinanceDb from "../db/finance";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { reportKey, paramsHash } from "@/lib/infrastructure/cache/cacheKeys";
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

export type FinancePenetrationParams = {
  dealershipId: string;
  from: string;
  to: string;
  timezone?: string;
};

export type FinancePenetrationResult = {
  contractedCount: number;
  financedCount: number;
  financePenetrationPercent: number;
  averageAprBps: number | null;
  averageTermMonths: number | null;
  totalProductsSoldCents: string;
  totalBackendGrossCents: string;
  productsPenetrationPercent: number;
};

export function computePenetrationPercent(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export async function getFinancePenetration(
  params: FinancePenetrationParams
): Promise<FinancePenetrationResult> {
  return withCache(
    reportKey(params.dealershipId, "finance-penetration", paramsHash({ from: params.from, to: params.to })),
    60,
    () => computeFinancePenetration(params)
  );
}

async function computeFinancePenetration(
  params: FinancePenetrationParams
): Promise<FinancePenetrationResult> {
  const { dealershipId, from, to } = params;
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);
  const startedAt = Date.now();

  const readsStartedAt = Date.now();
  const [deals, finances] = await Promise.all([
    reportsDb.listContractedDealsInRange(dealershipId, fromDate, toDate),
    reportsFinanceDb.listFinanceForContractedDealsInRange(dealershipId, fromDate, toDate),
  ]);
  const readsMs = Date.now() - readsStartedAt;

  const contractedCount = deals.length;
  const financeByDeal = new Map(
    finances.map((f) => [f.dealId, f])
  );

  let financedCount = 0;
  let aprSum = 0;
  let aprCount = 0;
  let termSum = 0;
  let termCount = 0;
  let totalProductsSoldCents = BigInt(0);
  let totalBackendGrossCents = BigInt(0);
  let dealsWithProducts = 0;

  for (const f of finances) {
    if (f.financingMode === "FINANCE") financedCount += 1;
    if (f.aprBps != null) {
      aprSum += f.aprBps;
      aprCount += 1;
    }
    if (f.termMonths != null) {
      termSum += f.termMonths;
      termCount += 1;
    }
    totalProductsSoldCents += f.productsTotalCents;
    totalBackendGrossCents += f.backendGrossCents;
    if (f.productsTotalCents > BigInt(0)) dealsWithProducts += 1;
  }

  const financePenetrationPercent = computePenetrationPercent(
    financedCount,
    contractedCount
  );
  const productsPenetrationPercent = computePenetrationPercent(
    dealsWithProducts,
    contractedCount
  );
  const averageAprBps =
    aprCount > 0 ? Math.round(aprSum / aprCount) : null;
  const averageTermMonths =
    termCount > 0 ? Math.round(termSum / termCount) : null;

  if (reportsPerfProfileEnabled) {
    logger.debug("reports.finance_penetration.profile", {
      dealershipIdTail: dealershipId.slice(-6),
      contractedCount,
      financeRows: finances.length,
      readsMs,
      totalMs: Date.now() - startedAt,
    });
  }

  return {
    contractedCount,
    financedCount,
    financePenetrationPercent,
    averageAprBps,
    averageTermMonths,
    totalProductsSoldCents: totalProductsSoldCents.toString(),
    totalBackendGrossCents: totalBackendGrossCents.toString(),
    productsPenetrationPercent,
  };
}
