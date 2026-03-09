import { prisma } from "@/lib/db";
import type { AuctionProvider } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type AuctionSearchFilters = {
  provider?: AuctionProvider;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
};

export type AuctionListingCacheCreateInput = {
  provider: AuctionProvider;
  auctionLotId: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  currentBidCents?: bigint | null;
  buyNowCents?: bigint | null;
  auctionEndAt?: Date | null;
  location?: string | null;
  rawJson?: Prisma.JsonValue;
};

export async function upsertAuctionListingCache(
  dealershipId: string,
  data: AuctionListingCacheCreateInput
) {
  const existing = await prisma.auctionListingCache.findFirst({
    where: {
      dealershipId,
      provider: data.provider,
      auctionLotId: data.auctionLotId,
    },
  });
  if (existing) {
    return prisma.auctionListingCache.update({
      where: { id: existing.id },
      data: {
        vin: data.vin ?? null,
        year: data.year ?? null,
        make: data.make ?? null,
        model: data.model ?? null,
        mileage: data.mileage ?? null,
        currentBidCents: data.currentBidCents ?? null,
        buyNowCents: data.buyNowCents ?? null,
        auctionEndAt: data.auctionEndAt ?? null,
        location: data.location ?? null,
        rawJson: data.rawJson ?? undefined,
      },
    });
  }
  return prisma.auctionListingCache.create({
    data: {
      dealershipId,
      provider: data.provider,
      auctionLotId: data.auctionLotId,
      vin: data.vin ?? null,
      year: data.year ?? null,
      make: data.make ?? null,
      model: data.model ?? null,
      mileage: data.mileage ?? null,
      currentBidCents: data.currentBidCents ?? null,
      buyNowCents: data.buyNowCents ?? null,
      auctionEndAt: data.auctionEndAt ?? null,
      location: data.location ?? null,
      rawJson: data.rawJson ?? undefined,
    },
  });
}

export async function searchAuctionListingCache(
  dealershipId: string,
  filters: AuctionSearchFilters,
  limit: number
) {
  const take = Math.min(limit, 100);
  const where: Prisma.AuctionListingCacheWhereInput = { dealershipId };
  if (filters.provider) where.provider = filters.provider;
  if (filters.vin?.trim()) where.vin = { contains: filters.vin.trim(), mode: "insensitive" };
  if (filters.make?.trim()) where.make = { contains: filters.make.trim(), mode: "insensitive" };
  if (filters.model?.trim()) where.model = { contains: filters.model.trim(), mode: "insensitive" };
  if (filters.year != null) where.year = filters.year;
  return prisma.auctionListingCache.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function getAuctionListingCacheById(dealershipId: string, id: string) {
  return prisma.auctionListingCache.findFirst({
    where: { id, dealershipId },
  });
}
