import { prisma } from "@/lib/db";
import type { SequenceInstanceStatus } from "@prisma/client";

export async function listSequenceInstancesByOpportunityId(
  dealershipId: string,
  opportunityId: string
) {
  return prisma.sequenceInstance.findMany({
    where: { dealershipId, opportunityId },
    orderBy: { startedAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      stepInstances: { include: { step: true }, orderBy: { scheduledAt: "asc" } },
    },
  });
}

export async function listSequenceInstancesByCustomerId(
  dealershipId: string,
  customerId: string
) {
  return prisma.sequenceInstance.findMany({
    where: { dealershipId, customerId },
    orderBy: { startedAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      stepInstances: { include: { step: true }, orderBy: { scheduledAt: "asc" } },
    },
  });
}

export async function getSequenceInstanceById(dealershipId: string, id: string) {
  return prisma.sequenceInstance.findFirst({
    where: { id, dealershipId },
    include: {
      template: true,
      stepInstances: { include: { step: true }, orderBy: { scheduledAt: "asc" } },
    },
  });
}

export type CreateSequenceInstanceInput = {
  templateId: string;
  opportunityId?: string | null;
  customerId?: string | null;
};

export async function createSequenceInstance(
  dealershipId: string,
  data: CreateSequenceInstanceInput
) {
  const startedAt = new Date();
  return prisma.sequenceInstance.create({
    data: {
      dealershipId,
      templateId: data.templateId,
      opportunityId: data.opportunityId ?? null,
      customerId: data.customerId ?? null,
      status: "active",
      startedAt,
    },
    include: { template: true, stepInstances: true },
  });
}

export async function updateSequenceInstanceStatus(
  dealershipId: string,
  id: string,
  status: SequenceInstanceStatus,
  stoppedAt?: Date | null
) {
  const existing = await prisma.sequenceInstance.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.sequenceInstance.update({
    where: { id },
    data: {
      status,
      ...(stoppedAt !== undefined && { stoppedAt: stoppedAt ?? null }),
    },
    include: { template: true, stepInstances: { include: { step: true }, orderBy: { scheduledAt: "asc" } } },
  });
}

export async function createSequenceStepInstance(
  dealershipId: string,
  instanceId: string,
  stepId: string,
  scheduledAt: Date
) {
  return prisma.sequenceStepInstance.create({
    data: {
      dealershipId,
      instanceId,
      stepId,
      scheduledAt,
      status: "pending",
    },
  });
}

export async function getSequenceStepInstanceById(
  dealershipId: string,
  id: string
) {
  return prisma.sequenceStepInstance.findFirst({
    where: { id, dealershipId },
    include: { instance: true, step: true },
  });
}

export async function updateSequenceStepInstanceStatus(
  dealershipId: string,
  id: string,
  status: "pending" | "skipped" | "completed" | "failed",
  executedAt?: Date | null,
  error?: string | null
) {
  const existing = await prisma.sequenceStepInstance.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.sequenceStepInstance.update({
    where: { id },
    data: {
      status,
      ...(executedAt !== undefined && { executedAt: executedAt ?? null }),
      ...(error !== undefined && { error: error ?? null }),
    },
  });
}

export async function listPendingStepInstancesForInstance(
  dealershipId: string,
  instanceId: string
) {
  return prisma.sequenceStepInstance.findMany({
    where: { dealershipId, instanceId, status: "pending" },
    orderBy: { scheduledAt: "asc" },
    include: { step: true },
  });
}
