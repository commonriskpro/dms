import * as sequenceTemplateDb from "../db/sequence-template";
import * as sequenceStepDb from "../db/sequence-step";
import * as sequenceInstanceDb from "../db/sequence-instance";
import * as opportunityDb from "../db/opportunity";
import * as jobDb from "../db/job";
import * as taskService from "@/modules/customers/service/task";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { SequenceInstanceStatus } from "@prisma/client";

export type CreateSequenceTemplateInput = { name: string; description?: string | null };
export type UpdateSequenceTemplateInput = { name?: string; description?: string | null };
export type CreateSequenceStepInput = { order: number; stepType: string; config?: Record<string, unknown> | null };
export type UpdateSequenceStepInput = { order?: number; stepType?: string; config?: Record<string, unknown> | null };

export async function listSequenceTemplates(dealershipId: string, options: { limit: number; offset: number }) {
  await requireTenantActiveForRead(dealershipId);
  return sequenceTemplateDb.listSequenceTemplates(dealershipId, options);
}

export async function getSequenceTemplate(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const t = await sequenceTemplateDb.getSequenceTemplateById(dealershipId, id);
  if (!t) throw new ApiError("NOT_FOUND", "Sequence template not found");
  return t;
}

export async function createSequenceTemplate(
  dealershipId: string,
  userId: string,
  data: CreateSequenceTemplateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await sequenceTemplateDb.createSequenceTemplate(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_template.created",
    entity: "SequenceTemplate",
    entityId: created.id,
    metadata: { templateId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateSequenceTemplate(
  dealershipId: string,
  userId: string,
  id: string,
  data: UpdateSequenceTemplateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await sequenceTemplateDb.updateSequenceTemplate(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Sequence template not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_template.updated",
    entity: "SequenceTemplate",
    entityId: id,
    metadata: { templateId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function deleteSequenceTemplate(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deleted = await sequenceTemplateDb.softDeleteSequenceTemplate(dealershipId, id);
  if (!deleted) throw new ApiError("NOT_FOUND", "Sequence template not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_template.deleted",
    entity: "SequenceTemplate",
    entityId: id,
    metadata: { templateId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return deleted;
}

export async function createSequenceStep(
  dealershipId: string,
  userId: string,
  templateId: string,
  data: CreateSequenceStepInput
) {
  await requireTenantActiveForWrite(dealershipId);
  await getSequenceTemplate(dealershipId, templateId);
  return sequenceStepDb.createSequenceStep(dealershipId, templateId, data);
}

export async function updateSequenceStep(
  dealershipId: string,
  userId: string,
  stepId: string,
  data: UpdateSequenceStepInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await sequenceStepDb.updateSequenceStep(dealershipId, stepId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Sequence step not found");
  return updated;
}

export async function deleteSequenceStep(dealershipId: string, userId: string, stepId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const deleted = await sequenceStepDb.deleteSequenceStep(dealershipId, stepId);
  if (!deleted) throw new ApiError("NOT_FOUND", "Sequence step not found");
  return deleted;
}

export async function startSequenceOnOpportunity(
  dealershipId: string,
  userId: string,
  opportunityId: string,
  templateId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const opp = await opportunityDb.getOpportunityById(dealershipId, opportunityId);
  if (!opp) throw new ApiError("NOT_FOUND", "Opportunity not found");
  if (opp.status !== "OPEN") {
    throw new ApiError("CONFLICT", "Cannot start sequence on closed opportunity");
  }
  const template = await sequenceTemplateDb.getSequenceTemplateById(dealershipId, templateId);
  if (!template) throw new ApiError("NOT_FOUND", "Sequence template not found");
  const steps = await sequenceStepDb.listStepsByTemplateId(dealershipId, templateId);
  if (steps.length === 0) throw new ApiError("VALIDATION_ERROR", "Template has no steps");

  const instance = await sequenceInstanceDb.createSequenceInstance(dealershipId, {
    templateId,
    opportunityId,
    customerId: null,
  });
  const startedAt = instance.startedAt;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const delayDays = (step.config as { delayDays?: number })?.delayDays ?? i;
    const scheduledAt = new Date(startedAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
    await sequenceInstanceDb.createSequenceStepInstance(
      dealershipId,
      instance.id,
      step.id,
      scheduledAt
    );
  }
  const firstStepInstance = (await sequenceInstanceDb.listPendingStepInstancesForInstance(dealershipId, instance.id))[0];
  if (firstStepInstance) {
    await jobDb.createJob(dealershipId, {
      queueType: "sequence_step",
      payload: {
        stepInstanceId: firstStepInstance.id,
        instanceId: instance.id,
        opportunityId,
        customerId: opp.customerId,
      },
      idempotencyKey: `seq_step_${firstStepInstance.id}`,
      runAt: firstStepInstance.scheduledAt,
    });
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_instance.started",
    entity: "SequenceInstance",
    entityId: instance.id,
    metadata: { instanceId: instance.id, opportunityId, templateId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return sequenceInstanceDb.getSequenceInstanceById(dealershipId, instance.id);
}

export async function startSequenceOnCustomer(
  dealershipId: string,
  userId: string,
  customerId: string,
  templateId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const template = await sequenceTemplateDb.getSequenceTemplateById(dealershipId, templateId);
  if (!template) throw new ApiError("NOT_FOUND", "Sequence template not found");
  const steps = await sequenceStepDb.listStepsByTemplateId(dealershipId, templateId);
  if (steps.length === 0) throw new ApiError("VALIDATION_ERROR", "Template has no steps");

  const instance = await sequenceInstanceDb.createSequenceInstance(dealershipId, {
    templateId,
    opportunityId: null,
    customerId,
  });
  const startedAt = instance.startedAt;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const delayDays = (step.config as { delayDays?: number })?.delayDays ?? i;
    const scheduledAt = new Date(startedAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
    await sequenceInstanceDb.createSequenceStepInstance(
      dealershipId,
      instance.id,
      step.id,
      scheduledAt
    );
  }
  const firstStepInstance = (await sequenceInstanceDb.listPendingStepInstancesForInstance(dealershipId, instance.id))[0];
  if (firstStepInstance) {
    await jobDb.createJob(dealershipId, {
      queueType: "sequence_step",
      payload: {
        stepInstanceId: firstStepInstance.id,
        instanceId: instance.id,
        customerId,
      },
      idempotencyKey: `seq_step_${firstStepInstance.id}`,
      runAt: firstStepInstance.scheduledAt,
    });
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_instance.started",
    entity: "SequenceInstance",
    entityId: instance.id,
    metadata: { instanceId: instance.id, customerId, templateId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return sequenceInstanceDb.getSequenceInstanceById(dealershipId, instance.id);
}

export async function listSequencesForOpportunity(dealershipId: string, opportunityId: string) {
  await requireTenantActiveForRead(dealershipId);
  const opp = await opportunityDb.getOpportunityById(dealershipId, opportunityId);
  if (!opp) throw new ApiError("NOT_FOUND", "Opportunity not found");
  return sequenceInstanceDb.listSequenceInstancesByOpportunityId(dealershipId, opportunityId);
}

export async function listSequencesForCustomer(dealershipId: string, customerId: string) {
  await requireTenantActiveForRead(dealershipId);
  return sequenceInstanceDb.listSequenceInstancesByCustomerId(dealershipId, customerId);
}

export async function getSequenceInstance(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const i = await sequenceInstanceDb.getSequenceInstanceById(dealershipId, id);
  if (!i) throw new ApiError("NOT_FOUND", "Sequence instance not found");
  return i;
}

export async function updateSequenceInstanceStatus(
  dealershipId: string,
  userId: string,
  instanceId: string,
  status: SequenceInstanceStatus,
  meta?: { ip?: string; userAgent?: string }
) {
  const instance = await sequenceInstanceDb.getSequenceInstanceById(dealershipId, instanceId);
  if (!instance) throw new ApiError("NOT_FOUND", "Sequence instance not found");
  const stoppedAt = status === "stopped" || status === "completed" ? new Date() : null;
  const updated = await sequenceInstanceDb.updateSequenceInstanceStatus(
    dealershipId,
    instanceId,
    status,
    stoppedAt
  );
  if (!updated) throw new ApiError("NOT_FOUND", "Sequence instance not found");
  const action =
    status === "paused"
      ? "sequence_instance.paused"
      : status === "stopped"
        ? "sequence_instance.stopped"
        : "sequence_instance.resumed";
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action,
    entity: "SequenceInstance",
    entityId: instanceId,
    metadata: { instanceId, status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function skipSequenceStep(
  dealershipId: string,
  userId: string,
  instanceId: string,
  stepInstanceId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const stepInstance = await sequenceInstanceDb.getSequenceStepInstanceById(dealershipId, stepInstanceId);
  if (!stepInstance) throw new ApiError("NOT_FOUND", "Step instance not found");
  if (stepInstance.instanceId !== instanceId) throw new ApiError("NOT_FOUND", "Step instance not found");
  if (stepInstance.status !== "pending") throw new ApiError("CONFLICT", "Step already executed or skipped");
  await sequenceInstanceDb.updateSequenceStepInstanceStatus(
    dealershipId,
    stepInstanceId,
    "skipped",
    new Date(),
    null
  );
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "sequence_instance.step_skipped",
    entity: "SequenceInstance",
    entityId: instanceId,
    metadata: { instanceId, stepInstanceId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await enqueueNextStepIfAny(dealershipId, instanceId);
  return sequenceInstanceDb.getSequenceInstanceById(dealershipId, instanceId);
}

async function enqueueNextStepIfAny(dealershipId: string, instanceId: string): Promise<void> {
  const instance = await sequenceInstanceDb.getSequenceInstanceById(dealershipId, instanceId);
  if (!instance || (instance.status !== "active" && instance.status !== "paused")) return;
  const pending = await sequenceInstanceDb.listPendingStepInstancesForInstance(dealershipId, instanceId);
  const next = pending[0];
  if (!next) return;
  await jobDb.createJob(dealershipId, {
    queueType: "sequence_step",
    payload: {
      stepInstanceId: next.id,
      instanceId,
      opportunityId: instance.opportunityId,
      customerId: instance.customerId,
    },
    idempotencyKey: `seq_step_${next.id}`,
    runAt: next.scheduledAt,
  });
}

export async function processSequenceStepJob(
  dealershipId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const stepInstanceId = payload.stepInstanceId as string;
  const instanceId = payload.instanceId as string;
  const customerId = payload.customerId as string | undefined;
  const opportunityId = payload.opportunityId as string | undefined;

  const stepInstance = await sequenceInstanceDb.getSequenceStepInstanceById(dealershipId, stepInstanceId);
  if (!stepInstance || stepInstance.instanceId !== instanceId) return;
  if (stepInstance.status !== "pending") return;

  const instance = await sequenceInstanceDb.getSequenceInstanceById(dealershipId, instanceId);
  if (!instance || (instance.status !== "active" && instance.status !== "paused")) {
    await sequenceInstanceDb.updateSequenceStepInstanceStatus(
      dealershipId,
      stepInstanceId,
      "skipped",
      new Date(),
      "Instance not active"
    );
    return;
  }
  if (instance.opportunityId) {
    const opp = await opportunityDb.getOpportunityById(dealershipId, instance.opportunityId);
    if (opp?.status === "WON" || opp?.status === "LOST") {
      await sequenceInstanceDb.updateSequenceInstanceStatus(dealershipId, instanceId, "stopped", new Date());
      await sequenceInstanceDb.updateSequenceStepInstanceStatus(
        dealershipId,
        stepInstanceId,
        "skipped",
        new Date(),
        "Opportunity closed"
      );
      return;
    }
  }

  const step = stepInstance.step;
  const config = (step.config as Record<string, unknown>) ?? {};
  const executedAt = new Date();
  let err: string | null = null;
  try {
    if (step.stepType === "create_task") {
      const title = (config.title as string) ?? "Follow-up";
      const dueAt = config.dueAt ? new Date(config.dueAt as string) : undefined;
      const ownerId = instance.opportunityId
        ? (await opportunityDb.getOpportunityById(dealershipId, instance.opportunityId))?.ownerId
        : null;
      const actorId = ownerId ?? customerId;
      if (actorId && customerId) {
        await taskService.createTask(
          dealershipId,
          actorId,
          customerId,
          { title, description: null, dueAt: dueAt ?? null }
        );
      }
    } else if (step.stepType === "send_email" || step.stepType === "send_sms") {
      // Stub: no-op
    }
    await sequenceInstanceDb.updateSequenceStepInstanceStatus(
      dealershipId,
      stepInstanceId,
      "completed",
      executedAt,
      null
    );
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
    await sequenceInstanceDb.updateSequenceStepInstanceStatus(
      dealershipId,
      stepInstanceId,
      "failed",
      executedAt,
      err
    );
    throw e;
  }
  await enqueueNextStepIfAny(dealershipId, instanceId);
}
