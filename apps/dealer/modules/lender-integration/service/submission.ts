import * as submissionDb from "../db/submission";
import * as applicationDb from "../db/application";
import * as lenderDb from "../db/lender";
import * as financeShellDb from "@/modules/finance-shell/db";
import * as dealService from "@/modules/deals/service/deal";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { FinanceSubmissionStatus, FinanceDecisionStatus, FinanceFundingStatus } from "@prisma/client";

const ALLOWED_STATUS_TRANSITIONS: Record<FinanceSubmissionStatus, FinanceSubmissionStatus[]> = {
  DRAFT: ["READY_TO_SUBMIT", "CANCELED"],
  READY_TO_SUBMIT: ["SUBMITTED", "CANCELED"],
  SUBMITTED: ["DECISIONED", "CANCELED"],
  DECISIONED: ["CANCELED"],
  FUNDED: ["CANCELED"],
  CANCELED: ["CANCELED"], // idempotent: allow no-op when already canceled
};

function validateStatusTransition(from: FinanceSubmissionStatus, to: FinanceSubmissionStatus): void {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Status transition from ${from} to ${to} is not allowed`
    );
  }
}

export async function getSubmission(
  dealershipId: string,
  dealId: string,
  applicationId: string,
  submissionId: string
): Promise<Awaited<ReturnType<typeof submissionDb.getSubmissionById>> | null> {
  await requireTenantActiveForRead(dealershipId);
  const app = await applicationDb.getApplicationById(dealershipId, applicationId);
  if (!app || app.dealId !== dealId) return null;
  const sub = await submissionDb.getSubmissionById(dealershipId, submissionId);
  if (!sub || sub.applicationId !== applicationId) return null;
  return sub;
}

export async function listSubmissions(
  dealershipId: string,
  dealId: string,
  applicationId: string,
  options: submissionDb.ListSubmissionsOptions
): Promise<ReturnType<typeof submissionDb.listSubmissionsByApplicationId>> {
  await requireTenantActiveForRead(dealershipId);
  const app = await applicationDb.getApplicationById(dealershipId, applicationId);
  if (!app || app.dealId !== dealId) return { data: [], total: 0 };
  return submissionDb.listSubmissionsByApplicationId(dealershipId, applicationId, options);
}

export async function createSubmission(
  dealershipId: string,
  userId: string,
  dealId: string,
  applicationId: string,
  data: { lenderId: string; reserveEstimateCents?: bigint | null },
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof submissionDb.createSubmission>>> {
  await requireTenantActiveForWrite(dealershipId);
  const app = await applicationDb.getApplicationById(dealershipId, applicationId);
  if (!app || app.dealId !== dealId) throw new ApiError("NOT_FOUND", "Application not found");

  const lender = await lenderDb.getLenderById(dealershipId, data.lenderId);
  if (!lender) throw new ApiError("NOT_FOUND", "Lender not found");
  if (!lender.isActive) throw new ApiError("VALIDATION_ERROR", "Lender is not active");

  const dealFinance = await financeShellDb.getFinanceByDealId(dealId, dealershipId);
  if (!dealFinance) throw new ApiError("VALIDATION_ERROR", "Deal finance not found; add finance structure before creating a submission");
  if (dealFinance.termMonths == null || dealFinance.aprBps == null) {
    throw new ApiError("VALIDATION_ERROR", "Deal finance must have term and APR set");
  }

  const created = await submissionDb.createSubmission(dealershipId, {
    applicationId,
    dealId,
    lenderId: data.lenderId,
    amountFinancedCents: dealFinance.amountFinancedCents,
    termMonths: dealFinance.termMonths,
    aprBps: dealFinance.aprBps,
    paymentCents: dealFinance.monthlyPaymentCents,
    productsTotalCents: dealFinance.productsTotalCents,
    backendGrossCents: dealFinance.backendGrossCents,
    reserveEstimateCents: data.reserveEstimateCents ?? null,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "submission.created",
    entity: "finance_submission",
    entityId: created.id,
    metadata: {
      submissionId: created.id,
      applicationId,
      dealId,
      lenderId: data.lenderId,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateSubmission(
  dealershipId: string,
  userId: string,
  dealId: string,
  applicationId: string,
  submissionId: string,
  data: submissionDb.FinanceSubmissionUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof submissionDb.updateSubmission>>> {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const existing = await getSubmission(dealershipId, dealId, applicationId, submissionId);
  if (!existing) throw new ApiError("NOT_FOUND", "Submission not found");

  if (deal.status === "CANCELED") {
    if (data.status !== "CANCELED") {
      throw new ApiError(
        "CONFLICT",
        "Deal is canceled; only submission status CANCELED is allowed"
      );
    }
    data = { status: "CANCELED" as const };
  }

  if (data.status !== undefined) {
    validateStatusTransition(existing.status, data.status);
    if (data.status === "SUBMITTED" && !existing.submittedAt) {
      (data as Record<string, unknown>).submittedAt = new Date();
    }
    if (
      (data.decisionStatus !== undefined || data.status === "DECISIONED") &&
      !existing.decisionedAt
    ) {
      (data as Record<string, unknown>).decisionedAt = new Date();
    }
  }

  const updated = await submissionDb.updateSubmission(dealershipId, submissionId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Submission not found");

  if (data.status !== undefined && data.status !== existing.status) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "submission.status_changed",
      entity: "finance_submission",
      entityId: submissionId,
      metadata: { submissionId, fromStatus: existing.status, toStatus: data.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  if (data.decisionStatus !== undefined && data.decisionStatus !== existing.decisionStatus) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "submission.decision_updated",
      entity: "finance_submission",
      entityId: submissionId,
      metadata: { submissionId, decisionStatus: data.decisionStatus },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function updateSubmissionFunding(
  dealershipId: string,
  userId: string,
  dealId: string,
  applicationId: string,
  submissionId: string,
  data: submissionDb.FinanceSubmissionFundingInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof submissionDb.updateSubmissionFunding>>> {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const existing = await getSubmission(dealershipId, dealId, applicationId, submissionId);
  if (!existing) throw new ApiError("NOT_FOUND", "Submission not found");

  if (deal.status === "CANCELED") {
    if (data.fundingStatus !== "CANCELED") {
      throw new ApiError(
        "CONFLICT",
        "Deal is canceled; only funding status CANCELED is allowed"
      );
    }
  }

  if (data.fundingStatus === "FUNDED") {
    if (deal.status !== "CONTRACTED") {
      throw new ApiError(
        "CONFLICT",
        "Deal must be CONTRACTED before submission can be marked FUNDED"
      );
    }
  }

  const updated = await submissionDb.updateSubmissionFunding(dealershipId, submissionId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Submission not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "submission.funding_updated",
    entity: "finance_submission",
    entityId: submissionId,
    metadata: { submissionId, fundingStatus: data.fundingStatus },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}
