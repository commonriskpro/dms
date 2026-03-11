import { prisma } from "@/lib/db";

export type DealFeeCreateInput = {
  label: string;
  amountCents: bigint;
  taxable?: boolean;
};

export type DealFeeUpdateInput = {
  label?: string;
  amountCents?: bigint;
  taxable?: boolean;
};

export async function listFeesByDealId(dealershipId: string, dealId: string) {
  return prisma.dealFee.findMany({
    where: { dealershipId, dealId },
    orderBy: { createdAt: "asc" },
  });
}

export async function addFee(dealershipId: string, dealId: string, data: DealFeeCreateInput) {
  return prisma.dealFee.create({
    data: {
      dealershipId,
      dealId,
      label: data.label,
      amountCents: data.amountCents,
      taxable: data.taxable ?? false,
    },
  });
}

export async function updateFee(
  dealershipId: string,
  dealId: string,
  feeId: string,
  data: DealFeeUpdateInput
) {
  const existing = await prisma.dealFee.findFirst({
    where: { id: feeId, dealershipId, dealId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.label !== undefined) payload.label = data.label;
  if (data.amountCents !== undefined) payload.amountCents = data.amountCents;
  if (data.taxable !== undefined) payload.taxable = data.taxable;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.dealFee.update({
    where: { id: feeId },
    data: payload as Parameters<typeof prisma.dealFee.update>[0]["data"],
  });
}

export async function deleteFee(dealershipId: string, dealId: string, feeId: string) {
  const existing = await prisma.dealFee.findFirst({
    where: { id: feeId, dealershipId, dealId },
  });
  if (!existing) return null;
  await prisma.dealFee.delete({ where: { id: feeId } });
  return existing;
}
