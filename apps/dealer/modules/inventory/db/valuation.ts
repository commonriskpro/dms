import { prisma } from "@/lib/db";

export type ValuationCreateInput = {
  dealershipId: string;
  vehicleId: string;
  source: string;
  valueCents: number;
  condition?: string | null;
  odometer?: number | null;
};

export async function createValuation(data: ValuationCreateInput) {
  return prisma.vehicleValuation.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      source: data.source,
      valueCents: data.valueCents,
      condition: data.condition ?? undefined,
      odometer: data.odometer ?? undefined,
    },
  });
}

export async function listByVehicleId(
  dealershipId: string,
  vehicleId: string,
  limit: number,
  offset: number,
  source?: string
) {
  const where: { dealershipId: string; vehicleId: string; source?: string } = {
    dealershipId,
    vehicleId,
  };
  if (source) where.source = source;
  return prisma.vehicleValuation.findMany({
    where,
    orderBy: { capturedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getTotalByVehicleId(
  dealershipId: string,
  vehicleId: string,
  source?: string
): Promise<number> {
  const where: { dealershipId: string; vehicleId: string; source?: string } = {
    dealershipId,
    vehicleId,
  };
  if (source) where.source = source;
  return prisma.vehicleValuation.count({ where });
}
