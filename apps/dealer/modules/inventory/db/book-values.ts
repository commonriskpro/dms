import { prisma } from "@/lib/db";

export type VehicleBookValueUpsertInput = {
  dealershipId: string;
  vehicleId: string;
  retailCents?: number | null;
  tradeInCents?: number | null;
  wholesaleCents?: number | null;
  auctionCents?: number | null;
  source: string;
};

export async function getByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.vehicleBookValue.findUnique({
    where: {
      dealershipId_vehicleId: { dealershipId, vehicleId },
    },
  });
}

/** Get map of vehicleId -> retailCents for all book values with retail in this dealership. */
export async function getRetailCentsMap(
  dealershipId: string
): Promise<Map<string, number>> {
  const rows = await prisma.vehicleBookValue.findMany({
    where: { dealershipId, retailCents: { not: null } },
    select: { vehicleId: true, retailCents: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.retailCents != null) map.set(r.vehicleId, r.retailCents);
  }
  return map;
}

export async function getRetailCentsMapForVehicleIds(
  dealershipId: string,
  vehicleIds: string[]
): Promise<Map<string, number>> {
  if (vehicleIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.vehicleBookValue.findMany({
    where: {
      dealershipId,
      vehicleId: { in: vehicleIds },
      retailCents: { not: null },
    },
    select: { vehicleId: true, retailCents: true },
  });

  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.retailCents != null) {
      map.set(r.vehicleId, r.retailCents);
    }
  }
  return map;
}

export async function upsertBookValues(data: VehicleBookValueUpsertInput) {
  return prisma.vehicleBookValue.upsert({
    where: {
      dealershipId_vehicleId: {
        dealershipId: data.dealershipId,
        vehicleId: data.vehicleId,
      },
    },
    create: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      retailCents: data.retailCents ?? undefined,
      tradeInCents: data.tradeInCents ?? undefined,
      wholesaleCents: data.wholesaleCents ?? undefined,
      auctionCents: data.auctionCents ?? undefined,
      source: data.source,
    },
    update: {
      retailCents: data.retailCents ?? undefined,
      tradeInCents: data.tradeInCents ?? undefined,
      wholesaleCents: data.wholesaleCents ?? undefined,
      auctionCents: data.auctionCents ?? undefined,
      source: data.source,
    },
  });
}
