import * as opportunityDb from "../db/opportunity";
import * as activityDb from "../db/opportunity-activity";
import * as stageDb from "../db/stage";
import * as customersService from "@/modules/customers/service/customer";
import { ensureAutomationHandlersRegistered } from "./automation-engine";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { OpportunityStatus } from "@prisma/client";

export type OpportunityListOptions = opportunityDb.OpportunityListOptions;
export type CreateOpportunityInput = opportunityDb.CreateOpportunityInput;
export type UpdateOpportunityInput = opportunityDb.UpdateOpportunityInput;

export async function listOpportunities(dealershipId: string, options: OpportunityListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return opportunityDb.listOpportunities(dealershipId, options);
}

export async function getOpportunity(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const o = await opportunityDb.getOpportunityById(dealershipId, id);
  if (!o) throw new ApiError("NOT_FOUND", "Opportunity not found");
  return o;
}

export async function createOpportunity(
  dealershipId: string,
  userId: string,
  data: CreateOpportunityInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  ensureAutomationHandlersRegistered();
  await customersService.getCustomer(dealershipId, data.customerId);
  if (data.stageId) {
    const stage = await stageDb.getStageById(dealershipId, data.stageId);
    if (!stage) throw new ApiError("NOT_FOUND", "Stage not found");
  }
  const created = await opportunityDb.createOpportunity(dealershipId, data);
  await activityDb.appendActivity(dealershipId, {
    opportunityId: created.id,
    activityType: "created",
    actorId: userId,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "opportunity.created",
    entity: "Opportunity",
    entityId: created.id,
    metadata: { opportunityId: created.id, customerId: created.customerId, stageId: created.stageId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("opportunity.created", {
    opportunityId: created.id,
    customerId: created.customerId,
    stageId: created.stageId,
    dealershipId,
  });
  return created;
}

export async function updateOpportunity(
  dealershipId: string,
  userId: string,
  id: string,
  data: UpdateOpportunityInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  ensureAutomationHandlersRegistered();
  const existing = await opportunityDb.getOpportunityById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Opportunity not found");
  if (data.status === "LOST" && data.lossReason === undefined && !existing.lossReason) {
    throw new ApiError("VALIDATION_ERROR", "lossReason required when status is LOST");
  }
  if (data.stageId && data.stageId !== existing.stageId) {
    const stage = await stageDb.getStageById(dealershipId, data.stageId);
    if (!stage) throw new ApiError("NOT_FOUND", "Stage not found");
  }
  const updated = await opportunityDb.updateOpportunity(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Opportunity not found");

  if (data.stageId !== undefined && data.stageId !== existing.stageId) {
    await activityDb.appendActivity(dealershipId, {
      opportunityId: id,
      activityType: "stage_changed",
      fromStageId: existing.stageId,
      toStageId: data.stageId,
      actorId: userId,
    });
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "opportunity.stage_changed",
      entity: "Opportunity",
      entityId: id,
      metadata: { opportunityId: id, fromStageId: existing.stageId, toStageId: data.stageId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    emitEvent("opportunity.stage_changed", {
      opportunityId: id,
      fromStageId: existing.stageId,
      toStageId: data.stageId,
      dealershipId,
    });
  }

  if (data.status !== undefined && data.status !== existing.status && (data.status === "WON" || data.status === "LOST")) {
    await activityDb.appendActivity(dealershipId, {
      opportunityId: id,
      activityType: "status_changed",
      metadata: { fromStatus: existing.status, toStatus: data.status },
      actorId: userId,
    });
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "opportunity.status_changed",
      entity: "Opportunity",
      entityId: id,
      metadata: { opportunityId: id, fromStatus: existing.status, toStatus: data.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    emitEvent("opportunity.status_changed", {
      opportunityId: id,
      fromStatus: existing.status,
      toStatus: data.status as OpportunityStatus,
      dealershipId,
    });
  }

  return updated;
}

export async function listActivity(
  dealershipId: string,
  opportunityId: string,
  options: { limit: number; offset: number }
) {
  await requireTenantActiveForRead(dealershipId);
  const opp = await opportunityDb.getOpportunityById(dealershipId, opportunityId);
  if (!opp) throw new ApiError("NOT_FOUND", "Opportunity not found");
  return activityDb.listActivityByOpportunityId(dealershipId, opportunityId, options);
}
