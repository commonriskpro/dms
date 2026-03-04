import { prisma } from "@/lib/db";
import type { FinancingMode, DealFinanceStatus, DealFinanceProductType } from "@prisma/client";

export type DealFinanceUpsertInput = {
  dealId: string;
  financingMode: FinancingMode;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: bigint;
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveCents?: bigint | null;
  status: DealFinanceStatus;
  firstPaymentDate?: Date | null;
  lenderName?: string | null;
  notes?: string | null;
};

export type DealFinanceProductCreateInput = {
  dealFinanceId: string;
  productType: DealFinanceProductType;
  name: string;
  priceCents: bigint;
  costCents?: bigint | null;
  taxable?: boolean;
  includedInAmountFinanced: boolean;
};

export type DealFinanceProductUpdateInput = {
  productType?: DealFinanceProductType;
  name?: string;
  priceCents?: bigint;
  costCents?: bigint | null;
  taxable?: boolean;
  includedInAmountFinanced?: boolean;
};

export async function getFinanceByDealId(
  dealId: string,
  dealershipId: string
): Promise<{
  id: string;
  dealershipId: string;
  dealId: string;
  financingMode: FinancingMode;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: bigint;
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveCents: bigint | null;
  status: DealFinanceStatus;
  firstPaymentDate: Date | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
} | null> {
  const row = await prisma.dealFinance.findFirst({
    where: { dealId, dealershipId, deletedAt: null },
  });
  return row;
}

export async function upsertFinance(
  dealershipId: string,
  data: DealFinanceUpsertInput
): Promise<{
  id: string;
  dealershipId: string;
  dealId: string;
  financingMode: FinancingMode;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: bigint;
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveCents: bigint | null;
  status: DealFinanceStatus;
  firstPaymentDate: Date | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}> {
  const existing = await prisma.dealFinance.findFirst({
    where: { dealId: data.dealId, dealershipId, deletedAt: null },
  });
  const payload = {
    financingMode: data.financingMode,
    termMonths: data.termMonths,
    aprBps: data.aprBps,
    cashDownCents: data.cashDownCents,
    amountFinancedCents: data.amountFinancedCents,
    monthlyPaymentCents: data.monthlyPaymentCents,
    totalOfPaymentsCents: data.totalOfPaymentsCents,
    financeChargeCents: data.financeChargeCents,
    productsTotalCents: data.productsTotalCents,
    backendGrossCents: data.backendGrossCents,
    reserveCents: data.reserveCents ?? null,
    status: data.status,
    firstPaymentDate: data.firstPaymentDate ?? null,
    lenderName: data.lenderName ?? null,
    notes: data.notes ?? null,
  };
  if (existing) {
    const updated = await prisma.dealFinance.update({
      where: { id: existing.id },
      data: payload,
    });
    return updated;
  }
  const created = await prisma.dealFinance.create({
    data: {
      dealershipId,
      dealId: data.dealId,
      ...payload,
    },
  });
  return created;
}

export async function updateFinanceStatus(
  dealershipId: string,
  dealFinanceId: string,
  status: DealFinanceStatus
) {
  const existing = await prisma.dealFinance.findFirst({
    where: { id: dealFinanceId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.dealFinance.update({
    where: { id: dealFinanceId },
    data: { status },
  });
}

/** All active (non-deleted) products for a deal finance; used for recomputing totals. */
export async function listProductsActive(dealershipId: string, dealFinanceId: string) {
  return prisma.dealFinanceProduct.findMany({
    where: { dealershipId, dealFinanceId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export type ListProductsOptions = {
  limit: number;
  offset: number;
};

export async function listProducts(
  dealershipId: string,
  dealFinanceId: string,
  options: ListProductsOptions
): Promise<{ data: Awaited<ReturnType<typeof prisma.dealFinanceProduct.findMany>>; total: number }> {
  const where = { dealershipId, dealFinanceId, deletedAt: null };
  const [data, total] = await Promise.all([
    prisma.dealFinanceProduct.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.dealFinanceProduct.count({ where }),
  ]);
  return { data, total };
}

export async function addProduct(
  dealershipId: string,
  data: DealFinanceProductCreateInput
): Promise<{
  id: string;
  dealershipId: string;
  dealFinanceId: string;
  productType: DealFinanceProductType;
  name: string;
  priceCents: bigint;
  costCents: bigint | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
} | null> {
  const finance = await prisma.dealFinance.findFirst({
    where: { id: data.dealFinanceId, dealershipId, deletedAt: null },
  });
  if (!finance) return null;
  return prisma.dealFinanceProduct.create({
    data: {
      dealershipId,
      dealFinanceId: data.dealFinanceId,
      productType: data.productType,
      name: data.name,
      priceCents: data.priceCents,
      costCents: data.costCents ?? null,
      taxable: data.taxable ?? false,
      includedInAmountFinanced: data.includedInAmountFinanced,
    },
  });
}

export async function getProductById(
  dealershipId: string,
  productId: string
): Promise<{
  id: string;
  dealershipId: string;
  dealFinanceId: string;
  productType: DealFinanceProductType;
  name: string;
  priceCents: bigint;
  costCents: bigint | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
} | null> {
  return prisma.dealFinanceProduct.findFirst({
    where: { id: productId, dealershipId, deletedAt: null },
  });
}

export async function updateProduct(
  dealershipId: string,
  productId: string,
  data: DealFinanceProductUpdateInput
) {
  const existing = await prisma.dealFinanceProduct.findFirst({
    where: { id: productId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.productType !== undefined) payload.productType = data.productType;
  if (data.name !== undefined) payload.name = data.name;
  if (data.priceCents !== undefined) payload.priceCents = data.priceCents;
  if (data.costCents !== undefined) payload.costCents = data.costCents;
  if (data.taxable !== undefined) payload.taxable = data.taxable;
  if (data.includedInAmountFinanced !== undefined)
    payload.includedInAmountFinanced = data.includedInAmountFinanced;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.dealFinanceProduct.update({
    where: { id: productId },
    data: payload as Parameters<typeof prisma.dealFinanceProduct.update>[0]["data"],
  });
}

export async function softDeleteProduct(
  dealershipId: string,
  productId: string,
  deletedBy: string
): Promise<{ id: string; dealFinanceId: string } | null> {
  const existing = await prisma.dealFinanceProduct.findFirst({
    where: { id: productId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  await prisma.dealFinanceProduct.update({
    where: { id: productId },
    data: { deletedAt: new Date(), deletedBy },
  });
  return { id: existing.id, dealFinanceId: existing.dealFinanceId };
}
