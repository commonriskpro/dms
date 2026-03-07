/**
 * Auction search and create appraisal from listing. MOCK provider only; results cached in AuctionListingCache.
 */
import type { AuctionProvider } from "@prisma/client";
import * as auctionCacheDb from "../db/auction-cache";
import * as appraisalDb from "../db/appraisal";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type AuctionSearchFilters = auctionCacheDb.AuctionSearchFilters;

/** MOCK provider: returns deterministic fake listings for testing. No external API. */
async function mockSearch(
  _dealershipId: string,
  filters: AuctionSearchFilters,
  limit: number
): Promise<auctionCacheDb.AuctionListingCacheCreateInput[]> {
  const list: auctionCacheDb.AuctionListingCacheCreateInput[] = [];
  const base = filters.vin ? 1 : 5;
  for (let i = 0; i < Math.min(base, limit); i++) {
    const suffix = filters.vin ? filters.vin.slice(-4) : String(i + 1);
    list.push({
      provider: "MOCK",
      auctionLotId: `MOCK-LOT-${suffix}-${Date.now()}`,
      vin: filters.vin ?? `1HGBH41JXMN${String(100000 + i).slice(0, 6)}`,
      year: filters.year ?? 2022,
      make: filters.make ?? "Honda",
      model: filters.model ?? "Accord",
      mileage: 35000 + i * 5000,
      currentBidCents: BigInt(1800000 + i * 100000),
      buyNowCents: BigInt(2100000 + i * 100000),
      auctionEndAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: "Mock Auction, TX",
      rawJson: { mock: true, lotId: `MOCK-LOT-${suffix}` },
    });
  }
  return list;
}

export async function searchAuctionListings(
  dealershipId: string,
  filters: AuctionSearchFilters,
  limit: number = 25
) {
  await requireTenantActiveForRead(dealershipId);
  const effectiveProvider: AuctionProvider = filters.provider ?? "MOCK";
  if (effectiveProvider !== "MOCK") {
    throw new ApiError("VALIDATION_ERROR", "Only MOCK auction provider is supported");
  }
  const results = await mockSearch(dealershipId, filters, Math.min(limit, 100));
  const cached = await Promise.all(
    results.map((r) => auctionCacheDb.upsertAuctionListingCache(dealershipId, r))
  );
  return cached;
}

export async function getAuctionListing(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const row = await auctionCacheDb.getAuctionListingCacheById(dealershipId, id);
  if (!row) throw new ApiError("NOT_FOUND", "Auction listing not found");
  return row;
}

/** Create VehicleAppraisal from a cached auction listing. */
export async function createAppraisalFromAuction(
  dealershipId: string,
  userId: string,
  auctionListingId: string
) {
  await requireTenantActiveForWrite(dealershipId);
  const listing = await auctionCacheDb.getAuctionListingCacheById(dealershipId, auctionListingId);
  if (!listing) throw new ApiError("NOT_FOUND", "Auction listing not found");
  const buyNow = listing.buyNowCents ?? listing.currentBidCents ?? BigInt(0);
  const acquisitionCostCents = buyNow;
  const expectedRetailCents = BigInt(Number(buyNow) * 1.15);
  const expectedProfitCents = expectedRetailCents - acquisitionCostCents;
  const created = await appraisalDb.createAppraisal(dealershipId, {
    vin: listing.vin ?? "",
    sourceType: "AUCTION",
    appraisedByUserId: userId,
    acquisitionCostCents,
    expectedRetailCents,
    expectedProfitCents,
  });
  return created;
}
