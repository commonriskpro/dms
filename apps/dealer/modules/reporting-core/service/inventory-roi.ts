/**
 * Inventory ROI report: sold vehicles with purchase cost, recon, sale price, gross profit, days in stock.
 */
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import * as roiDb from "../db/inventory-roi";

export type InventoryRoiRow = {
  vehicleId: string;
  dealId: string;
  stockNumber: string;
  vin: string | null;
  purchaseCostCents: string;
  reconCostCents: string;
  salePriceCents: string;
  grossProfitCents: string;
  daysInStock: number;
  soldAt: string;
};

export type InventoryRoiReport = {
  summary: {
    totalPurchaseCostCents: string;
    totalSalePriceCents: string;
    totalGrossProfitCents: string;
    vehicleCount: number;
    avgDaysInStock: number;
  };
  rows: InventoryRoiRow[];
};

export async function getInventoryRoiReport(
  dealershipId: string,
  params: { from: string; to: string }
): Promise<InventoryRoiReport> {
  await requireTenantActiveForRead(dealershipId);
  const dbRows = await roiDb.listSoldVehiclesRoi(
    dealershipId,
    params.from,
    params.to
  );

  const rows: InventoryRoiRow[] = dbRows.map((r) => ({
    vehicleId: r.vehicleId,
    dealId: r.dealId,
    stockNumber: r.stockNumber,
    vin: r.vin,
    purchaseCostCents: r.purchaseCostCents.toString(),
    reconCostCents: r.reconCostCents.toString(),
    salePriceCents: r.salePriceCents.toString(),
    grossProfitCents: r.grossProfitCents.toString(),
    daysInStock: r.daysInStock,
    soldAt: r.soldAt.toISOString().slice(0, 10),
  }));

  const totalPurchase = dbRows.reduce((s, r) => s + r.purchaseCostCents, BigInt(0));
  const totalSale = dbRows.reduce((s, r) => s + r.salePriceCents, BigInt(0));
  const totalGross = dbRows.reduce((s, r) => s + r.grossProfitCents, BigInt(0));
  const avgDays =
    dbRows.length > 0
      ? Math.round(
          dbRows.reduce((s, r) => s + r.daysInStock, 0) / dbRows.length
        )
      : 0;

  return {
    summary: {
      totalPurchaseCostCents: totalPurchase.toString(),
      totalSalePriceCents: totalSale.toString(),
      totalGrossProfitCents: totalGross.toString(),
      vehicleCount: rows.length,
      avgDaysInStock: avgDays,
    },
    rows,
  };
}
