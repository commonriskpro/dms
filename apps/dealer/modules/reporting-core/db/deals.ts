/**
 * Read-only queries for dealer profit and salesperson reports.
 * CONTRACTED deals with dealFinance; scoped by dealershipId.
 */
import { prisma } from "@/lib/db";

const CONTRACTED = "CONTRACTED" as const;

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

export type DealWithFinanceRow = {
  id: string;
  salePriceCents: bigint;
  frontGrossCents: bigint;
  vehicleId: string;
  createdAt: Date;
  backendGrossCents: bigint;
};

/** CONTRACTED deals in [from, to] with backend gross. */
export async function listContractedDealsWithFinance(
  dealershipId: string,
  from: string,
  to: string
): Promise<DealWithFinanceRow[]> {
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
      salePriceCents: true,
      frontGrossCents: true,
      vehicleId: true,
      createdAt: true,
      dealFinance: {
        where: { deletedAt: null },
        select: { backendGrossCents: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return deals.map((d) => ({
    id: d.id,
    salePriceCents: d.salePriceCents,
    frontGrossCents: d.frontGrossCents,
    vehicleId: d.vehicleId,
    createdAt: d.createdAt,
    backendGrossCents: d.dealFinance?.backendGrossCents ?? BigInt(0),
  }));
}

export async function getFirstContractedHistoryByDeal(
  dealershipId: string,
  dealIds: string[]
): Promise<Map<string, { changedBy: string | null; createdAt: Date }>> {
  if (dealIds.length === 0) return new Map();
  const rows = await prisma.dealHistory.findMany({
    where: {
      dealershipId,
      dealId: { in: dealIds },
      toStatus: CONTRACTED,
    },
    select: { dealId: true, changedBy: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, { changedBy: string | null; createdAt: Date }>();
  for (const r of rows) {
    if (!map.has(r.dealId)) map.set(r.dealId, { changedBy: r.changedBy, createdAt: r.createdAt });
  }
  return map;
}

export async function getDisplayNamesForUserIds(
  userIds: string[]
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();
  const profiles = await prisma.profile.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  });
  return new Map(profiles.map((p) => [p.id, p.fullName ?? null]));
}
