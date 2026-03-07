/**
 * Deal Desk unified data loader and full-desk save. Fetches deal, activity, audit for /deals/[id].
 * Full-desk save: one transaction for deal + fees + trade + finance + products.
 */

import { prisma } from "@/lib/db";
import * as dealDb from "../db/deal";
import * as historyDb from "../db/history";
import * as auditService from "@/modules/core-platform/service/audit";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import { toDealDetail } from "@/app/api/deals/serialize";
import type {
  DealDetail,
  DealDeskData,
  DealHistoryEntry,
  DealAuditEntry,
  DealStatus,
} from "@/modules/deals/ui/types";
import { computeDealTotals } from "./calculations";
import {
  computeFinanceTotals,
  type FinancingMode,
} from "@/modules/finance-shell/service/calculations";
import { auditLog } from "@/lib/audit";

const ACTIVITY_LIMIT = 50;
const AUDIT_LIMIT = 50;

/** Re-export for callers that import from service */
export type { DealHistoryEntry, DealAuditEntry, DealDeskData } from "@/modules/deals/ui/types";

/**
 * Load all data required for the Deal Desk. Scoped by dealershipId.
 * Throws ApiError NOT_FOUND if deal does not exist or belongs to another tenant.
 */
export async function getDealDeskData(
  dealershipId: string,
  dealId: string
): Promise<DealDeskData> {
  await requireTenantActiveForRead(dealershipId);

  const deal = await dealDb.getDealById(dealershipId, dealId);
  if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");

  const [activityResult, auditResult] = await Promise.all([
    historyDb.listDealHistory(dealershipId, dealId, {
      limit: ACTIVITY_LIMIT,
      offset: 0,
    }),
    auditService.listAuditLogs(dealershipId, AUDIT_LIMIT, 0, {
      entity: "Deal",
      entityId: dealId,
    }),
  ]);

  const dealDetail = toDealDetail(deal) as DealDetail;

  const activity: DealHistoryEntry[] = activityResult.data.map((h) => ({
    id: h.id,
    fromStatus: h.fromStatus as DealStatus | null,
    toStatus: h.toStatus as DealStatus,
    changedBy: h.changedBy,
    createdAt: h.createdAt.toISOString(),
  }));

  const audit: DealAuditEntry[] = auditResult.data.map((a) => ({
    id: a.id,
    entity: a.entity,
    entityId: a.entityId,
    action: a.action,
    actorId: a.actorId,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    deal: dealDetail,
    activity,
    activityTotal: activityResult.total,
    audit,
    auditTotal: auditResult.total,
  };
}

export type DeskFeeItem = {
  id?: string;
  label: string;
  amountCents: bigint;
  taxable: boolean;
};

export type DeskTradeItem = {
  id?: string;
  vehicleDescription: string;
  allowanceCents: bigint;
  payoffCents: bigint;
};

export type DeskProductItem = {
  id?: string;
  productType: string;
  name: string;
  priceCents: bigint;
  costCents: bigint | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
};

export type FullDeskPayload = {
  salePriceCents?: bigint;
  taxRateBps?: number;
  docFeeCents?: bigint;
  downPaymentCents?: bigint;
  notes?: string | null;
  cashDownCents?: bigint;
  termMonths?: number | null;
  aprBps?: number | null;
  fees?: DeskFeeItem[];
  trade?: DeskTradeItem | null;
  products?: DeskProductItem[];
};

/**
 * Full-desk save in one transaction: deal, fees (replace), trade (upsert/remove), finance, products (replace).
 * Enforces tenant isolation; CONTRACTED deals reject.
 */
export async function saveFullDealDesk(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: FullDeskPayload,
  meta?: { ip?: string; userAgent?: string }
): Promise<DealDetail> {
  await requireTenantActiveForWrite(dealershipId);

  const existingDeal = await dealDb.getDealById(dealershipId, dealId);
  if (!existingDeal) throw new ApiError("NOT_FOUND", "Deal not found");
  if (existingDeal.status === "CONTRACTED") {
    throw new ApiError("CONFLICT", "Deal is contracted; cannot modify");
  }

  await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({
      where: { id: dealId, dealershipId, deletedAt: null },
    });
    if (!deal) throw new ApiError("NOT_FOUND", "Deal not found");

    let salePriceCents = deal.salePriceCents;
    let taxRateBps = deal.taxRateBps;
    let docFeeCents = deal.docFeeCents;
    let downPaymentCents = deal.downPaymentCents;
    let notes = deal.notes;
    if (input.salePriceCents !== undefined) salePriceCents = input.salePriceCents;
    if (input.taxRateBps !== undefined) taxRateBps = input.taxRateBps;
    if (input.docFeeCents !== undefined) docFeeCents = input.docFeeCents;
    if (input.downPaymentCents !== undefined) downPaymentCents = input.downPaymentCents;
    if (input.cashDownCents !== undefined) downPaymentCents = input.cashDownCents;
    if (input.notes !== undefined) notes = input.notes;

    await tx.deal.update({
      where: { id: dealId },
      data: {
        salePriceCents,
        taxRateBps,
        docFeeCents,
        downPaymentCents,
        notes,
      },
    });

    if (input.fees !== undefined) {
      const existingFees = await tx.dealFee.findMany({
        where: { dealershipId, dealId },
      });
      const payloadIds = new Set(
        input.fees.map((f) => f.id).filter((id): id is string => id != null)
      );
      const toDelete = existingFees.filter((f) => !payloadIds.has(f.id));
      for (const f of toDelete) {
        await tx.dealFee.delete({ where: { id: f.id } });
      }
      for (const item of input.fees) {
        if (item.id && existingFees.some((f) => f.id === item.id)) {
          await tx.dealFee.update({
            where: { id: item.id },
            data: {
              label: item.label,
              amountCents: item.amountCents,
              taxable: item.taxable,
            },
          });
        } else if (!item.id) {
          await tx.dealFee.create({
            data: {
              dealershipId,
              dealId,
              label: item.label,
              amountCents: item.amountCents,
              taxable: item.taxable,
            },
          });
        }
      }
    }

    const feesAfter = await tx.dealFee.findMany({
      where: { dealershipId, dealId },
      orderBy: { createdAt: "asc" },
    });
    let customFeesCents = BigInt(0);
    let taxableCustomFeesCents = BigInt(0);
    for (const f of feesAfter) {
      customFeesCents += f.amountCents;
      if (f.taxable) taxableCustomFeesCents += f.amountCents;
    }
    const dealTotals = computeDealTotals({
      salePriceCents,
      purchasePriceCents: deal.purchasePriceCents,
      docFeeCents,
      downPaymentCents,
      taxRateBps,
      customFeesCents,
      taxableCustomFeesCents,
    });
    await tx.deal.update({
      where: { id: dealId },
      data: {
        totalFeesCents: dealTotals.totalFeesCents,
        taxCents: dealTotals.taxCents,
        totalDueCents: dealTotals.totalDueCents,
        frontGrossCents: dealTotals.frontGrossCents,
      },
    });

    if (input.trade !== undefined) {
      const existingTrade = await tx.dealTrade.findFirst({
        where: { dealershipId, dealId },
      });
      if (input.trade === null) {
        if (existingTrade) await tx.dealTrade.delete({ where: { id: existingTrade.id } });
      } else {
        const payload = {
          vehicleDescription: input.trade.vehicleDescription,
          allowanceCents: input.trade.allowanceCents,
          payoffCents: input.trade.payoffCents,
        };
        if (existingTrade) {
          await tx.dealTrade.update({
            where: { id: existingTrade.id },
            data: payload,
          });
        } else {
          await tx.dealTrade.create({
            data: {
              dealershipId,
              dealId,
              ...payload,
            },
          });
        }
      }
    }

    let finance = await tx.dealFinance.findFirst({
      where: { dealId, dealershipId, deletedAt: null },
    });
    const needFinance =
      input.cashDownCents !== undefined ||
      input.termMonths !== undefined ||
      input.aprBps !== undefined ||
      (input.products !== undefined && input.products.length > 0);
    const cashDownCents = input.cashDownCents ?? deal.downPaymentCents;
    const termMonths = input.termMonths ?? finance?.termMonths ?? null;
    const aprBps = input.aprBps ?? finance?.aprBps ?? null;

    if (needFinance && !finance) {
      const dealRow = await tx.deal.findFirst({
        where: { id: dealId, dealershipId },
      });
      const totalDueCents = dealRow!.totalDueCents;
      const totals = computeFinanceTotals({
        financingMode: "FINANCE" as FinancingMode,
        baseAmountCents: totalDueCents,
        financedProductsCents: BigInt(0),
        cashDownCents,
        termMonths: termMonths ?? 0,
        aprBps: aprBps ?? 0,
      });
      finance = await tx.dealFinance.create({
        data: {
          dealershipId,
          dealId,
          financingMode: "FINANCE",
          termMonths,
          aprBps,
          cashDownCents,
          amountFinancedCents: totals.amountFinancedCents,
          monthlyPaymentCents: totals.monthlyPaymentCents,
          totalOfPaymentsCents: totals.totalOfPaymentsCents,
          financeChargeCents: totals.financeChargeCents,
          productsTotalCents: BigInt(0),
          backendGrossCents: BigInt(0),
          status: "DRAFT",
        },
      });
    }

    if (finance && input.products !== undefined) {
      const existingProducts = await tx.dealFinanceProduct.findMany({
        where: { dealFinanceId: finance.id, dealershipId, deletedAt: null },
      });
      const payloadIds = new Set(
        input.products.map((p) => p.id).filter((id): id is string => id != null)
      );
      const toSoftDelete = existingProducts.filter((p) => !payloadIds.has(p.id));
      for (const p of toSoftDelete) {
        await tx.dealFinanceProduct.update({
          where: { id: p.id },
          data: { deletedAt: new Date(), deletedBy: userId },
        });
      }
      for (const item of input.products) {
        const data = {
          productType: item.productType as "GAP" | "VSC" | "MAINTENANCE" | "TIRE_WHEEL" | "OTHER",
          name: item.name,
          priceCents: item.priceCents,
          costCents: item.costCents,
          taxable: item.taxable,
          includedInAmountFinanced: item.includedInAmountFinanced,
        };
        if (item.id && existingProducts.some((p) => p.id === item.id)) {
          await tx.dealFinanceProduct.update({
            where: { id: item.id },
            data,
          });
        } else if (!item.id) {
          await tx.dealFinanceProduct.create({
            data: {
              dealershipId,
              dealFinanceId: finance.id,
              ...data,
            },
          });
        }
      }
    }

    const shouldRecomputeFinance =
      finance &&
      (input.cashDownCents !== undefined ||
        input.termMonths !== undefined ||
        input.aprBps !== undefined ||
        input.products !== undefined);
    if (shouldRecomputeFinance) {
      const dealRow = await tx.deal.findFirst({
        where: { id: dealId, dealershipId },
      });
      const products = await tx.dealFinanceProduct.findMany({
        where: { dealFinanceId: finance!.id, dealershipId, deletedAt: null },
      });
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
      const finCashDown = input.cashDownCents ?? finance!.cashDownCents;
      const finTerm = input.termMonths ?? finance!.termMonths ?? 0;
      const finApr = input.aprBps ?? finance!.aprBps ?? 0;
      const totals = computeFinanceTotals({
        financingMode: "FINANCE" as FinancingMode,
        baseAmountCents: dealRow!.totalDueCents,
        financedProductsCents,
        cashDownCents: finCashDown,
        termMonths: finTerm,
        aprBps: finApr,
      });
      await tx.dealFinance.update({
        where: { id: finance!.id },
        data: {
          cashDownCents: finCashDown,
          termMonths: input.termMonths ?? finance!.termMonths,
          aprBps: input.aprBps ?? finance!.aprBps,
          amountFinancedCents: totals.amountFinancedCents,
          monthlyPaymentCents: totals.monthlyPaymentCents,
          totalOfPaymentsCents: totals.totalOfPaymentsCents,
          financeChargeCents: totals.financeChargeCents,
          productsTotalCents,
          backendGrossCents,
        },
      });
    }
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal.updated",
    entity: "Deal",
    entityId: dealId,
    metadata: { dealId, source: "desk.full_save" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const updated = await dealDb.getDealById(dealershipId, dealId);
  if (!updated) throw new ApiError("NOT_FOUND", "Deal not found");
  return toDealDetail(updated) as DealDetail;
}

/** @deprecated Use saveFullDealDesk with FullDeskPayload. Kept for backward compatibility. */
export type UpdateDealDeskInput = FullDeskPayload;

/** @deprecated Use saveFullDealDesk. Thin wrapper that builds FullDeskPayload from partial input. */
export async function updateDealDesk(
  dealershipId: string,
  userId: string,
  dealId: string,
  input: FullDeskPayload,
  meta?: { ip?: string; userAgent?: string }
): Promise<DealDetail> {
  return saveFullDealDesk(dealershipId, userId, dealId, input, meta);
}
