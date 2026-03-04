/**
 * Sales by user: paginated breakdown by salesperson (DealHistory changedBy for CONTRACTED).
 * No history row => userId null. Money as string cents.
 */
import * as reportsDb from "../db/sales";

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

export type SalesByUserParams = {
  dealershipId: string;
  from: string;
  to: string;
  limit: number;
  offset: number;
  timezone?: string;
};

export type SalesByUserRow = {
  userId: string | null;
  displayName: string | null;
  dealCount: number;
  saleVolumeCents: string;
  frontGrossCents: string;
};

export type SalesByUserResult = {
  data: SalesByUserRow[];
  meta: { total: number; limit: number; offset: number };
};

export async function getSalesByUser(params: SalesByUserParams): Promise<SalesByUserResult> {
  const { dealershipId, from, to, limit, offset } = params;
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);

  const deals = await reportsDb.listContractedDealsInRange(dealershipId, fromDate, toDate);
  const firstContractedMap = await reportsDb.getFirstContractedHistoryByDeal(
    dealershipId,
    deals.map((d) => d.id)
  );

  const byUser = new Map<
    string,
    { saleVolumeCents: bigint; frontGrossCents: bigint; count: number }
  >();
  for (const d of deals) {
    const changedBy = firstContractedMap.get(d.id)?.changedBy ?? null;
    const key = changedBy ?? "__null__";
    const cur = byUser.get(key) ?? {
      saleVolumeCents: BigInt(0),
      frontGrossCents: BigInt(0),
      count: 0,
    };
    cur.saleVolumeCents += d.salePriceCents;
    cur.frontGrossCents += d.frontGrossCents;
    cur.count += 1;
    byUser.set(key, cur);
  }

  const userIds = Array.from(byUser.keys()).filter((k) => k !== "__null__");
  const displayNames = await reportsDb.getDisplayNamesForUserIds(userIds);

  const allRows: SalesByUserRow[] = Array.from(byUser.entries()).map(([key, agg]) => ({
    userId: key === "__null__" ? null : key,
    displayName: key === "__null__" ? null : displayNames.get(key) ?? null,
    dealCount: agg.count,
    saleVolumeCents: agg.saleVolumeCents.toString(),
    frontGrossCents: agg.frontGrossCents.toString(),
  }));

  const total = allRows.length;
  const data = allRows.slice(offset, offset + limit);

  return {
    data,
    meta: { total, limit, offset },
  };
}
