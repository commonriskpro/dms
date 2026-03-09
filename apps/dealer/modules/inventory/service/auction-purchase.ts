/**
 * Auction purchase tracking: list, get, create, update. Tenant-scoped.
 */
import * as auctionPurchaseDb from "../db/auction-purchase";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";

export type AuctionPurchaseListOptions = auctionPurchaseDb.AuctionPurchaseListOptions;
export type AuctionPurchaseCreateInput = auctionPurchaseDb.AuctionPurchaseCreateInput;
export type AuctionPurchaseUpdateInput = auctionPurchaseDb.AuctionPurchaseUpdateInput;

export async function listAuctionPurchases(
  dealershipId: string,
  options: auctionPurchaseDb.AuctionPurchaseListOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return auctionPurchaseDb.listAuctionPurchases(dealershipId, options);
}

export async function getAuctionPurchase(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const row = await auctionPurchaseDb.getAuctionPurchaseById(dealershipId, id);
  if (!row) throw new ApiError("NOT_FOUND", "Auction purchase not found");
  return row;
}

export async function createAuctionPurchase(
  dealershipId: string,
  userId: string,
  data: auctionPurchaseDb.AuctionPurchaseCreateInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await auctionPurchaseDb.createAuctionPurchase(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "auction_purchase.created",
    entity: "AuctionPurchase",
    entityId: created.id,
    metadata: { auctionPurchaseId: created.id, auctionName: created.auctionName, lotNumber: created.lotNumber },
  });
  return created;
}

export async function updateAuctionPurchase(
  dealershipId: string,
  id: string,
  data: auctionPurchaseDb.AuctionPurchaseUpdateInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await auctionPurchaseDb.updateAuctionPurchase(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Auction purchase not found");
  return updated;
}
