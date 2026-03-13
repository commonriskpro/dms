import { prisma } from "@/lib/db";
import * as dealDb from "../db/deal";
import * as feeDb from "../db/fee";
import * as tradeDb from "../db/trade";
import * as historyDb from "../db/history";
import * as customerService from "@/modules/customers/service/customer";
import * as vehicleService from "@/modules/inventory/service/vehicle";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { computeDealTotals } from "./calculations";
import { isAllowedTransition } from "./deal-transitions";
import type { DealStatus } from "@prisma/client";
import { computeFinanceTotals, type FinancingMode } from "@/modules/finance-shell/service/calculations";

const CONTRACTED_OR_LATER: DealStatus[] = ["CONTRACTED"];
const FINANCIAL_FIELDS = new Set([
  "salePriceCents",
  "purchasePriceCents",
  "taxRateBps",
  "taxCents",
  "docFeeCents",
  "downPaymentCents",
  "totalFeesCents",
  "totalDueCents",
  "frontGrossCents",
]);

function isContractLocked(status: DealStatus): boolean {
  return status === "CONTRACTED";
}

async function ensureCustomerAndVehicleExist(
  dealershipId: string,
  customerId: string,
  vehicleId: string
): Promise<void> {
  await customerService.getCustomer(dealershipId, customerId);
  await vehicleService.getVehicle(dealershipId, vehicleId);
}

async function recomputeAndPersistDealTotals(
  dealershipId: string,
  dealId: string,
  deal: {
    salePriceCents: bigint;
    purchasePriceCents: bigint;
    docFeeCents: bigint;
    downPaymentCents: bigint;
    taxRateBps: number;
  }
): Promise<void> {
  const fees = await feeDb.listFeesByDealId(dealershipId, dealId);
  let customFeesCents = BigInt(0);
  let taxableCustomFeesCents = BigInt(0);
  for (const f of fees) {
    customFeesCents += f.amountCents;
    if (f.taxable) taxableCustomFeesCents += f.amountCents;
  }
  const { totalFeesCents, taxCents, totalDueCents, frontGrossCents } = computeDealTotals({
    ...deal,
    customFeesCents,
    taxableCustomFeesCents: taxableCustomFeesCents,
  });
  await dealDb.updateDeal(dealershipId, dealId, {
    totalFeesCents,
    taxCents,
    totalDueCents,
    frontGrossCents,
  });
}

export type CreateDealInput = {
  customerId: string;
  vehicleId: string;
  financingMode: FinancingMode;
  salePriceCents: bigint;
  purchasePriceCents: bigint;
  taxRateBps: number;
  docFeeCents?: bigint;
  downPaymentCents?: bigint;
  notes?: string | null;
  fees?: { label: string; amountCents: bigint; taxable?: boolean }[];
};

export async function listDeals(
  dealershipId: string,
  options: dealDb.DealListOptions
): Promise<{ data: Awaited<ReturnType<typeof dealDb.listDeals>>["data"]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  return dealDb.listDeals(dealershipId, options);
}

export async function listDeliveryQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
): Promise<{ data: Awaited<ReturnType<typeof dealDb.listDealsForDeliveryQueue>>["data"]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  return dealDb.listDealsForDeliveryQueue(dealershipId, options);
}

export async function listFundingQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
): Promise<{ data: Awaited<ReturnType<typeof dealDb.listDealsForFundingQueue>>["data"]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  return dealDb.listDealsForFundingQueue(dealershipId, options);
}

export async function getDeal(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, id);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  return deal;
}

export async function createDeal(
  dealershipId: string,
  userId: string,
  input: CreateDealInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await ensureCustomerAndVehicleExist(dealershipId, input.customerId, input.vehicleId);
  const existingActive = await dealDb.getActiveDealByVehicleId(dealershipId, input.vehicleId);
  if (existingActive)
    throw new ApiError("CONFLICT", "Vehicle already has an active deal");

  const docFeeCents = input.docFeeCents ?? BigInt(0);
  const downPaymentCents = input.downPaymentCents ?? BigInt(0);
  const fees = input.fees ?? [];
  let customFeesCents = BigInt(0);
  let taxableCustomFeesCents = BigInt(0);
  for (const f of fees) {
    customFeesCents += f.amountCents;
    if (f.taxable) taxableCustomFeesCents += f.amountCents;
  }
  const { totalFeesCents, taxCents, totalDueCents, frontGrossCents } = computeDealTotals({
    salePriceCents: input.salePriceCents,
    purchasePriceCents: input.purchasePriceCents,
    docFeeCents,
    downPaymentCents,
    taxRateBps: input.taxRateBps,
    customFeesCents,
    taxableCustomFeesCents,
  });

  const created = await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        dealershipId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        salePriceCents: input.salePriceCents,
        purchasePriceCents: input.purchasePriceCents,
        taxRateBps: input.taxRateBps,
        taxCents,
        docFeeCents,
        downPaymentCents,
        totalFeesCents,
        totalDueCents,
        frontGrossCents,
        notes: input.notes ?? null,
      },
    });
    const financeTotals = computeFinanceTotals({
      financingMode: input.financingMode,
      baseAmountCents: totalDueCents,
      financedProductsCents: BigInt(0),
      cashDownCents: downPaymentCents,
      termMonths: 0,
      aprBps: 0,
    });
    await tx.dealFinance.create({
      data: {
        dealershipId,
        dealId: deal.id,
        financingMode: input.financingMode,
        cashDownCents: downPaymentCents,
        amountFinancedCents: financeTotals.amountFinancedCents,
        monthlyPaymentCents: financeTotals.monthlyPaymentCents,
        totalOfPaymentsCents: financeTotals.totalOfPaymentsCents,
        financeChargeCents: financeTotals.financeChargeCents,
        productsTotalCents: BigInt(0),
        backendGrossCents: BigInt(0),
        status: "DRAFT",
      },
    });
    for (const f of fees) {
      await tx.dealFee.create({
        data: {
          dealershipId,
          dealId: deal.id,
          label: f.label,
          amountCents: f.amountCents,
          taxable: f.taxable ?? false,
        },
      });
    }
    return deal;
  });

  const withRelations = await dealDb.getDealById(dealershipId, created.id);
  if (!withRelations) throw new ApiError("INTERNAL", "Deal not found after create");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.created",
    entity: "Deal",
    entityId: created.id,
    metadata: { dealId: created.id, customerId: input.customerId, vehicleId: input.vehicleId, status: "DRAFT" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("deal.created", {
    dealId: created.id,
    dealershipId,
    customerId: input.customerId,
  });
  return withRelations;
}

export type UpdateDealInput = {
  salePriceCents?: bigint;
  taxRateBps?: number;
  docFeeCents?: bigint;
  downPaymentCents?: bigint;
  notes?: string | null;
};

export async function updateDeal(
  dealershipId: string,
  userId: string,
  id: string,
  input: UpdateDealInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, id);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (deal.status === "CANCELED") {
    throw new ApiError("CONFLICT", "Deal is canceled; no updates allowed");
  }
  if (isContractLocked(deal.status)) {
    const hasFinancial = Object.keys(input).some((k) => FINANCIAL_FIELDS.has(k));
    if (hasFinancial)
      throw new ApiError("CONFLICT", "Deal is contracted; financial fields cannot be changed");
  }

  const updatePayload: dealDb.DealUpdateInput = {};
  if (input.salePriceCents !== undefined) updatePayload.salePriceCents = input.salePriceCents;
  if (input.taxRateBps !== undefined) updatePayload.taxRateBps = input.taxRateBps;
  if (input.docFeeCents !== undefined) updatePayload.docFeeCents = input.docFeeCents;
  if (input.downPaymentCents !== undefined) updatePayload.downPaymentCents = input.downPaymentCents;
  if (input.notes !== undefined) updatePayload.notes = input.notes;

  if (Object.keys(updatePayload).length > 0) {
    await dealDb.updateDeal(dealershipId, id, updatePayload);
    await recomputeAndPersistDealTotals(dealershipId, id, {
      salePriceCents: (updatePayload.salePriceCents ?? deal.salePriceCents) as bigint,
      purchasePriceCents: deal.purchasePriceCents,
      docFeeCents: (updatePayload.docFeeCents ?? deal.docFeeCents) as bigint,
      downPaymentCents: (updatePayload.downPaymentCents ?? deal.downPaymentCents) as bigint,
      taxRateBps: updatePayload.taxRateBps ?? deal.taxRateBps,
    });
  }

  const updated = await dealDb.getDealById(dealershipId, id);
  if (!updated) throw new ApiError("NOT_FOUND", "Deal not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.updated",
    entity: "Deal",
    entityId: id,
    metadata: { dealId: id, changedFields: Object.keys(input) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function deleteDeal(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, id);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  await dealDb.softDeleteDeal(dealershipId, id, userId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.deleted",
    entity: "Deal",
    entityId: id,
    metadata: { dealId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { id };
}

export async function addFee(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: { label: string; amountCents: bigint; taxable?: boolean },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; fees cannot be modified");

  const fee = await feeDb.addFee(dealershipId, dealId, {
    label: input.label,
    amountCents: input.amountCents,
    taxable: input.taxable ?? false,
  });
  await recomputeAndPersistDealTotals(dealershipId, dealId, {
    salePriceCents: deal.salePriceCents,
    purchasePriceCents: deal.purchasePriceCents,
    docFeeCents: deal.docFeeCents,
    downPaymentCents: deal.downPaymentCents,
    taxRateBps: deal.taxRateBps,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.fee_added",
    entity: "DealFee",
    entityId: fee.id,
    metadata: { dealId, feeId: fee.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return fee;
}

export async function updateFee(
  dealershipId: string,
  userId: string,
  dealId: string,
  feeId: string,
  input: { label?: string; amountCents?: bigint; taxable?: boolean },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; fees cannot be modified");

  const fee = await feeDb.updateFee(dealershipId, dealId, feeId, input);
  if (!fee) throw new ApiError("NOT_FOUND", "Fee not found");
  await recomputeAndPersistDealTotals(dealershipId, dealId, {
    salePriceCents: deal.salePriceCents,
    purchasePriceCents: deal.purchasePriceCents,
    docFeeCents: deal.docFeeCents,
    downPaymentCents: deal.downPaymentCents,
    taxRateBps: deal.taxRateBps,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.fee_updated",
    entity: "DealFee",
    entityId: feeId,
    metadata: { dealId, feeId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return fee;
}

export async function deleteFee(
  dealershipId: string,
  userId: string,
  dealId: string,
  feeId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; fees cannot be modified");

  const fee = await feeDb.deleteFee(dealershipId, dealId, feeId);
  if (!fee) throw new ApiError("NOT_FOUND", "Fee not found");
  await recomputeAndPersistDealTotals(dealershipId, dealId, {
    salePriceCents: deal.salePriceCents,
    purchasePriceCents: deal.purchasePriceCents,
    docFeeCents: deal.docFeeCents,
    downPaymentCents: deal.downPaymentCents,
    taxRateBps: deal.taxRateBps,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.fee_deleted",
    entity: "DealFee",
    entityId: feeId,
    metadata: { dealId, feeId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return;
}

export async function listTrades(
  dealershipId: string,
  dealId: string,
  options: { limit: number; offset: number }
) {
  await requireTenantActiveForRead(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  return tradeDb.listTradesByDealId(dealershipId, dealId, options);
}

export async function addTrade(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: { vehicleDescription: string; allowanceCents: bigint; payoffCents?: bigint },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; trade cannot be modified");

  const payoffCents = input.payoffCents ?? BigInt(0);
  const created = await tradeDb.addTrade(dealershipId, dealId, {
    vehicleDescription: input.vehicleDescription,
    allowanceCents: input.allowanceCents,
    payoffCents,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.trade_added",
    entity: "DealTrade",
    entityId: created.id,
    metadata: { dealId, tradeId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function addOrUpdateTrade(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: { vehicleDescription: string; allowanceCents: bigint; payoffCents?: bigint },
  meta?: { ip?: string; userAgent?: string }
) {
  const existing = await tradeDb.getTradeByDealId(dealershipId, dealId);
  if (existing) return updateTrade(dealershipId, userId, dealId, existing.id, input, meta);
  return addTrade(dealershipId, userId, dealId, input, meta);
}

export async function deleteTrade(
  dealershipId: string,
  userId: string,
  dealId: string,
  tradeId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; trade cannot be modified");

  const trade = await tradeDb.deleteTrade(dealershipId, dealId, tradeId);
  if (!trade) throw new ApiError("NOT_FOUND", "Trade not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.trade_deleted",
    entity: "DealTrade",
    entityId: tradeId,
    metadata: { dealId, tradeId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function updateTrade(
  dealershipId: string,
  userId: string,
  dealId: string,
  tradeId: string,
  input: { vehicleDescription?: string; allowanceCents?: bigint; payoffCents?: bigint },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (isContractLocked(deal.status))
    throw new ApiError("CONFLICT", "Deal is contracted; trade cannot be modified");

  const updated = await tradeDb.updateTrade(dealershipId, dealId, tradeId, input);
  if (!updated) throw new ApiError("NOT_FOUND", "Trade not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.trade_updated",
    entity: "DealTrade",
    entityId: tradeId,
    metadata: { dealId, tradeId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function updateDealStatus(
  dealershipId: string,
  userId: string,
  dealId: string,
  toStatus: DealStatus,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  const fromStatus = deal.status;
  if (!isAllowedTransition(fromStatus, toStatus))
    throw new ApiError("VALIDATION_ERROR", `Status transition from ${fromStatus} to ${toStatus} is not allowed`);

  await historyDb.insertDealHistory(dealershipId, dealId, {
    fromStatus,
    toStatus,
    changedBy: userId,
  });
  await prisma.deal.update({
    where: { id: dealId },
    data: { status: toStatus },
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.status_changed",
    entity: "Deal",
    entityId: dealId,
    metadata: { dealId, fromStatus, toStatus },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("deal.status_changed", {
    dealId,
    dealershipId,
    from: fromStatus,
    to: toStatus,
  });

  const updated = await dealDb.getDealById(dealershipId, dealId);
  if (!updated) throw new ApiError("NOT_FOUND", "Deal not found");

  if (toStatus === "CONTRACTED") {
    emitEvent("deal.sold", {
      dealId,
      dealershipId,
      amount: Number(updated.salePriceCents ?? 0),
    });
  }

  return updated;
}

export async function listDealHistory(
  dealershipId: string,
  dealId: string,
  options?: { limit?: number; offset?: number }
) {
  await requireTenantActiveForRead(dealershipId);
  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");
  return historyDb.listDealHistory(dealershipId, dealId, options);
}
