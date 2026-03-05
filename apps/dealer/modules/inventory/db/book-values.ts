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
