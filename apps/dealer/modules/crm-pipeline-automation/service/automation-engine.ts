import { prisma } from "@/lib/db";
import * as automationRuleDb from "../db/automation-rule";
import * as automationRunDb from "../db/automation-run";
import * as opportunityDb from "../db/opportunity";
import * as opportunityActivityDb from "../db/opportunity-activity";
import * as jobDb from "../db/job";
import * as taskService from "@/modules/customers/service/task";
import * as customerService from "@/modules/customers/service/customer";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";

type ActionDescriptor = { type: string; params?: Record<string, unknown> };

const EVENT_ALIASES: Record<string, string[]> = {
  "customer.task.completed": ["customer.task_completed", "customer.task.completed"],
  "customer.task_completed": ["customer.task_completed", "customer.task.completed"],
  "lead_created": ["customer.created", "lead_created"],
  "customer.created": ["customer.created", "lead_created"],
};

/** Canonical form for idempotency: same logical event always produces same key. */
function canonicalEventName(eventName: string): string {
  if (EVENT_ALIASES[eventName]) return EVENT_ALIASES[eventName][0];
  return eventName;
}

function triggerEventsToMatch(eventName: string): string[] {
  return EVENT_ALIASES[eventName] ?? [eventName];
}

const MAX_RUNS_PER_ENTITY_PER_MINUTE = 5;
const LOOP_GUARD_WINDOW_MS = 60 * 1000;

export async function processAutomationTrigger(
  dealershipId: string,
  entityType: string,
  entityId: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const origin = payload.origin as string | undefined;
  const depth = (payload.depth as number) ?? 0;
  if (origin === "automation" && depth >= 3) return;

  const since = new Date(Date.now() - LOOP_GUARD_WINDOW_MS);
  const runCount = await prisma.automationRun.count({
    where: {
      dealershipId,
      entityType,
      entityId,
      runAt: { gte: since },
    },
  });
  if (runCount >= MAX_RUNS_PER_ENTITY_PER_MINUTE) return;

  const eventsToMatch = triggerEventsToMatch(eventName);
  const rules = await Promise.all(
    eventsToMatch.flatMap((ev) =>
      automationRuleDb.listActiveRulesByTriggerEvent(dealershipId, ev)
    )
  );
  const seenRuleIds = new Set<string>();
  const activeRules = rules.flat().filter((r) => {
    if (seenRuleIds.has(r.id)) return false;
    if (origin === "automation" && (payload.originRuleId as string) === r.id) return false;
    seenRuleIds.add(r.id);
    return true;
  });

  const canonicalEvent = canonicalEventName(eventName);
  for (const rule of activeRules) {
    if (rule.triggerEvent === "lead_created" && entityType === "customer") {
      const customer = await customerService.getCustomer(dealershipId, entityId).catch(() => null);
      if (!customer || customer.status !== "LEAD") continue;
    }
    const eventKey = `${canonicalEvent}:${entityType}:${entityId}`;
    const run = await automationRunDb.insertAutomationRunIdempotent(dealershipId, {
      entityType,
      entityId,
      eventKey,
      ruleId: rule.id,
      status: "running",
    });
    if (!run) continue;

    try {
      if (rule.schedule === "delayed") {
        const delayMinutes = (rule.actions as ActionDescriptor[])?.[0]?.params?.delayMinutes as number | undefined ?? 60;
        const runAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await jobDb.createJob(dealershipId, {
          queueType: "automation",
          payload: {
            ruleId: rule.id,
            entityType,
            entityId,
            eventKey,
            runId: run.id,
          },
          runAt,
        });
        await automationRunDb.updateAutomationRunStatus(dealershipId, run.id, "scheduled");
      } else {
        await executeRuleActions(dealershipId, rule, entityType, entityId, payload);
        await automationRunDb.updateAutomationRunStatus(dealershipId, run.id, "completed");
      }
    } catch (err) {
      await automationRunDb.updateAutomationRunStatus(dealershipId, run.id, "failed");
      throw err;
    }
  }
}

export async function executeRuleActions(
  dealershipId: string,
  rule: { id: string; actions: unknown; triggerEvent: string },
  entityType: string,
  entityId: string,
  contextPayload: Record<string, unknown>
): Promise<void> {
  const actions = (rule.actions as ActionDescriptor[]) ?? [];
  let customerId: string | undefined;
  let ownerId: string | null = null;
  if (entityType === "opportunity") {
    const opp = await opportunityDb.getOpportunityById(dealershipId, entityId);
    if (opp) {
      customerId = opp.customerId;
      ownerId = opp.ownerId;
    }
  } else if (entityType === "customer") {
    customerId = entityId;
    const customer = await customerService.getCustomer(dealershipId, entityId).catch(() => null);
    if (customer) ownerId = customer.assignedTo;
  }
  if (!customerId) return;

  for (const action of actions) {
    const type = action.type;
    const params = action.params ?? {};
    if (type === "create_task") {
      const title = (params.title as string) ?? "Follow-up";
      const dueAt = params.dueAt ? new Date(params.dueAt as string) : undefined;
      const actorId = ownerId ?? (contextPayload.completedBy as string);
      if (!actorId) continue;
      try {
        await taskService.createTask(
          dealershipId,
          actorId,
          customerId,
          { title, description: null, dueAt: dueAt ?? null }
        );
      } catch {
        // Skip on conflict or not found
      }
    } else if (type === "update_stage" && entityType === "opportunity") {
      const stageId = params.stageId as string;
      if (!stageId) continue;
      try {
        const opp = await opportunityDb.getOpportunityById(dealershipId, entityId);
        if (!opp) continue;
        await opportunityDb.updateOpportunity(dealershipId, entityId, { stageId });
        await opportunityActivityDb.appendActivity(dealershipId, {
          opportunityId: entityId,
          activityType: "stage_changed",
          fromStageId: opp.stageId,
          toStageId: stageId,
          actorId: null,
        });
      } catch {
        // Skip
      }
    } else if (type === "add_tag") {
      const tag = params.tag as string;
      if (!tag || !ownerId) continue;
      try {
        const customer = await customerService.getCustomer(dealershipId, customerId);
        const tags = customer.tags ?? [];
        if (tags.includes(tag)) continue;
        await customerService.updateCustomer(dealershipId, ownerId, customerId, {
          tags: [...tags, tag],
        });
      } catch {
        // Skip
      }
    } else if (type === "assign_salesperson") {
      const userId = params.userId as string;
      if (!userId) continue;
      try {
        await customerService.updateCustomer(dealershipId, userId, customerId, {
          assignedTo: userId,
        });
      } catch {
        // Skip
      }
    } else if (type === "send_message") {
      // Stub: no-op; no PII logged
    }
    // schedule_follow_up is handled by delayed job enqueue above
  }
}

import { registerListener } from "@/lib/infrastructure/events/eventBus";

let handlersRegistered = false;

export function ensureAutomationHandlersRegistered(): void {
  if (handlersRegistered) return;
  registerListener("opportunity.created", (p) => {
    processAutomationTrigger(p.dealershipId, "opportunity", p.opportunityId, "opportunity.created", p).catch(() => {});
  });
  registerListener("opportunity.stage_changed", (p) => {
    processAutomationTrigger(p.dealershipId, "opportunity", p.opportunityId, "opportunity.stage_changed", p).catch(() => {});
  });
  registerListener("opportunity.status_changed", (p) => {
    processAutomationTrigger(p.dealershipId, "opportunity", p.opportunityId, "opportunity.status_changed", p).catch(() => {});
  });
  registerListener("customer.task_completed", (p) => {
    processAutomationTrigger(p.dealershipId, "customer", p.customerId, "customer.task_completed", p).catch(() => {});
  });
  registerListener("customer.created", (p) => {
    processAutomationTrigger(p.dealershipId, "customer", p.customerId, "customer.created", p).catch(() => {});
  });
  handlersRegistered = true;
}
