/**
 * Inventory aging: byStatus counts, daysInInventory, aging buckets, total value (sum of cost cents), total list (salePriceCents).
 * BigInt for money; exclude deletedAt.
 */
import * as reportsDb from "../db/inventory";

export type InventoryAgingParams = {
  dealershipId: string;
  asOf?: string;
  timezone?: string;
};

export type InventoryAgingResult = {
  byStatus: Array<{ status: string; count: number }>;
  averageDaysInInventory: number;
  agingBuckets: {
    bucket0_15: number;
    bucket16_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90Plus: number;
  };
  totalInventoryValueCents: string;
  totalListPriceCents?: string;
};

export function computeAgingBuckets(daysList: number[]): {
  bucket0_15: number;
  bucket16_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
} {
  let bucket0_15 = 0;
  let bucket16_30 = 0;
  let bucket31_60 = 0;
  let bucket61_90 = 0;
  let bucket90Plus = 0;
  for (const d of daysList) {
    if (d <= 15) bucket0_15 += 1;
    else if (d <= 30) bucket16_30 += 1;
    else if (d <= 60) bucket31_60 += 1;
    else if (d <= 90) bucket61_90 += 1;
    else bucket90Plus += 1;
  }
  return {
    bucket0_15,
    bucket16_30,
    bucket31_60,
    bucket61_90,
    bucket90Plus,
  };
}

export async function getInventoryAging(params: InventoryAgingParams): Promise<InventoryAgingResult> {
  const { dealershipId, asOf } = params;
  const asOfDate = asOf ? new Date(asOf) : new Date();

  const [byStatus, vehicles] = await Promise.all([
    reportsDb.countVehiclesByStatus(dealershipId),
    reportsDb.listVehiclesForAging(dealershipId),
  ]);

  const asOfTime = asOfDate.getTime();
  const daysList: number[] = [];
  let totalInventoryValueCents = BigInt(0);
  let totalListPriceCents = BigInt(0);

  for (const v of vehicles) {
    const createdTime = v.createdAt.getTime();
    const days = Math.floor((asOfTime - createdTime) / (24 * 60 * 60 * 1000));
    daysList.push(days);

    const costCents =
      v.auctionCostCents +
      v.transportCostCents +
      v.reconCostCents +
      v.miscCostCents;
    totalInventoryValueCents += costCents;
    totalListPriceCents += v.salePriceCents;
  }

  const averageDaysInInventory =
    daysList.length > 0
      ? Math.round(
          daysList.reduce((a, b) => a + b, 0) / daysList.length
        )
      : 0;

  const agingBuckets = computeAgingBuckets(daysList);

  return {
    byStatus,
    averageDaysInInventory,
    agingBuckets,
    totalInventoryValueCents: totalInventoryValueCents.toString(),
    totalListPriceCents:
      totalListPriceCents > BigInt(0) ? totalListPriceCents.toString() : undefined,
  };
}
