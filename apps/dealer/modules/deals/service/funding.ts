import type { DealFundingStatus } from "@prisma/client";
import * as dealDb from "../db/deal";
import * as fundingDb from "../db/funding";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export type CreateFundingRecordInput = {
  lenderApplicationId?: string | null;
  fundingAmountCents: bigint;
  notes?: string | null;
};

export type UpdateFundingStatusInput = {
  fundingStatus: DealFundingStatus;
  fundingAmountCents?: bigint;
  fundingDate?: string | null;
  notes?: string | null;
};

/**
 * Create a funding record for a deal. Deal must exist and be tenant-scoped.
 */
export async function createFundingRecord(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: CreateFundingRecordInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  const funding = await fundingDb.createDealFunding({
    dealershipId,
    dealId,
    lenderApplicationId: input.lenderApplicationId ?? null,
    fundingAmountCents: input.fundingAmountCents,
    notes: input.notes ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.funding_created",
    entity: "DealFunding",
    entityId: funding.id,
    metadata: { dealId, fundingId: funding.id, fundingStatus: "PENDING" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return funding;
}

/**
 * Update funding record status. If status is FUNDED, sets fundingDate if not provided.
 */
export async function updateFundingStatus(
  dealershipId: string,
  userId: string,
  dealId: string,
  fundingId: string,
  input: UpdateFundingStatusInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const funding = await fundingDb.getDealFundingByDealAndId(dealershipId, dealId, fundingId);
  if (!funding) throw new ApiError("NOT_FOUND", "Funding record not found");
  const payload: fundingDb.UpdateDealFundingInput = {
    fundingStatus: input.fundingStatus,
    ...(input.fundingAmountCents !== undefined && { fundingAmountCents: input.fundingAmountCents }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
  if (input.fundingDate !== undefined) {
    payload.fundingDate = input.fundingDate ? new Date(input.fundingDate) : null;
  } else if (input.fundingStatus === "FUNDED" && !funding.fundingDate) {
    payload.fundingDate = new Date();
  }
  const updated = await fundingDb.updateDealFunding(dealershipId, fundingId, payload);
  if (!updated) throw new ApiError("NOT_FOUND", "Funding record not found");
  if (input.fundingStatus === "FUNDED") {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "deal.funded",
      entity: "DealFunding",
      entityId: fundingId,
      metadata: {
        dealId,
        fundingId,
        fundingStatus: "FUNDED",
        fundingDate: (updated.fundingDate ?? new Date()).toISOString(),
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}
