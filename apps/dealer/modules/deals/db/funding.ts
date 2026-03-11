import { prisma } from "@/lib/db";
import type { DealFundingStatus } from "@prisma/client";

export type CreateDealFundingInput = {
  dealId: string;
  dealershipId: string;
  lenderApplicationId?: string | null;
  fundingAmountCents: bigint;
  notes?: string | null;
};

export type UpdateDealFundingInput = {
  fundingStatus?: DealFundingStatus;
  fundingAmountCents?: bigint;
  fundingDate?: Date | null;
  notes?: string | null;
};

export async function createDealFunding(data: CreateDealFundingInput) {
  return prisma.dealFunding.create({
    data: {
      dealershipId: data.dealershipId,
      dealId: data.dealId,
      lenderApplicationId: data.lenderApplicationId ?? null,
      fundingStatus: "PENDING",
      fundingAmountCents: data.fundingAmountCents,
      notes: data.notes ?? null,
    },
    include: {
      lenderApplication: { select: { id: true, lenderName: true } },
    },
  });
}

export async function getDealFundingByDealAndId(dealershipId: string, dealId: string, fundingId: string) {
  return prisma.dealFunding.findFirst({
    where: { id: fundingId, dealId, dealershipId },
    include: {
      lenderApplication: { select: { id: true, lenderName: true } },
    },
  });
}

export async function updateDealFunding(
  dealershipId: string,
  fundingId: string,
  data: UpdateDealFundingInput
) {
  const existing = await prisma.dealFunding.findFirst({
    where: { id: fundingId, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.fundingStatus !== undefined) payload.fundingStatus = data.fundingStatus;
  if (data.fundingAmountCents !== undefined) payload.fundingAmountCents = data.fundingAmountCents;
  if (data.fundingDate !== undefined) payload.fundingDate = data.fundingDate;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.dealFunding.update({
    where: { id: fundingId },
    data: payload as Parameters<typeof prisma.dealFunding.update>[0]["data"],
    include: {
      lenderApplication: { select: { id: true, lenderName: true } },
    },
  });
}
