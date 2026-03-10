/**
 * Read-only queries for sales reports: CONTRACTED deals in date range, DealHistory for salesperson/days-to-close.
 * All scoped by dealershipId; excluded deletedAt and CANCELED.
 */
import { prisma } from "@/lib/db";

const CONTRACTED = "CONTRACTED" as const;

export type ContractedDealRow = {
  id: string;
  salePriceCents: bigint;
  frontGrossCents: bigint;
  customerId: string;
  vehicleId: string;
  createdAt: Date;
};

/** CONTRACTED deals in [from, to], deletedAt null. */
export async function listContractedDealsInRange(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<ContractedDealRow[]> {
  return prisma.deal.findMany({
    where: {
      dealershipId,
      status: CONTRACTED,
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      salePriceCents: true,
      frontGrossCents: true,
      customerId: true,
      vehicleId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/** First DealHistory row per deal where toStatus = CONTRACTED (for days-to-close and changedBy). */
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

/** Lead source per customer (for groupBy leadSource). */
export async function getLeadSourceByCustomerId(
  dealershipId: string,
  customerIds: string[]
): Promise<Map<string, string | null>> {
  if (customerIds.length === 0) return new Map();
  const customers = await prisma.customer.findMany({
    where: { dealershipId, id: { in: customerIds } },
    select: { id: true, leadSource: true },
  });
  return new Map(customers.map((c) => [c.id, c.leadSource ?? null]));
}

/** Location id and name per vehicle (for groupBy location). */
export async function getLocationByVehicleId(
  dealershipId: string,
  vehicleIds: string[]
): Promise<Map<string, { locationId: string | null; locationName: string | null }>> {
  if (vehicleIds.length === 0) return new Map();
  const vehicles = await prisma.vehicle.findMany({
    where: { dealershipId, id: { in: vehicleIds } },
    select: {
      id: true,
      locationId: true,
      location: { select: { name: true } },
    },
  });
  return new Map(
    vehicles.map((v) => [
      v.id,
      {
        locationId: v.locationId,
        locationName: v.location?.name ?? null,
      },
    ])
  );
}

/** Deal counts by status for pipeline. */
export async function countDealsByStatus(dealershipId: string, from: Date, to: Date) {
  const where = {
    dealershipId,
    deletedAt: null,
    createdAt: { gte: from, lte: to },
  };
  const counts = await prisma.deal.groupBy({
    by: ["status"],
    where,
    _count: { id: true },
  });
  return counts.map((c) => ({ status: c.status, count: c._count.id }));
}

/** CONTRACTED count grouped by day or week (date truncation) for trend. */
export async function contractedCountByPeriod(
  dealershipId: string,
  from: Date,
  to: Date,
  groupBy: "day" | "week"
) {
  const historyWhere = {
    dealershipId,
    toStatus: CONTRACTED,
    createdAt: { gte: from, lte: to },
  };
  const rows = await prisma.dealHistory.findMany({
    where: historyWhere,
    select: { dealId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    distinct: ["dealId"],
  });
  const periods = new Map<string, number>();
  for (const row of rows) {
    const date = row.createdAt;
    const key =
      groupBy === "day"
        ? date.toISOString().slice(0, 10)
        : getWeekKey(date);
    periods.set(key, (periods.get(key) ?? 0) + 1);
  }
  return Array.from(periods.entries())
    .map(([period, contractedCount]) => ({ period, contractedCount }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function getWeekKey(d: Date): string {
  const start = new Date(d);
  const day = start.getUTCDay();
  const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1);
  start.setUTCDate(diff);
  return start.toISOString().slice(0, 10);
}

/** For export: CONTRACTED deals in range with customer name and finance mode. */
export async function listContractedDealsForExport(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<
  Array<{
    id: string;
    createdAt: Date;
    salePriceCents: bigint;
    frontGrossCents: bigint;
    customerName: string;
    financingMode: string | null;
  }>
> {
  const deals = await prisma.deal.findMany({
    where: {
      dealershipId,
      status: CONTRACTED,
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      createdAt: true,
      salePriceCents: true,
      frontGrossCents: true,
      customer: { select: { name: true } },
      dealFinance: {
        where: { deletedAt: null },
        select: { financingMode: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return deals.map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    salePriceCents: d.salePriceCents,
    frontGrossCents: d.frontGrossCents,
    customerName: d.customer.name,
    financingMode: d.dealFinance?.financingMode ?? null,
  }));
}

/** Display names for user IDs (Profile.fullName). */
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
