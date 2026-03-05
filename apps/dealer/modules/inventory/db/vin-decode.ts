import { prisma } from "@/lib/db";

export type VinDecodeCreateInput = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  bodyStyle?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  manufacturedIn?: string | null;
  rawJson?: unknown;
};

export async function createVinDecode(data: VinDecodeCreateInput) {
  return prisma.vehicleVinDecode.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      vin: data.vin,
      make: data.make ?? undefined,
      model: data.model ?? undefined,
      year: data.year ?? undefined,
      trim: data.trim ?? undefined,
      bodyStyle: data.bodyStyle ?? undefined,
      engine: data.engine ?? undefined,
      drivetrain: data.drivetrain ?? undefined,
      transmission: data.transmission ?? undefined,
      fuelType: data.fuelType ?? undefined,
      manufacturedIn: data.manufacturedIn ?? undefined,
      rawJson: data.rawJson ? (data.rawJson as object) : undefined,
    },
  });
}

export async function getLatestByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.vehicleVinDecode.findFirst({
    where: { dealershipId, vehicleId },
    orderBy: { decodedAt: "desc" },
  });
}

export async function listByVehicleId(
  dealershipId: string,
  vehicleId: string,
  limit: number,
  offset: number
) {
  return prisma.vehicleVinDecode.findMany({
    where: { dealershipId, vehicleId },
    orderBy: { decodedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getTotalByVehicleId(
  dealershipId: string,
  vehicleId: string
): Promise<number> {
  return prisma.vehicleVinDecode.count({
    where: { dealershipId, vehicleId },
  });
}
