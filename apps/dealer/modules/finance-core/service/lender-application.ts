import * as lenderApplicationDb from "../db/lender-application";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as creditApplicationService from "./credit-application";
import * as dealService from "@/modules/deals/service/deal";
import { toBigIntOrNull } from "@/lib/bigint";

export async function getLenderApplication(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const app = await lenderApplicationDb.getLenderApplicationById(dealershipId, id);
  if (!app) throw new ApiError("NOT_FOUND", "Lender application not found");
  return app;
}

export async function listLenderApplications(
  dealershipId: string,
  options: lenderApplicationDb.ListLenderApplicationsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return lenderApplicationDb.listLenderApplications(dealershipId, options);
}

export async function createLenderApplication(
  dealershipId: string,
  userId: string,
  data: {
    creditApplicationId: string;
    dealId: string;
    lenderName: string;
    externalApplicationRef?: string | null;
    aprBps?: number | null;
    maxAmountCents?: string | null;
    maxAdvanceBps?: number | null;
    termMonths?: number | null;
    downPaymentRequiredCents?: string | null;
    decisionSummary?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await creditApplicationService.getCreditApplication(dealershipId, data.creditApplicationId);
  await dealService.getDeal(dealershipId, data.dealId);

  const created = await lenderApplicationDb.createLenderApplication({
    dealershipId,
    creditApplicationId: data.creditApplicationId,
    dealId: data.dealId,
    lenderName: data.lenderName,
    externalApplicationRef: data.externalApplicationRef ?? null,
    aprBps: data.aprBps ?? null,
    maxAmountCents: toBigIntOrNull(data.maxAmountCents),
    maxAdvanceBps: data.maxAdvanceBps ?? null,
    termMonths: data.termMonths ?? null,
    downPaymentRequiredCents: toBigIntOrNull(data.downPaymentRequiredCents),
    decisionSummary: data.decisionSummary ?? null,
    createdByUserId: userId,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender_application.created",
    entity: "LenderApplication",
    entityId: created.id,
    metadata: { creditApplicationId: data.creditApplicationId, dealId: data.dealId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return created;
}

export async function updateLenderApplication(
  dealershipId: string,
  userId: string,
  id: string,
  data: lenderApplicationDb.LenderApplicationUpdateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await getLenderApplication(dealershipId, id);

  const updated = await lenderApplicationDb.updateLenderApplication(dealershipId, id, {
    ...data,
    updatedByUserId: userId,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Lender application not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender_application.updated",
    entity: "LenderApplication",
    entityId: id,
    metadata: { changedFields: Object.keys(data) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}
