import type { TitleStatus } from "@prisma/client";
import * as dealDb from "../db/deal";
import * as titleDb from "../db/title";
import { requireTenantActiveForWrite, requireTenantActiveForRead } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function startTitleProcess(
  dealershipId: string,
  userId: string,
  dealId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  const existing = await titleDb.getDealTitle(dealershipId, dealId);
  if (existing) throw new ApiError("CONFLICT", "Title process already started for this deal");
  const title = await titleDb.createDealTitleRecord(dealershipId, dealId, "TITLE_PENDING");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.title_started",
    entity: "DealTitle",
    entityId: title.id,
    metadata: { dealId, titleStatus: "TITLE_PENDING" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return title;
}

export async function markTitleSent(
  dealershipId: string,
  userId: string,
  dealId: string,
  sentToDmvAt?: Date | null,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const title = await titleDb.getDealTitle(dealershipId, dealId);
  if (!title) throw new ApiError("NOT_FOUND", "Title record not found");
  const dateToSet = sentToDmvAt ?? new Date();
  const updated = await titleDb.updateDealTitleStatus(dealershipId, dealId, {
    titleStatus: "TITLE_SENT",
    sentToDmvAt: dateToSet,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Title record not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.title_sent",
    entity: "DealTitle",
    entityId: title.id,
    metadata: { dealId, titleStatus: "TITLE_SENT", sentToDmvAt: dateToSet.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function completeTitle(
  dealershipId: string,
  userId: string,
  dealId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const title = await titleDb.getDealTitle(dealershipId, dealId);
  if (!title) throw new ApiError("NOT_FOUND", "Title record not found");
  const updated = await titleDb.updateDealTitleStatus(dealershipId, dealId, {
    titleStatus: "TITLE_COMPLETED",
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Title record not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.title_completed",
    entity: "DealTitle",
    entityId: title.id,
    metadata: { dealId, titleStatus: "TITLE_COMPLETED" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export type UpdateTitlePayload = {
  titleStatus?: TitleStatus;
  titleNumber?: string | null;
  lienholderName?: string | null;
  lienReleasedAt?: string | null;
  sentToDmvAt?: string | null;
  receivedFromDmvAt?: string | null;
  notes?: string | null;
};

export async function updateTitleStatus(
  dealershipId: string,
  userId: string,
  dealId: string,
  payload: UpdateTitlePayload,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const title = await titleDb.getDealTitle(dealershipId, dealId);
  if (!title) throw new ApiError("NOT_FOUND", "Title record not found");
  const data: titleDb.UpdateDealTitleInput = {};
  if (payload.titleStatus !== undefined) data.titleStatus = payload.titleStatus;
  if (payload.titleNumber !== undefined) data.titleNumber = payload.titleNumber;
  if (payload.lienholderName !== undefined) data.lienholderName = payload.lienholderName;
  if (payload.lienReleasedAt !== undefined) data.lienReleasedAt = payload.lienReleasedAt ? new Date(payload.lienReleasedAt) : null;
  if (payload.sentToDmvAt !== undefined) data.sentToDmvAt = payload.sentToDmvAt ? new Date(payload.sentToDmvAt) : null;
  if (payload.receivedFromDmvAt !== undefined) data.receivedFromDmvAt = payload.receivedFromDmvAt ? new Date(payload.receivedFromDmvAt) : null;
  if (payload.notes !== undefined) data.notes = payload.notes;
  const updated = await titleDb.updateDealTitleStatus(dealershipId, dealId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Title record not found");
  const auditActions: Record<TitleStatus, string> = {
    TITLE_SENT: "deal.title_sent",
    TITLE_RECEIVED: "deal.title_received",
    TITLE_COMPLETED: "deal.title_completed",
    ISSUE_HOLD: "deal.title_issue_hold",
    NOT_STARTED: "deal.title_updated",
    TITLE_PENDING: "deal.title_updated",
  };
  if (payload.titleStatus && auditActions[payload.titleStatus]) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: auditActions[payload.titleStatus],
      entity: "DealTitle",
      entityId: title.id,
      metadata: { dealId, titleStatus: payload.titleStatus },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function getDealTitle(dealershipId: string, dealId: string) {
  await requireTenantActiveForRead(dealershipId);
  return titleDb.getDealTitle(dealershipId, dealId);
}

export async function listTitleQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
) {
  await requireTenantActiveForRead(dealershipId);
  return titleDb.listTitleQueue(dealershipId, options);
}
