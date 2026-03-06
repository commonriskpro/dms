/**
 * Read-only queries for inventory aging: Vehicle counts by status, days in inventory, value (sum of cost cents).
 * All scoped by dealershipId; excluded deletedAt.
 */
import { prisma } from "@/lib/db";
import type { VehicleStatus } from "@prisma/client";

export type VehicleAgingRow = {
  id: string;
  status: string;
  createdAt: Date;
  salePriceCents: bigint;
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
};

/** All non-deleted vehicles for aging (asOf is applied in service for date truncation if needed). */
export async function listVehiclesForAging(dealershipId: string): Promise<VehicleAgingRow[]> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      salePriceCents: true,
      auctionCostCents: true,
      transportCostCents: true,
      reconCostCents: true,
      miscCostCents: true,
    },
  });
  return rows as VehicleAgingRow[];
}

/** For export: vehicles with vin, stockNumber, status, daysInInventory, purchaseValueCents (sum of cost cents). */
export async function listVehiclesForExport(
  dealershipId: string,
  asOf: Date,
  statusFilter?: VehicleStatus
): Promise<
  Array<{
    vin: string | null;
    stockNumber: string;
    status: string;
    daysInInventory: number;
    purchaseValueCents: string;
  }>
> {
  const where: { dealershipId: string; deletedAt: null; status?: VehicleStatus } = {
    dealershipId,
    deletedAt: null,
  };
  if (statusFilter) where.status = statusFilter;
  const rows = await prisma.vehicle.findMany({
    where,
    select: {
      vin: true,
      stockNumber: true,
      status: true,
      createdAt: true,
      auctionCostCents: true,
      transportCostCents: true,
      reconCostCents: true,
      miscCostCents: true,
    },
  });
  const asOfTime = asOf.getTime();
  return rows.map((v) => {
    const days = Math.floor(
      (asOfTime - v.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    const totalCostCents =
      v.auctionCostCents +
      v.transportCostCents +
      v.reconCostCents +
      v.miscCostCents;
    return {
      vin: v.vin,
      stockNumber: v.stockNumber,
      status: v.status,
      daysInInventory: days,
      purchaseValueCents: String(totalCostCents),
    };
  });
}

/** Count by status (same scope). */
export async function countVehiclesByStatus(
  dealershipId: string
): Promise<Array<{ status: string; count: number }>> {
  const counts = await prisma.vehicle.groupBy({
    by: ["status"],
    where: { dealershipId, deletedAt: null },
    _count: { id: true },
  });
  return counts.map((c) => ({ status: c.status, count: c._count.id }));
}
