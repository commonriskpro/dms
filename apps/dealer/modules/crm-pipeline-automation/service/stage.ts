import * as stageDb from "../db/stage";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type CreateStageInput = stageDb.CreateStageInput;
export type UpdateStageInput = stageDb.UpdateStageInput;

export async function listStages(dealershipId: string, pipelineId: string) {
  await requireTenantActiveForRead(dealershipId);
  return stageDb.listStagesByPipelineId(dealershipId, pipelineId);
}

export async function createStage(
  dealershipId: string,
  userId: string,
  pipelineId: string,
  data: CreateStageInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await stageDb.createStage(dealershipId, pipelineId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stage.created",
    entity: "Stage",
    entityId: created.id,
    metadata: { stageId: created.id, pipelineId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateStage(
  dealershipId: string,
  userId: string,
  id: string,
  data: UpdateStageInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await stageDb.updateStage(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Stage not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stage.updated",
    entity: "Stage",
    entityId: id,
    metadata: { stageId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

/** Delete stage. Block if opportunities exist (Option A per spec). */
export async function deleteStage(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const count = await stageDb.countOpportunitiesInStage(dealershipId, id);
  if (count > 0) {
    throw new ApiError("CONFLICT", "Reassign opportunities to another stage first.");
  }
  const deleted = await stageDb.deleteStage(dealershipId, id);
  if (!deleted) throw new ApiError("NOT_FOUND", "Stage not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stage.deleted",
    entity: "Stage",
    entityId: id,
    metadata: { stageId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return deleted;
}

/** Reassign all opportunities to targetStageId then delete stage. */
export async function deleteStageWithReassign(
  dealershipId: string,
  userId: string,
  stageId: string,
  targetStageId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deleted = await stageDb.reassignAndDeleteStage(dealershipId, stageId, targetStageId);
  if (!deleted) throw new ApiError("NOT_FOUND", "Stage not found or target stage invalid");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "stage.deleted",
    entity: "Stage",
    entityId: stageId,
    metadata: { stageId, targetStageId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return deleted;
}
