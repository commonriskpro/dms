/**
 * Sold vehicles (CONTRACTED deals) with vehicle cost for ROI.
 */
import { prisma } from "@/lib/db";
import { totalCostCents } from "@/modules/inventory/service/vehicle";

const CONTRACTED = "CONTRACTED";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateStart(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateEnd(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type InventoryRoiRow = {
  vehicleId: string;
  dealId: string;
  stockNumber: string;
  vin: string | null;
  purchaseCostCents: bigint;
  reconCostCents: bigint;
  salePriceCents: bigint;
  grossProfitCents: bigint;
  daysInStock: number;
  soldAt: Date;
};

/** CONTRACTED deals in [from, to] with vehicle; one row per deal (one vehicle per deal). */
export async function listSoldVehiclesRoi(
  dealershipId: string,
  from: string,
  to: string
): Promise<InventoryRoiRow[]> {
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);
  const deals = await prisma.deal.findMany({
    where: {
      dealershipId,
      status: CONTRACTED,
      deletedAt: null,
      createdAt: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      vehicleId: true,
      salePriceCents: true,
      createdAt: true,
      vehicle: {
        select: {
          id: true,
          stockNumber: true,
          vin: true,
          auctionCostCents: true,
          transportCostCents: true,
          reconCostCents: true,
          miscCostCents: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: InventoryRoiRow[] = [];
  for (const d of deals) {
    if (!d.vehicle) continue;
    const v = d.vehicle;
    const purchaseCostCents = totalCostCents({
      auctionCostCents: v.auctionCostCents,
      transportCostCents: v.transportCostCents,
      reconCostCents: v.reconCostCents,
      miscCostCents: v.miscCostCents,
    });
    const salePriceCents = d.salePriceCents;
    const grossProfitCents = salePriceCents - purchaseCostCents;
    const daysInStock = Math.max(
      0,
      Math.floor((d.createdAt.getTime() - v.createdAt.getTime()) / MS_PER_DAY)
    );
    rows.push({
      vehicleId: v.id,
      dealId: d.id,
      stockNumber: v.stockNumber,
      vin: v.vin,
      purchaseCostCents,
      reconCostCents: v.reconCostCents,
      salePriceCents,
      grossProfitCents,
      daysInStock,
      soldAt: d.createdAt,
    });
  }
  return rows;
}
