/**
 * Deal profit: front gross, back gross, total gross, fees, products, net profit.
 */
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import * as dealService from "@/modules/deals/service/deal";
import { prisma } from "@/lib/db";

export type DealProfit = {
  frontEndGrossCents: bigint;
  backEndGrossCents: bigint;
  totalGrossCents: bigint;
  feesCents: bigint;
  productsCents: bigint;
  netProfitCents: bigint;
};

export async function calculateDealProfit(
  dealershipId: string,
  dealId: string
): Promise<DealProfit> {
  await requireTenantActiveForRead(dealershipId);
  await dealService.getDeal(dealershipId, dealId);
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, dealershipId },
    include: { dealFinance: { include: { products: true } } },
  });
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  const frontEndGrossCents = deal.frontGrossCents;
  const backEndGrossCents = deal.dealFinance?.backendGrossCents ?? BigInt(0);
  const totalGrossCents = frontEndGrossCents + backEndGrossCents;
  const feesCents = deal.totalFeesCents;
  const productsCents = deal.dealFinance?.productsTotalCents ?? BigInt(0);
  const netProfitCents = totalGrossCents;
  return {
    frontEndGrossCents,
    backEndGrossCents,
    totalGrossCents,
    feesCents,
    productsCents,
    netProfitCents,
  };
}
