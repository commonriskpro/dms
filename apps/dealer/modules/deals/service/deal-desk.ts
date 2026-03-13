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
    let salePriceCents = existingDeal.salePriceCents;
    let taxRateBps = existingDeal.taxRateBps;
    let docFeeCents = existingDeal.docFeeCents;
    let downPaymentCents = existingDeal.downPaymentCents;
    let notes = existingDeal.notes;
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
      const toDeleteIds = existingFees.filter((f) => !payloadIds.has(f.id)).map((f) => f.id);
      if (toDeleteIds.length > 0) {
        await tx.dealFee.deleteMany({ where: { id: { in: toDeleteIds } } });
      }
      const toUpdate = input.fees.filter((item) => item.id && existingFees.some((f) => f.id === item.id));
      const toCreate = input.fees.filter((item) => !item.id);
      await Promise.all([
        ...toUpdate.map((item) =>
          tx.dealFee.update({
            where: { id: item.id! },
            data: { label: item.label, amountCents: item.amountCents, taxable: item.taxable },
          })
        ),
        ...(toCreate.length > 0
          ? [tx.dealFee.createMany({
              data: toCreate.map((item) => ({
                dealershipId,
                dealId,
                label: item.label,
                amountCents: item.amountCents,
                taxable: item.taxable,
              })),
            })]
          : []),
      ]);
    }

    const feesAfter = await tx.dealFee.findMany({
      where: { dealershipId, dealId },
      select: { amountCents: true, taxable: true },
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
      purchasePriceCents: existingDeal.purchasePriceCents,
      docFeeCents,
      downPaymentCents,
      taxRateBps,
      customFeesCents,
      taxableCustomFeesCents,
    });
    const updatedDeal = await tx.deal.update({
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
    const cashDownCents = input.cashDownCents ?? existingDeal.downPaymentCents;
    const termMonths = input.termMonths ?? finance?.termMonths ?? null;
    const aprBps = input.aprBps ?? finance?.aprBps ?? null;
    const financingMode = (finance?.financingMode ?? "FINANCE") as FinancingMode;

    if (needFinance && !finance) {
      const totalDueCents = updatedDeal.totalDueCents;
      const totals = computeFinanceTotals({
        financingMode,
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
          financingMode,
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
      if (toSoftDelete.length > 0) {
        const now = new Date();
        await tx.dealFinanceProduct.updateMany({
          where: { id: { in: toSoftDelete.map((p) => p.id) } },
          data: { deletedAt: now, deletedBy: userId },
        });
      }
      const prodToUpdate = input.products.filter((item) => item.id && existingProducts.some((p) => p.id === item.id));
      const prodToCreate = input.products.filter((item) => !item.id);
      await Promise.all([
        ...prodToUpdate.map((item) =>
          tx.dealFinanceProduct.update({
            where: { id: item.id! },
            data: {
              productType: item.productType as "GAP" | "VSC" | "MAINTENANCE" | "TIRE_WHEEL" | "OTHER",
              name: item.name,
              priceCents: item.priceCents,
              costCents: item.costCents,
              taxable: item.taxable,
              includedInAmountFinanced: item.includedInAmountFinanced,
            },
          })
        ),
        ...(prodToCreate.length > 0
          ? [tx.dealFinanceProduct.createMany({
              data: prodToCreate.map((item) => ({
                dealershipId,
                dealFinanceId: finance!.id,
                productType: item.productType as "GAP" | "VSC" | "MAINTENANCE" | "TIRE_WHEEL" | "OTHER",
                name: item.name,
                priceCents: item.priceCents,
                costCents: item.costCents,
                taxable: item.taxable,
                includedInAmountFinanced: item.includedInAmountFinanced,
              })),
            })]
          : []),
      ]);
    }

    const shouldRecomputeFinance =
      finance &&
      (input.cashDownCents !== undefined ||
        input.termMonths !== undefined ||
        input.aprBps !== undefined ||
        input.products !== undefined);
    if (shouldRecomputeFinance) {
      const products = await tx.dealFinanceProduct.findMany({
        where: { dealFinanceId: finance!.id, dealershipId, deletedAt: null },
        select: { priceCents: true, costCents: true, includedInAmountFinanced: true },
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
        financingMode,
        baseAmountCents: updatedDeal.totalDueCents,
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
