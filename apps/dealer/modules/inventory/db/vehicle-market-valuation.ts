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
