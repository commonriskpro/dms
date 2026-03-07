import * as dealDb from "../db/deal";
import * as dmvDb from "../db/dmv";
import { requireTenantActiveForWrite, requireTenantActiveForRead } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";

const DEFAULT_CHECKLIST_LABELS = [
  "Buyer docs complete",
  "Odometer disclosure signed",
  "Insurance verified",
  "Title application sent",
  "Registration submitted",
  "Lien release received",
];

export async function createChecklistItemsForDeal(
  dealershipId: string,
  _userId: string,
  dealId: string,
  labels?: string[],
  _meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  const toCreate = labels && labels.length > 0 ? labels : DEFAULT_CHECKLIST_LABELS;
  const existing = await dmvDb.listChecklistItems(dealershipId, dealId);
  if (existing.length > 0) throw new ApiError("CONFLICT", "Checklist already exists for this deal");
  return dmvDb.createChecklistItems(dealershipId, dealId, toCreate);
}

export async function toggleChecklistItem(
  dealershipId: string,
  _userId: string,
  itemId: string,
  completed: boolean,
  _meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const item = await dmvDb.getChecklistItemById(dealershipId, itemId);
  if (!item) throw new ApiError("NOT_FOUND", "Checklist item not found");
  return dmvDb.toggleChecklistItem(dealershipId, itemId, completed);
}

export async function getChecklistForDeal(dealershipId: string, dealId: string) {
  await requireTenantActiveForRead(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  return dmvDb.listChecklistItems(dealershipId, dealId);
}
