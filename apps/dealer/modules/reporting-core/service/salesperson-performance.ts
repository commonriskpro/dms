/**
 * Salesperson performance: deals closed, gross profit, average profit per deal.
 */
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import * as dealsDb from "../db/deals";

export type SalespersonPerformanceRow = {
  salespersonId: string | null;
  salespersonName: string | null;
  dealsClosed: number;
  grossProfitCents: string;
  averageProfitPerDealCents: string;
};

export type SalespersonPerformanceReport = {
  data: SalespersonPerformanceRow[];
  meta: { total: number; limit: number; offset: number };
};

export async function getSalespersonPerformance(
  dealershipId: string,
  params: { from: string; to: string; limit: number; offset: number }
): Promise<SalespersonPerformanceReport> {
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

  const byUser = new Map<
    string,
    { count: number; grossCents: bigint }
  >();
  for (const d of deals) {
    const totalGross = d.frontGrossCents + d.backendGrossCents;
    const key = historyMap.get(d.id)?.changedBy ?? "__null__";
    const cur = byUser.get(key) ?? { count: 0, grossCents: BigInt(0) };
    cur.count += 1;
    cur.grossCents += totalGross;
    byUser.set(key, cur);
  }

  const userIds = Array.from(byUser.keys()).filter((k) => k !== "__null__");
  const displayNames = await dealsDb.getDisplayNamesForUserIds(userIds);

  const allRows: SalespersonPerformanceRow[] = Array.from(byUser.entries()).map(
    ([key, v]) => ({
      salespersonId: key === "__null__" ? null : key,
      salespersonName: key === "__null__" ? null : displayNames.get(key) ?? null,
      dealsClosed: v.count,
      grossProfitCents: v.grossCents.toString(),
      averageProfitPerDealCents:
        v.count > 0 ? (v.grossCents / BigInt(v.count)).toString() : "0",
    })
  );

  const total = allRows.length;
  const start = Math.min(params.offset, total);
  const end = Math.min(params.offset + params.limit, total);
  const data = allRows.slice(start, end);

  return {
    data,
    meta: { total, limit: params.limit, offset: params.offset },
  };
}
