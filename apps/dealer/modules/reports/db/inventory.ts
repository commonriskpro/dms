/**
 * Read-only queries for inventory aging: Vehicle counts by status, days in inventory, value (sum of cost cents).
 * All scoped by dealershipId; excluded deletedAt.
 */
import { prisma } from "@/lib/db";
import type { VehicleStatus } from "@prisma/client";
import { MS_PER_DAY } from "@/lib/db/date-utils";

export type VehicleAgingRow = {
  id: string;
  status: string;
  createdAt: Date;
  salePriceCents: bigint;
};

/** All non-deleted vehicles for aging (cost from ledger in service layer). */
export async function listVehiclesForAging(dealershipId: string): Promise<VehicleAgingRow[]> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      salePriceCents: true,
    },
  });
  return rows as VehicleAgingRow[];
}

/** For export: vehicles with id, vin, stockNumber, status, daysInInventory. purchaseValueCents supplied by caller from ledger. */
export async function listVehiclesForExport(
  dealershipId: string,
  asOf: Date,
  statusFilter?: VehicleStatus
): Promise<
  Array<{
    id: string;
    vin: string | null;
    stockNumber: string;
    status: string;
    daysInInventory: number;
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
      id: true,
      vin: true,
      stockNumber: true,
      status: true,
      createdAt: true,
    },
  });
  const asOfTime = asOf.getTime();
  return rows.map((v) => {
    const days = Math.floor((asOfTime - v.createdAt.getTime()) / MS_PER_DAY);
    return {
      id: v.id,
      vin: v.vin,
      stockNumber: v.stockNumber,
      status: v.status,
      daysInInventory: days,
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
