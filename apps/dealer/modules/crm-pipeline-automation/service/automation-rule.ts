import * as automationRuleDb from "../db/automation-rule";
import { auditLog } from "@/lib/audit";
import { emit } from "@/lib/events";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type AutomationRuleListOptions = automationRuleDb.AutomationRuleListOptions;
export type CreateAutomationRuleInput = automationRuleDb.CreateAutomationRuleInput;
export type UpdateAutomationRuleInput = automationRuleDb.UpdateAutomationRuleInput;

export async function listAutomationRules(dealershipId: string, options: AutomationRuleListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return automationRuleDb.listAutomationRules(dealershipId, options);
}

export async function getAutomationRule(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const r = await automationRuleDb.getAutomationRuleById(dealershipId, id);
  if (!r) throw new ApiError("NOT_FOUND", "Automation rule not found");
  return r;
}

export async function createAutomationRule(
  dealershipId: string,
  userId: string,
  data: CreateAutomationRuleInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await automationRuleDb.createAutomationRule(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "automation_rule.created",
    entity: "AutomationRule",
    entityId: created.id,
    metadata: { ruleId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emit("automation_rule.created", { ruleId: created.id, dealershipId });
  return created;
}

export async function updateAutomationRule(
  dealershipId: string,
  userId: string,
  id: string,
  data: UpdateAutomationRuleInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await automationRuleDb.updateAutomationRule(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Automation rule not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "automation_rule.updated",
    entity: "AutomationRule",
    entityId: id,
    metadata: { ruleId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emit("automation_rule.updated", { ruleId: id, dealershipId });
  return updated;
}

export async function deleteAutomationRule(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deleted = await automationRuleDb.softDeleteAutomationRule(dealershipId, id);
  if (!deleted) throw new ApiError("NOT_FOUND", "Automation rule not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "automation_rule.deleted",
    entity: "AutomationRule",
    entityId: id,
    metadata: { ruleId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emit("automation_rule.deleted", { ruleId: id, dealershipId });
  return deleted;
}
