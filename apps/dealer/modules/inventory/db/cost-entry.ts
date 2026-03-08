import { prisma } from "@/lib/db";
import type { VehicleCostCategory } from "@prisma/client";

export type CreateCostEntryInput = {
  dealershipId: string;
  vehicleId: string;
  category: VehicleCostCategory;
  amountCents: bigint;
  vendorName?: string | null;
  occurredAt: Date;
  memo?: string | null;
  createdByUserId: string;
};

export type UpdateCostEntryInput = {
  category?: VehicleCostCategory;
  amountCents?: bigint;
  vendorName?: string | null;
  occurredAt?: Date;
  memo?: string | null;
};

/** List cost entries for a vehicle (non-deleted only). */
export async function listCostEntriesByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.vehicleCostEntry.findMany({
    where: {
      dealershipId,
      vehicleId,
      deletedAt: null,
    },
    orderBy: { occurredAt: "desc" },
  });
}

export async function getCostEntryById(
  dealershipId: string,
  entryId: string
) {
  return prisma.vehicleCostEntry.findFirst({
    where: { id: entryId, dealershipId, deletedAt: null },
  });
}

export async function createCostEntry(data: CreateCostEntryInput) {
  return prisma.vehicleCostEntry.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      category: data.category,
      amountCents: data.amountCents,
      vendorName: data.vendorName ?? null,
      occurredAt: data.occurredAt,
      memo: data.memo ?? null,
      createdByUserId: data.createdByUserId,
    },
  });
}

export async function updateCostEntry(
  dealershipId: string,
  entryId: string,
  data: UpdateCostEntryInput
) {
  return prisma.vehicleCostEntry.updateMany({
    where: { id: entryId, dealershipId, deletedAt: null },
    data: {
      ...(data.category !== undefined && { category: data.category }),
      ...(data.amountCents !== undefined && { amountCents: data.amountCents }),
      ...(data.vendorName !== undefined && { vendorName: data.vendorName ?? null }),
      ...(data.occurredAt !== undefined && { occurredAt: data.occurredAt }),
      ...(data.memo !== undefined && { memo: data.memo ?? null }),
    },
  });
}

/** Soft-delete a cost entry. */
export async function deleteCostEntry(
  dealershipId: string,
  entryId: string,
  deletedBy: string
) {
  return prisma.vehicleCostEntry.updateMany({
    where: { id: entryId, dealershipId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy },
  });
}

export type VehicleCostTotals = {
  acquisitionSubtotalCents: bigint;
  transportCents: bigint;
  reconSubtotalCents: bigint;
  feesSubtotalCents: bigint;
  miscCents: bigint;
  totalInvestedCents: bigint;
};

const ACQUISITION = "acquisition";
const TRANSPORT = "transport";
const RECON_PARTS = "recon_parts";
const RECON_LABOR = "recon_labor";
const FEE_CATEGORIES = ["auction_fee", "title_fee", "doc_fee"] as const;
const MISC_CATEGORIES = ["detail", "inspection", "storage", "misc"] as const;

/** Derive cost totals from ledger entries for one vehicle. */
export async function getCostTotalsByVehicleId(
  dealershipId: string,
  vehicleId: string
): Promise<VehicleCostTotals> {
  const entries = await prisma.vehicleCostEntry.findMany({
    where: { dealershipId, vehicleId, deletedAt: null },
    select: { category: true, amountCents: true },
  });

  let acquisitionSubtotalCents = BigInt(0);
  let transportCents = BigInt(0);
  let reconSubtotalCents = BigInt(0);
  let feesSubtotalCents = BigInt(0);
  let miscCents = BigInt(0);

  for (const e of entries) {
    const amt = e.amountCents;
    switch (e.category) {
      case ACQUISITION:
        acquisitionSubtotalCents += amt;
        break;
      case TRANSPORT:
        transportCents += amt;
        break;
      case RECON_PARTS:
      case RECON_LABOR:
        reconSubtotalCents += amt;
        break;
      case "auction_fee":
      case "title_fee":
      case "doc_fee":
        feesSubtotalCents += amt;
        break;
      default:
        miscCents += amt;
        break;
    }
  }

  const totalInvestedCents =
    acquisitionSubtotalCents +
    transportCents +
    reconSubtotalCents +
    feesSubtotalCents +
    miscCents;

  return {
    acquisitionSubtotalCents,
    transportCents,
    reconSubtotalCents,
    feesSubtotalCents,
    miscCents,
    totalInvestedCents,
  };
}

/** Batch get cost totals for multiple vehicles (for list views). */
export async function getCostTotalsByVehicleIds(
  dealershipId: string,
  vehicleIds: string[]
): Promise<Map<string, VehicleCostTotals>> {
  if (vehicleIds.length === 0) return new Map();

  const entries = await prisma.vehicleCostEntry.findMany({
    where: {
      dealershipId,
      vehicleId: { in: vehicleIds },
      deletedAt: null,
    },
    select: { vehicleId: true, category: true, amountCents: true },
  });

  const map = new Map<string, VehicleCostTotals>();
  for (const id of vehicleIds) {
    map.set(id, {
      acquisitionSubtotalCents: BigInt(0),
      transportCents: BigInt(0),
      reconSubtotalCents: BigInt(0),
      feesSubtotalCents: BigInt(0),
      miscCents: BigInt(0),
      totalInvestedCents: BigInt(0),
    });
  }

  for (const e of entries) {
    const t = map.get(e.vehicleId)!;
    const amt = e.amountCents;
    switch (e.category) {
      case ACQUISITION:
        t.acquisitionSubtotalCents += amt;
        break;
      case TRANSPORT:
        t.transportCents += amt;
        break;
      case RECON_PARTS:
      case RECON_LABOR:
        t.reconSubtotalCents += amt;
        break;
      case "auction_fee":
      case "title_fee":
      case "doc_fee":
        t.feesSubtotalCents += amt;
        break;
      default:
        t.miscCents += amt;
        break;
    }
    t.totalInvestedCents =
      t.acquisitionSubtotalCents +
      t.transportCents +
      t.reconSubtotalCents +
      t.feesSubtotalCents +
      t.miscCents;
  }

  return map;
}
