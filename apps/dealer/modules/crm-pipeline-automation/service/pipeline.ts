import * as pipelineDb from "../db/pipeline";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type PipelineListOptions = pipelineDb.PipelineListOptions;
export type CreatePipelineInput = pipelineDb.CreatePipelineInput;
export type UpdatePipelineInput = pipelineDb.UpdatePipelineInput;

export async function listPipelines(dealershipId: string, options: PipelineListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return pipelineDb.listPipelines(dealershipId, options);
}

export async function getPipeline(dealershipId: string, id: string) {
  const p = await pipelineDb.getPipelineById(dealershipId, id);
  if (!p) throw new ApiError("NOT_FOUND", "Pipeline not found");
  return p;
}

export async function createPipeline(
  dealershipId: string,
  userId: string,
  data: CreatePipelineInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  if (data.isDefault === true) {
    const existingDefault = await pipelineDb.getDefaultPipelineId(dealershipId);
    if (existingDefault) {
      await pipelineDb.updatePipeline(dealershipId, existingDefault, { isDefault: false });
    }
  }
  const created = await pipelineDb.createPipeline(dealershipId, {
    name: data.name,
    isDefault: data.isDefault ?? false,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "pipeline.created",
    entity: "Pipeline",
    entityId: created.id,
    metadata: { pipelineId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updatePipeline(
  dealershipId: string,
  userId: string,
  id: string,
  data: UpdatePipelineInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await pipelineDb.getPipelineById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Pipeline not found");
  if (data.isDefault === true && !existing.isDefault) {
    const existingDefault = await pipelineDb.getDefaultPipelineId(dealershipId);
    if (existingDefault && existingDefault !== id) {
      await pipelineDb.updatePipeline(dealershipId, existingDefault, { isDefault: false });
    }
  }
  const updated = await pipelineDb.updatePipeline(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Pipeline not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "pipeline.updated",
    entity: "Pipeline",
    entityId: id,
    metadata: { pipelineId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function deletePipeline(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const result = await pipelineDb.deletePipeline(dealershipId, id);
  if (result === null) throw new ApiError("NOT_FOUND", "Pipeline not found");
  if (result === "HAS_OPPORTUNITIES") {
    throw new ApiError("CONFLICT", "Reassign opportunities to another pipeline or delete stages first.");
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "pipeline.deleted",
    entity: "Pipeline",
    entityId: id,
    metadata: { pipelineId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return result;
}
