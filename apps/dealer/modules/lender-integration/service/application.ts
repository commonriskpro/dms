import * as applicationDb from "../db/application";
import * as dealService from "@/modules/deals/service/deal";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function getApplication(
  dealershipId: string,
  dealId: string,
  applicationId: string
): Promise<Awaited<ReturnType<typeof applicationDb.getApplicationById>> | null> {
  await requireTenantActiveForRead(dealershipId);
  await dealService.getDeal(dealershipId, dealId);
  const app = await applicationDb.getApplicationById(dealershipId, applicationId);
  if (!app || app.dealId !== dealId) return null;
  return app;
}

export async function listApplications(
  dealershipId: string,
  dealId: string,
  options: applicationDb.ListApplicationsOptions
): Promise<ReturnType<typeof applicationDb.listApplicationsByDealId>> {
  await requireTenantActiveForRead(dealershipId);
  await dealService.getDeal(dealershipId, dealId);
  return applicationDb.listApplicationsByDealId(dealershipId, dealId, options);
}

export async function createApplication(
  dealershipId: string,
  userId: string,
  dealId: string,
  data: Partial<applicationDb.FinanceApplicationCreateInput>,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof applicationDb.createApplication>>> {
  await requireTenantActiveForWrite(dealershipId);
  await dealService.getDeal(dealershipId, dealId);
  const created = await applicationDb.createApplication(dealershipId, {
    dealId,
    status: data.status ?? "DRAFT",
    createdBy: data.createdBy ?? userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance_application.created",
    entity: "finance_application",
    entityId: created.id,
    metadata: { applicationId: created.id, dealId, dealershipId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateApplication(
  dealershipId: string,
  userId: string,
  dealId: string,
  applicationId: string,
  data: applicationDb.FinanceApplicationUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<Awaited<ReturnType<typeof applicationDb.updateApplication>>> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await getApplication(dealershipId, dealId, applicationId);
  if (!existing) throw new ApiError("NOT_FOUND", "Application not found");
  const updated = await applicationDb.updateApplication(dealershipId, applicationId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Application not found");
  const changedFields = Object.keys(data) as string[];
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "finance_application.updated",
    entity: "finance_application",
    entityId: applicationId,
    metadata: { applicationId, changedFields },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
