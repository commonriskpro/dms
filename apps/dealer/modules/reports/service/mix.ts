/**
 * Cash vs finance mix: group CONTRACTED deals by financingMode (DealFinance).
 * No row => UNKNOWN. Money as string cents.
 */
import * as reportsFinanceDb from "../db/finance";
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

export type MixParams = {
  dealershipId: string;
  from: string;
  to: string;
  timezone?: string;
};

export type MixMode = "CASH" | "FINANCE" | "UNKNOWN";

export type MixResult = {
  byMode: Array<{
    financingMode: MixMode;
    dealCount: number;
    saleVolumeCents: string;
    frontGrossCents: string;
    averageGrossCents: string;
  }>;
};

export async function getMix(params: MixParams): Promise<MixResult> {
  const { dealershipId, from, to } = params;
  const cacheKey = reportKey(dealershipId, "mix", paramsHash({ from, to }));

  return withCache(cacheKey, 30, async () => {
    return loadMix(dealershipId, from, to);
  });
}

async function loadMix(dealershipId: string, from: string, to: string): Promise<MixResult> {
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);

  const rows = await reportsFinanceDb.listContractedDealsWithFinanceForMix(
    dealershipId,
    fromDate,
    toDate
  );

  const byMode = new Map<
    MixMode,
    { saleVolumeCents: bigint; frontGrossCents: bigint; count: number }
  >();
  byMode.set("CASH", { saleVolumeCents: BigInt(0), frontGrossCents: BigInt(0), count: 0 });
  byMode.set("FINANCE", { saleVolumeCents: BigInt(0), frontGrossCents: BigInt(0), count: 0 });
  byMode.set("UNKNOWN", { saleVolumeCents: BigInt(0), frontGrossCents: BigInt(0), count: 0 });

  for (const r of rows) {
    const mode: MixMode =
      r.financingMode === "CASH"
        ? "CASH"
        : r.financingMode === "FINANCE"
          ? "FINANCE"
          : "UNKNOWN";
    const cur = byMode.get(mode)!;
    cur.saleVolumeCents += r.salePriceCents;
    cur.frontGrossCents += r.frontGrossCents;
    cur.count += 1;
  }

  const byModeArray: MixResult["byMode"] = Array.from(byMode.entries()).map(
    ([financingMode, agg]) => ({
      financingMode,
      dealCount: agg.count,
      saleVolumeCents: agg.saleVolumeCents.toString(),
      frontGrossCents: agg.frontGrossCents.toString(),
      averageGrossCents:
        agg.count > 0
          ? (agg.frontGrossCents / BigInt(agg.count)).toString()
          : "0",
    })
  );

  return { byMode: byModeArray };
}

