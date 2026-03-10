import { prisma } from "@/lib/db";

export type VehicleMarketValuationCreateInput = {
  vehicleId: string;
  marketAverageCents: number;
  marketLowestCents: number;
  marketHighestCents: number;
  recommendedRetailCents: number;
  recommendedWholesaleCents: number;
  priceToMarketPercent?: number | null;
  marketDaysSupply?: number | null;
};

export async function getLatestVehicleMarketValuation(dealershipId: string, vehicleId: string) {
  return prisma.vehicleMarketValuation.findFirst({
    where: { dealershipId, vehicleId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createVehicleMarketValuation(
  dealershipId: string,
  data: VehicleMarketValuationCreateInput
) {
  return prisma.vehicleMarketValuation.create({
    data: {
      dealershipId,
      vehicleId: data.vehicleId,
      marketAverageCents: data.marketAverageCents,
      marketLowestCents: data.marketLowestCents,
      marketHighestCents: data.marketHighestCents,
      recommendedRetailCents: data.recommendedRetailCents,
      recommendedWholesaleCents: data.recommendedWholesaleCents,
      priceToMarketPercent: data.priceToMarketPercent ?? null,
      marketDaysSupply: data.marketDaysSupply ?? null,
    },
  });
}

/** Latest valuation rows for a set of vehicles (one row per vehicle when present). */
export async function getLatestVehicleMarketValuationsForVehicles(
  dealershipId: string,
  vehicleIds: string[]
) {
  if (vehicleIds.length === 0) {
    return new Map<string, Awaited<ReturnType<typeof getLatestVehicleMarketValuation>>>();
  }
  const rows = await prisma.vehicleMarketValuation.findMany({
    where: {
      dealershipId,
      vehicleId: { in: vehicleIds },
    },
    orderBy: [{ vehicleId: "asc" }, { createdAt: "desc" }],
    distinct: ["vehicleId"],
  });
  return new Map(rows.map((row) => [row.vehicleId, row]));
}

export async function hasAnyVehicleMarketValuation(dealershipId: string): Promise<boolean> {
  const row = await prisma.vehicleMarketValuation.findFirst({
    where: { dealershipId },
    select: { id: true },
  });
  return Boolean(row);
}
