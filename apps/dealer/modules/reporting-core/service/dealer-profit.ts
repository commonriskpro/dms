/**
 * Dealer profit report: profit per deal, per salesperson, per month; total gross/net.
 */
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import * as dealsDb from "../db/deals";

export type DealerProfitRow = {
  dealId: string;
  soldAt: string;
  salespersonId: string | null;
  salespersonName: string | null;
  frontGrossCents: string;
  backGrossCents: string;
  totalGrossCents: string;
  netProfitCents: string;
};

export type DealerProfitByMonth = {
  month: string;
  dealCount: number;
  totalGrossCents: string;
};

export type DealerProfitBySalesperson = {
  salespersonId: string | null;
  salespersonName: string | null;
  dealCount: number;
  totalGrossCents: string;
};

export type DealerProfitReport = {
  summary: {
    totalGrossCents: string;
    totalNetCents: string;
    dealCount: number;
  };
  byMonth: DealerProfitByMonth[];
  bySalesperson: DealerProfitBySalesperson[];
  rows: DealerProfitRow[];
};

export async function getDealerProfitReport(
  dealershipId: string,
  params: { from: string; to: string; salespersonId?: string | null }
): Promise<DealerProfitReport> {
  await requireTenantActiveForRead(dealershipId);
  const deals = await dealsDb.listContractedDealsWithFinance(
    dealershipId,
    params.from,
    params.to
  );
  const dealIds = deals.map((d) => d.id);
  const historyMap = await dealsDb.getFirstContractedHistoryByDeal(
    dealershipId,
    dealIds
  );

  const userIds = Array.from(
    new Set(
      deals.map((d) => historyMap.get(d.id)?.changedBy).filter(Boolean) as string[]
    )
  );
  const displayNames = await dealsDb.getDisplayNamesForUserIds(userIds);

  let rows: DealerProfitRow[] = deals.map((d) => {
    const totalGross = d.frontGrossCents + d.backendGrossCents;
    const changedBy = historyMap.get(d.id)?.changedBy ?? null;
    const name = changedBy ? displayNames.get(changedBy) ?? null : null;
    return {
      dealId: d.id,
      soldAt: d.createdAt.toISOString().slice(0, 10),
      salespersonId: changedBy,
      salespersonName: name,
      frontGrossCents: d.frontGrossCents.toString(),
      backGrossCents: d.backendGrossCents.toString(),
      totalGrossCents: totalGross.toString(),
      netProfitCents: totalGross.toString(),
    };
  });

  if (params.salespersonId != null && params.salespersonId !== "") {
    rows = rows.filter((r) => r.salespersonId === params.salespersonId);
  }

  const monthMap = new Map<string, { count: number; gross: bigint }>();
  const spMap = new Map<string, { count: number; gross: bigint }>();
  for (const d of deals) {
    const totalGross = d.frontGrossCents + d.backendGrossCents;
    if (params.salespersonId != null && params.salespersonId !== "") {
      const changedBy = historyMap.get(d.id)?.changedBy ?? null;
      if (changedBy !== params.salespersonId) continue;
    }
    const monthKey = d.createdAt.toISOString().slice(0, 7);
    const curM = monthMap.get(monthKey) ?? { count: 0, gross: BigInt(0) };
    curM.count += 1;
    curM.gross += totalGross;
    monthMap.set(monthKey, curM);

    const spKey = historyMap.get(d.id)?.changedBy ?? "__null__";
    const curSp = spMap.get(spKey) ?? { count: 0, gross: BigInt(0) };
    curSp.count += 1;
    curSp.gross += totalGross;
    spMap.set(spKey, curSp);
  }

  const byMonth: DealerProfitByMonth[] = Array.from(monthMap.entries())
    .map(([month, v]) => ({
      month,
      dealCount: v.count,
      totalGrossCents: v.gross.toString(),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const bySalesperson: DealerProfitBySalesperson[] = Array.from(spMap.entries()).map(
    ([key, v]) => ({
      salespersonId: key === "__null__" ? null : key,
      salespersonName: key === "__null__" ? null : displayNames.get(key) ?? null,
      dealCount: v.count,
      totalGrossCents: v.gross.toString(),
    })
  );

  const totalGross = rows.reduce(
    (sum, r) => sum + BigInt(r.totalGrossCents),
    BigInt(0)
  );

  return {
    summary: {
      totalGrossCents: totalGross.toString(),
      totalNetCents: totalGross.toString(),
      dealCount: rows.length,
    },
    byMonth,
    bySalesperson,
    rows,
  };
}
