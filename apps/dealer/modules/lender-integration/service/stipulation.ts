import { prisma } from "@/lib/db";
import * as stipulationDb from "../db/stipulation";
import * as submissionDb from "../db/submission";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

const DEAL_ENTITY_TYPE = "DEAL";

export async function listStipulations(
  dealershipId: string,
  submissionId: string,
  options: stipulationDb.ListStipulationsOptions
): Promise<ReturnType<typeof stipulationDb.listStipulationsBySubmissionId>> {
  await requireTenantActiveForRead(dealershipId);
  const sub = await submissionDb.getSubmissionById(dealershipId, submissionId);
  if (!sub) return { data: [], total: 0 };
  return stipulationDb.listStipulationsBySubmissionId(dealershipId, submissionId, options);
}

function validateStipDocument(
  dealershipId: string,
  dealId: string,
  documentId: string
): Promise<void> {
  return prisma.fileObject
    .findFirst({
      where: {
        id: documentId,
        dealershipId,
        entityType: DEAL_ENTITY_TYPE,
        entityId: dealId,
        deletedAt: null,
      },
    })
    .then((file) => {
      if (!file) throw new ApiError("NOT_FOUND", "Document not found or not linked to this deal");
    });
}

export async function createStipulation(
  dealershipId: string,
  userId: string,
  submissionId: string,
  data: Omit<stipulationDb.FinanceStipulationCreateInput, "submissionId">,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof stipulationDb.createStipulation>>> {
  await requireTenantActiveForWrite(dealershipId);
  const sub = await submissionDb.getSubmissionById(dealershipId, submissionId);
  if (!sub) throw new ApiError("NOT_FOUND", "Submission not found");
  const created = await stipulationDb.createStipulation(dealershipId, {
    submissionId,
    stipType: data.stipType,
    status: data.status,
    requestedAt: data.requestedAt,
    notes: data.notes,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stip.created",
    entity: "finance_stipulation",
    entityId: created.id,
    metadata: { stipId: created.id, submissionId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateStipulation(
  dealershipId: string,
  userId: string,
  submissionId: string,
  stipId: string,
  data: stipulationDb.FinanceStipulationUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof stipulationDb.updateStipulation>>> {
  await requireTenantActiveForWrite(dealershipId);
  const sub = await submissionDb.getSubmissionById(dealershipId, submissionId);
  if (!sub) throw new ApiError("NOT_FOUND", "Submission not found");
  const existing = await stipulationDb.getStipulationById(dealershipId, stipId);
  if (!existing || existing.submissionId !== submissionId) throw new ApiError("NOT_FOUND", "Stipulation not found");

  if (data.documentId !== undefined && data.documentId !== null) {
    await validateStipDocument(dealershipId, sub.dealId, data.documentId);
  }

  const updated = await stipulationDb.updateStipulation(dealershipId, stipId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Stipulation not found");

  const changedFields = Object.keys(data) as string[];
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stip.updated",
    entity: "finance_stipulation",
    entityId: stipId,
    metadata: { stipId, changedFields },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  if (data.documentId !== undefined && data.documentId !== null) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "stip.document_linked",
      entity: "finance_stipulation",
      entityId: stipId,
      metadata: { stipId, documentId: data.documentId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function deleteStipulation(
  dealershipId: string,
  userId: string,
  submissionId: string,
  stipId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ id: string }> {
  await requireTenantActiveForWrite(dealershipId);
  const sub = await submissionDb.getSubmissionById(dealershipId, submissionId);
  if (!sub) throw new ApiError("NOT_FOUND", "Submission not found");
  const deleted = await stipulationDb.deleteStipulation(dealershipId, stipId);
  if (!deleted) throw new ApiError("NOT_FOUND", "Stipulation not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stip.deleted",
    entity: "finance_stipulation",
    entityId: stipId,
    metadata: { stipId, submissionId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { id: deleted.id };
}
