/**
 * Read-only queries for finance penetration and mix: DealFinance joined to CONTRACTED deals.
 * Missing finance row = not financed (CASH/UNKNOWN). Exclude DealFinance.deletedAt.
 */
import { prisma } from "@/lib/db";

const CONTRACTED = "CONTRACTED" as const;

export type DealFinanceRow = {
  dealId: string;
  financingMode: string;
  aprBps: number | null;
  termMonths: number | null;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
};

/** DealFinance for CONTRACTED deals in date range (by deal createdAt). */
export async function listFinanceForContractedDealsInRange(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<DealFinanceRow[]> {
  const finances = await prisma.dealFinance.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      deal: {
        dealershipId,
        status: CONTRACTED,
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
    },
    select: {
      dealId: true,
      financingMode: true,
      aprBps: true,
      termMonths: true,
      productsTotalCents: true,
      backendGrossCents: true,
    },
  });
  return finances as DealFinanceRow[];
}

/** CONTRACTED deals in range with salePriceCents, frontGrossCents for mix; join to finance for mode. */
export async function listContractedDealsWithFinanceForMix(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<
  Array<{
    dealId: string;
    salePriceCents: bigint;
    frontGrossCents: bigint;
    financingMode: "CASH" | "FINANCE" | null;
  }>
> {
  const deals = await prisma.deal.findMany({
    where: {
      dealershipId,
      status: CONTRACTED,
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      salePriceCents: true,
      frontGrossCents: true,
      dealFinance: {
        where: { deletedAt: null },
        select: { financingMode: true },
      },
    },
  });
  return deals.map((d) => ({
    dealId: d.id,
    salePriceCents: d.salePriceCents,
    frontGrossCents: d.frontGrossCents,
    financingMode: d.dealFinance?.financingMode ?? null,
  }));
}
