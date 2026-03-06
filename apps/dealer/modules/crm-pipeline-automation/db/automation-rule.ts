import { prisma } from "@/lib/db";

export type AutomationRuleListFilters = { isActive?: boolean };

export type AutomationRuleListOptions = {
  limit: number;
  offset: number;
  filters?: AutomationRuleListFilters;
};

export async function listAutomationRules(dealershipId: string, options: AutomationRuleListOptions) {
  const { limit, offset, filters = {} } = options;
  const where: Record<string, unknown> = { dealershipId, deletedAt: null };
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  const [data, total] = await Promise.all([
    prisma.automationRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.automationRule.count({ where }),
  ]);
  return { data, total };
}

export async function getAutomationRuleById(dealershipId: string, id: string) {
  return prisma.automationRule.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
}

export type CreateAutomationRuleInput = {
  name: string;
  triggerEvent: string;
  triggerConditions?: Record<string, unknown> | null;
  actions: unknown[];
  schedule: string;
  isActive?: boolean;
};

export async function createAutomationRule(dealershipId: string, data: CreateAutomationRuleInput) {
  return prisma.automationRule.create({
    data: {
      dealershipId,
      name: data.name,
      triggerEvent: data.triggerEvent,
      triggerConditions: data.triggerConditions == null ? undefined : (data.triggerConditions as object),
      actions: data.actions as object,
      schedule: data.schedule,
      isActive: data.isActive ?? true,
    },
  });
}

export type UpdateAutomationRuleInput = {
  name?: string;
  triggerEvent?: string;
  triggerConditions?: Record<string, unknown> | null;
  actions?: unknown[];
  schedule?: string;
  isActive?: boolean;
};

export async function updateAutomationRule(
  dealershipId: string,
  id: string,
  data: UpdateAutomationRuleInput
) {
  const existing = await prisma.automationRule.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.triggerEvent !== undefined) update.triggerEvent = data.triggerEvent;
  if (data.triggerConditions !== undefined) update.triggerConditions = data.triggerConditions == null ? undefined : (data.triggerConditions as object);
  if (data.actions !== undefined) update.actions = data.actions as object;
  if (data.schedule !== undefined) update.schedule = data.schedule;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  return prisma.automationRule.update({
    where: { id },
    data: update,
  });
}

export async function softDeleteAutomationRule(dealershipId: string, id: string) {
  const existing = await prisma.automationRule.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.automationRule.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function listActiveRulesByTriggerEvent(dealershipId: string, triggerEvent: string) {
  return prisma.automationRule.findMany({
    where: { dealershipId, deletedAt: null, isActive: true, triggerEvent },
  });
}
