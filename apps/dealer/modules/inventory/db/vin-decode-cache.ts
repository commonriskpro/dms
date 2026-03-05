import { prisma } from "@/lib/db";

export type VinDecodeCacheCreateInput = {
  dealershipId: string;
  vin: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  bodyStyle?: string | null;
  engine?: string | null;
  fuelType?: string | null;
  driveType?: string | null;
  transmission?: string | null;
  source: string;
  rawJson?: unknown;
};

export async function findCached(
  dealershipId: string,
  vin: string,
  decodedAfter: Date
) {
  return prisma.vinDecodeCache.findFirst({
    where: {
      dealershipId,
      vin,
      decodedAt: { gte: decodedAfter },
    },
  });
}

export async function upsertCache(data: VinDecodeCacheCreateInput) {
  return prisma.vinDecodeCache.upsert({
    where: {
      dealershipId_vin: { dealershipId: data.dealershipId, vin: data.vin },
    },
    create: {
      dealershipId: data.dealershipId,
      vin: data.vin,
      year: data.year ?? undefined,
      make: data.make ?? undefined,
      model: data.model ?? undefined,
      trim: data.trim ?? undefined,
      bodyStyle: data.bodyStyle ?? undefined,
      engine: data.engine ?? undefined,
      fuelType: data.fuelType ?? undefined,
      driveType: data.driveType ?? undefined,
      transmission: data.transmission ?? undefined,
      source: data.source,
      rawJson: data.rawJson ? (data.rawJson as object) : undefined,
    },
    update: {
      year: data.year ?? undefined,
      make: data.make ?? undefined,
      model: data.model ?? undefined,
      trim: data.trim ?? undefined,
      bodyStyle: data.bodyStyle ?? undefined,
      engine: data.engine ?? undefined,
      fuelType: data.fuelType ?? undefined,
      driveType: data.driveType ?? undefined,
      transmission: data.transmission ?? undefined,
      source: data.source,
      rawJson: data.rawJson ? (data.rawJson as object) : undefined,
      decodedAt: new Date(),
    },
  });
}
