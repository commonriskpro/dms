import { prisma } from "@/lib/db";

export type DealTradeCreateInput = {
  vehicleDescription: string;
  allowanceCents: bigint;
  payoffCents?: bigint;
};

export type DealTradeUpdateInput = {
  vehicleDescription?: string;
  allowanceCents?: bigint;
  payoffCents?: bigint;
};

export async function getTradeByDealId(dealershipId: string, dealId: string) {
  return prisma.dealTrade.findFirst({
    where: { dealershipId, dealId },
  });
}

export type ListTradesOptions = {
  limit: number;
  offset: number;
};

export async function listTradesByDealId(
  dealershipId: string,
  dealId: string,
  options: ListTradesOptions
) {
  const where = { dealershipId, dealId };
  const [data, total] = await Promise.all([
    prisma.dealTrade.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.dealTrade.count({ where }),
  ]);
  return { data, total };
}

export async function addTrade(dealershipId: string, dealId: string, data: DealTradeCreateInput) {
  return prisma.dealTrade.create({
    data: {
      dealershipId,
      dealId,
      vehicleDescription: data.vehicleDescription,
      allowanceCents: data.allowanceCents,
      payoffCents: data.payoffCents ?? BigInt(0),
    },
  });
}

export async function updateTrade(
  dealershipId: string,
  dealId: string,
  tradeId: string,
  data: DealTradeUpdateInput
) {
  const existing = await prisma.dealTrade.findFirst({
    where: { id: tradeId, dealershipId, dealId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.vehicleDescription !== undefined) payload.vehicleDescription = data.vehicleDescription;
  if (data.allowanceCents !== undefined) payload.allowanceCents = data.allowanceCents;
  if (data.payoffCents !== undefined) payload.payoffCents = data.payoffCents;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.dealTrade.update({
    where: { id: tradeId },
    data: payload as Parameters<typeof prisma.dealTrade.update>[0]["data"],
  });
}

export async function deleteTrade(dealershipId: string, dealId: string, tradeId: string) {
  const existing = await prisma.dealTrade.findFirst({
    where: { id: tradeId, dealershipId, dealId },
  });
  if (!existing) return null;
  await prisma.dealTrade.delete({ where: { id: tradeId } });
  return existing;
}
