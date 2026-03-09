import * as dealService from "@/modules/deals/service/deal";
import * as financeDb from "../db";
import {
  computeFinanceTotals,
  type FinancingMode,
} from "./calculations";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { DealFinanceStatus, DealFinanceProductType } from "@prisma/client";

import "./events";

const ALLOWED_STATUS_TRANSITIONS: Record<DealFinanceStatus, DealFinanceStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["PRESENTED", "CANCELED"],
  PRESENTED: ["ACCEPTED", "CANCELED"],
  ACCEPTED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};

function isDealContracted(status: string): boolean {
  return status === "CONTRACTED";
}

function validateStatusTransition(from: DealFinanceStatus, to: DealFinanceStatus): void {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Status transition from ${from} to ${to} is not allowed`
    );
  }
}

async function recomputeAndPersistFinance(
  dealershipId: string,
  dealId: string,
  dealTotalDueCents: bigint,
  finance: Awaited<ReturnType<typeof financeDb.getFinanceByDealId>>
): Promise<Awaited<ReturnType<typeof financeDb.upsertFinance>>> {
  if (!finance) throw new ApiError("NOT_FOUND", "Deal finance not found");
  const products = await financeDb.listProductsActive(dealershipId, finance.id);
  let financedProductsCents = BigInt(0);
  let productsTotalCents = BigInt(0);
  let backendGrossCents = BigInt(0);
  for (const p of products) {
    if (p.includedInAmountFinanced) {
      financedProductsCents += p.priceCents;
      productsTotalCents += p.priceCents;
    }
    if (p.costCents != null) {
      backendGrossCents += p.priceCents - p.costCents;
    }
  }
  const totals = computeFinanceTotals({
    financingMode: finance.financingMode as FinancingMode,
    baseAmountCents: dealTotalDueCents,
    financedProductsCents,
    cashDownCents: finance.cashDownCents,
    termMonths: finance.termMonths ?? 0,
    aprBps: finance.aprBps ?? 0,
  });
  return financeDb.upsertFinance(dealershipId, {
    dealId: finance.dealId,
    financingMode: finance.financingMode,
    termMonths: finance.termMonths,
    aprBps: finance.aprBps,
    cashDownCents: finance.cashDownCents,
    amountFinancedCents: totals.amountFinancedCents,
    monthlyPaymentCents: totals.monthlyPaymentCents,
    totalOfPaymentsCents: totals.totalOfPaymentsCents,
    financeChargeCents: totals.financeChargeCents,
    productsTotalCents,
    backendGrossCents,
    reserveCents: finance.reserveCents,
    status: finance.status,
    firstPaymentDate: finance.firstPaymentDate,
    lenderName: finance.lenderName,
    notes: finance.notes,
  });
}

export type PutFinanceInput = {
  financingMode: FinancingMode;
  termMonths?: number | null;
  aprBps?: number | null;
  cashDownCents?: bigint;
  amountFinancedCents?: bigint;
  monthlyPaymentCents?: bigint;
  totalOfPaymentsCents?: bigint;
  financeChargeCents?: bigint;
  productsTotalCents?: bigint;
  backendGrossCents?: bigint;
  reserveCents?: bigint | null;
  firstPaymentDate?: Date | null;
  lenderName?: string | null;
  notes?: string | null;
};

export async function getFinanceByDealId(dealershipId: string, dealId: string) {
  const deal = await dealService.getDeal(dealershipId, dealId);
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) return null;
  return { deal, finance };
}

export async function putFinance(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: PutFinanceInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  if (isDealContracted(deal.status)) {
    throw new ApiError("CONFLICT", "Deal is contracted; finance cannot be modified");
  }
  const existing = await financeDb.getFinanceByDealId(dealId, dealershipId);
  const cashDownCents = input.cashDownCents ?? deal.downPaymentCents;
  const termMonths = input.financingMode === "FINANCE" ? (input.termMonths ?? null) : null;
  const aprBps = input.financingMode === "FINANCE" ? (input.aprBps ?? null) : null;

  const products = existing
    ? await financeDb.listProductsActive(dealershipId, existing.id)
    : [];
  let financedProductsCents = BigInt(0);
  let productsTotalCents = BigInt(0);
  let backendGrossCents = BigInt(0);
  for (const p of products) {
    if (p.includedInAmountFinanced) {
      financedProductsCents += p.priceCents;
      productsTotalCents += p.priceCents;
    }
    if (p.costCents != null) backendGrossCents += p.priceCents - p.costCents;
  }

  const totals = computeFinanceTotals({
    financingMode: input.financingMode,
    baseAmountCents: deal.totalDueCents,
    financedProductsCents,
    cashDownCents,
    termMonths: termMonths ?? 0,
    aprBps: aprBps ?? 0,
  });

  const amountFinancedCents = input.amountFinancedCents ?? totals.amountFinancedCents;
  const monthlyPaymentCents = input.monthlyPaymentCents ?? totals.monthlyPaymentCents;
  const totalOfPaymentsCents = input.totalOfPaymentsCents ?? totals.totalOfPaymentsCents;
  const financeChargeCents = input.financeChargeCents ?? totals.financeChargeCents;
  const finalProductsTotalCents = input.productsTotalCents ?? productsTotalCents;
  const finalBackendGrossCents = input.backendGrossCents ?? backendGrossCents;

  const upserted = await financeDb.upsertFinance(dealershipId, {
    dealId,
    financingMode: input.financingMode,
    termMonths,
    aprBps,
    cashDownCents,
    amountFinancedCents,
    monthlyPaymentCents,
    totalOfPaymentsCents,
    financeChargeCents,
    productsTotalCents: finalProductsTotalCents,
    backendGrossCents: finalBackendGrossCents,
    reserveCents: input.reserveCents ?? null,
    status: existing?.status ?? "DRAFT",
    firstPaymentDate: input.firstPaymentDate ?? null,
    lenderName: input.lenderName ?? null,
    notes: input.notes ?? null,
  });

  const wasCreated = !existing;
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: wasCreated ? "finance.created" : "finance.updated",
    entity: "DealFinance",
    entityId: upserted.id,
    metadata: wasCreated
      ? { dealId, dealFinanceId: upserted.id, dealershipId }
      : { dealId, dealFinanceId: upserted.id, changedFields: Object.keys(input) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { finance: upserted, created: wasCreated };
}

export async function patchFinanceStatus(
  dealershipId: string,
  userId: string,
  dealId: string,
  toStatus: DealFinanceStatus,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) throw new ApiError("NOT_FOUND", "Deal finance not found");
  if (isDealContracted(deal.status) && toStatus !== "CANCELED") {
    throw new ApiError("CONFLICT", "Deal is contracted; only status transition to CANCELED is allowed");
  }
  const fromStatus = finance.status;
  validateStatusTransition(fromStatus, toStatus);

  const updated = await financeDb.updateFinanceStatus(dealershipId, finance.id, toStatus);
  if (!updated) throw new ApiError("NOT_FOUND", "Deal finance not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance.status_changed",
    entity: "DealFinance",
    entityId: finance.id,
    metadata: { dealId, dealFinanceId: finance.id, fromStatus, toStatus },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function listProducts(
  dealershipId: string,
  dealId: string,
  options: { limit: number; offset: number }
) {
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) return null;
  return financeDb.listProducts(dealershipId, finance.id, options);
}

export type CreateProductInput = {
  productType: DealFinanceProductType;
  name: string;
  priceCents: bigint;
  costCents?: bigint | null;
  taxable?: boolean;
  includedInAmountFinanced: boolean;
};

export async function addProduct(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: CreateProductInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) throw new ApiError("NOT_FOUND", "Deal finance not found");
  if (isDealContracted(deal.status)) {
    throw new ApiError("CONFLICT", "Deal is contracted; products cannot be modified");
  }

  const product = await financeDb.addProduct(dealershipId, {
    dealFinanceId: finance.id,
    productType: input.productType,
    name: input.name,
    priceCents: input.priceCents,
    costCents: input.costCents ?? null,
    taxable: input.taxable ?? false,
    includedInAmountFinanced: input.includedInAmountFinanced,
  });
  if (!product) throw new ApiError("NOT_FOUND", "Deal finance not found");

  const updatedFinance = await recomputeAndPersistFinance(dealershipId, dealId, deal.totalDueCents, finance);

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance.product_added",
    entity: "DealFinanceProduct",
    entityId: product.id,
    metadata: { dealId, dealFinanceId: finance.id, productId: product.id, productType: product.productType },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { product, finance: updatedFinance };
}

export type UpdateProductInput = {
  productType?: DealFinanceProductType;
  name?: string;
  priceCents?: bigint;
  costCents?: bigint | null;
  taxable?: boolean;
  includedInAmountFinanced?: boolean;
};

export async function updateProduct(
  dealershipId: string,
  userId: string,
  dealId: string,
  productId: string,
  input: UpdateProductInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) throw new ApiError("NOT_FOUND", "Deal finance not found");
  if (isDealContracted(deal.status)) {
    throw new ApiError("CONFLICT", "Deal is contracted; products cannot be modified");
  }
  const product = await financeDb.getProductById(dealershipId, productId);
  if (!product || product.dealFinanceId !== finance.id) throw new ApiError("NOT_FOUND", "Product not found");

  const updated = await financeDb.updateProduct(dealershipId, productId, input);
  if (!updated) throw new ApiError("NOT_FOUND", "Product not found");

  const updatedFinance = await recomputeAndPersistFinance(
    dealershipId,
    dealId,
    deal.totalDueCents,
    { ...finance, id: finance.id, dealId: finance.dealId }
  );

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance.product_updated",
    entity: "DealFinanceProduct",
    entityId: productId,
    metadata: { dealId, dealFinanceId: finance.id, productId, changedFields: Object.keys(input) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { product: updated, finance: updatedFinance };
}

export async function deleteProduct(
  dealershipId: string,
  userId: string,
  dealId: string,
  productId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) throw new ApiError("NOT_FOUND", "Deal finance not found");
  if (isDealContracted(deal.status)) {
    throw new ApiError("CONFLICT", "Deal is contracted; products cannot be modified");
  }
  const product = await financeDb.getProductById(dealershipId, productId);
  if (!product || product.dealFinanceId !== finance.id) throw new ApiError("NOT_FOUND", "Product not found");

  const soft = await financeDb.softDeleteProduct(dealershipId, productId, userId);
  if (!soft) throw new ApiError("NOT_FOUND", "Product not found");

  await recomputeAndPersistFinance(dealershipId, dealId, deal.totalDueCents, finance);

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance.product_deleted",
    entity: "DealFinanceProduct",
    entityId: productId,
    metadata: { dealId, dealFinanceId: finance.id, productId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export { lockFinanceWhenDealContracted } from "./lock";
