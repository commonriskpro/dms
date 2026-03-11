import { prisma } from "@/lib/db";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import * as customersDb from "@/modules/customers/db/customers";
import * as activityDb from "@/modules/customers/db/activity";
import * as stageDb from "../db/stage";
import { customerDetailPath } from "@/lib/routes/detail-paths";

export type CommandCenterScope = "mine" | "team" | "all";

export type CommandCenterQuery = {
  scope: CommandCenterScope;
  ownerId?: string;
  stageId?: string;
  status?: "OPEN" | "WON" | "LOST";
  source?: string;
  q?: string;
};

export type CommandCenterItem = {
  id: string;
  kind: "task" | "callback" | "conversation" | "opportunity" | "sequence";
  title: string;
  detail: string;
  customerId?: string;
  customerName?: string;
  opportunityId?: string;
  href: string;
  nextActionLabel: string;
  nextActionHref: string;
  whenLabel?: string | null;
  severity?: "info" | "warning" | "danger";
};

export type CommandCenterResponse = {
  kpis: {
    openOpportunities: number;
    dueNow: number;
    staleProspects: number;
    blockers: number;
    waitingConversations: number;
    sequenceExceptions: number;
  };
  filters: {
    owners: Array<{ value: string; label: string }>;
    stages: Array<{ value: string; label: string }>;
    sources: Array<{ value: string; label: string }>;
  };
  pressure: {
    overdueTasks: number;
    callbacksDueToday: number;
    inboundWaiting: number;
    noNextAction: number;
    failedJobs: number;
  };
  pipeline: {
    stages: Array<{ stageId: string; stageName: string; count: number }>;
  };
  sections: {
    dueNow: CommandCenterItem[];
    staleProspects: CommandCenterItem[];
    pipelineBlockers: CommandCenterItem[];
    sequenceExceptions: CommandCenterItem[];
  };
};

function relativeWhen(date: Date | null | undefined): string | null {
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) {
    if (diffMinutes >= 0) return `in ${diffMinutes} min`;
    return `${Math.abs(diffMinutes)} min ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    if (diffHours >= 0) return `in ${diffHours} hr`;
    return `${Math.abs(diffHours)} hr ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays >= 0) return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  return `${Math.abs(diffDays)} day${diffDays === -1 ? "" : "s"} ago`;
}

function applyScopeOwner(
  scope: CommandCenterScope,
  userId: string,
  ownerId?: string
): string | undefined {
  if (scope === "mine") return userId;
  if (ownerId) return ownerId;
  return undefined;
}

export async function getCommandCenterData(
  dealershipId: string,
  userId: string,
  query: CommandCenterQuery
): Promise<CommandCenterResponse> {
  await requireTenantActiveForRead(dealershipId);

  const ownerId = applyScopeOwner(query.scope, userId, query.ownerId);
  const q = query.q?.trim();
  const opportunityWhere = {
    dealershipId,
    ...(query.status ? { status: query.status } : { status: "OPEN" as const }),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(q
      ? {
          OR: [
            { nextActionText: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            { customer: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const staleOpportunityCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const [
    pipelineFunnel,
    staleLeads,
    openOpportunities,
    blockerRows,
    dueTasks,
    dueCallbacks,
    sequenceRows,
    failedJobs,
    conversationPage,
    ownerRows,
    sourceRows,
    stageRows,
  ] = await Promise.all([
    stageDb.getPipelineFunnelCounts(dealershipId),
    customersDb.listStaleLeads(dealershipId, 7, 8),
    prisma.opportunity.count({ where: opportunityWhere }),
    prisma.opportunity.findMany({
      where: {
        ...opportunityWhere,
        OR: [
          { ownerId: null },
          { nextActionText: null },
          { nextActionAt: null },
          { updatedAt: { lt: staleOpportunityCutoff } },
        ],
      },
      take: 8,
      orderBy: [{ updatedAt: "asc" }],
      include: {
        stage: true,
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerTask.findMany({
      where: {
        dealershipId,
        deletedAt: null,
        completedAt: null,
        dueAt: { lte: endOfDay },
        ...(query.scope === "mine" ? { createdBy: userId } : {}),
      },
      take: 8,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.customerCallback.findMany({
      where: {
        dealershipId,
        status: "SCHEDULED",
        callbackAt: { lte: endOfDay },
        ...(query.scope === "mine" ? { assignedToUserId: userId } : {}),
      },
      take: 8,
      orderBy: [{ callbackAt: "asc" }],
      include: {
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.sequenceInstance.findMany({
      where: {
        dealershipId,
        OR: [
          { status: "paused" },
          { stepInstances: { some: { status: "failed" } } },
        ],
        ...(ownerId ? { opportunity: { ownerId } } : {}),
      },
      take: 8,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        template: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        opportunity: {
          select: {
            id: true,
            customer: { select: { id: true, name: true } },
          },
        },
        stepInstances: {
          where: { status: "failed" },
          orderBy: { scheduledAt: "desc" },
          take: 1,
          include: { step: true },
        },
      },
    }),
    prisma.job.count({
      where: {
        dealershipId,
        status: { in: ["failed", "dead_letter"] },
      },
    }),
    activityDb.listConversationsPage(dealershipId, 25, 0),
    prisma.opportunity.findMany({
      where: { dealershipId, status: "OPEN", ownerId: { not: null } },
      distinct: ["ownerId"],
      select: {
        owner: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.opportunity.findMany({
      where: { dealershipId, status: "OPEN", source: { not: null } },
      distinct: ["source"],
      select: { source: true },
    }),
    prisma.stage.findMany({
      where: { dealershipId },
      orderBy: [{ pipelineId: "asc" }, { order: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const conversationRows = conversationPage.rows
    .filter((row) => (q ? row.customer_name.toLowerCase().includes(q.toLowerCase()) : true))
    .slice(0, 8);
  const inboundWaiting = conversationRows.filter((row) => row.direction === "inbound").length;

  const dueNowItems: CommandCenterItem[] = [
    ...dueTasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      detail: `${task.customer.name} needs follow-up`,
      customerId: task.customer.id,
      customerName: task.customer.name,
      href: customerDetailPath(task.customer.id),
      nextActionLabel: "Mark done",
      nextActionHref: customerDetailPath(task.customer.id),
      whenLabel: relativeWhen(task.dueAt),
      severity: task.dueAt && task.dueAt < now ? "danger" : "warning",
    } satisfies CommandCenterItem)),
    ...dueCallbacks.map((callback) => ({
      id: callback.id,
      kind: "callback" as const,
      title: callback.reason || "Scheduled callback",
      detail: `${callback.customer.name} is due for contact`,
      customerId: callback.customer.id,
      customerName: callback.customer.name,
      href: `/crm/inbox?customerId=${encodeURIComponent(callback.customer.id)}`,
      nextActionLabel: "Open conversation",
      nextActionHref: `/crm/inbox?customerId=${encodeURIComponent(callback.customer.id)}`,
      whenLabel: relativeWhen(callback.callbackAt),
      severity: callback.callbackAt < now ? "danger" : "warning",
    } satisfies CommandCenterItem)),
    ...conversationRows.map((conversation) => ({
      id: conversation.customer_id,
      kind: "conversation" as const,
      title: conversation.customer_name,
      detail: conversation.content_preview || `${conversation.channel} ${conversation.direction}`,
      customerId: conversation.customer_id,
      customerName: conversation.customer_name,
      href: `/crm/inbox?customerId=${encodeURIComponent(conversation.customer_id)}`,
      nextActionLabel: "Reply now",
      nextActionHref: `/crm/inbox?customerId=${encodeURIComponent(conversation.customer_id)}`,
      whenLabel: relativeWhen(conversation.last_message_at),
      severity: conversation.direction === "inbound" ? "warning" : "info",
    } satisfies CommandCenterItem)),
  ]
    .sort((a, b) => {
      const aDanger = a.severity === "danger" ? 0 : a.severity === "warning" ? 1 : 2;
      const bDanger = b.severity === "danger" ? 0 : b.severity === "warning" ? 1 : 2;
      return aDanger - bDanger;
    })
    .slice(0, 10);

  const staleProspectItems: CommandCenterItem[] = staleLeads
    .filter((lead) => (q ? lead.name.toLowerCase().includes(q.toLowerCase()) : true))
    .map((lead) => ({
      id: lead.id,
      kind: "conversation",
      title: lead.name,
      detail: `No meaningful activity for ${lead.daysSinceActivity} days`,
      customerId: lead.id,
      customerName: lead.name,
      href: customerDetailPath(lead.id),
      nextActionLabel: "Open customer",
      nextActionHref: customerDetailPath(lead.id),
      whenLabel: `${lead.daysSinceActivity} days stale`,
      severity: lead.daysSinceActivity > 14 ? "danger" : "warning",
    } satisfies CommandCenterItem));

  const blockerItems: CommandCenterItem[] = blockerRows.map((opp) => {
    const missing = [];
    if (!opp.ownerId) missing.push("owner");
    if (!opp.nextActionText) missing.push("next action");
    if (!opp.nextActionAt) missing.push("due date");
    if (opp.updatedAt < staleOpportunityCutoff) missing.push("fresh movement");
    return {
      id: opp.id,
      kind: "opportunity" as const,
      title: opp.customer?.name ?? opp.id.slice(0, 8),
      detail: `Missing ${missing.join(", ")} in ${opp.stage?.name ?? "pipeline"}`,
      customerId: opp.customer?.id,
      customerName: opp.customer?.name,
      opportunityId: opp.id,
      href: `/crm/opportunities/${opp.id}`,
      nextActionLabel: "Open opportunity",
      nextActionHref: `/crm/opportunities/${opp.id}`,
      whenLabel: relativeWhen(opp.nextActionAt ?? opp.updatedAt),
      severity: missing.length > 2 ? "danger" : "warning",
    } satisfies CommandCenterItem;
  });

  const sequenceItems: CommandCenterItem[] = sequenceRows.map((instance) => {
    const customer = instance.customer ?? instance.opportunity?.customer ?? null;
    const failedStep = instance.stepInstances[0];
    return {
      id: instance.id,
      kind: "sequence" as const,
      title: customer?.name ?? instance.template.name,
      detail:
        instance.status === "paused"
          ? `${instance.template.name} is paused`
          : `${instance.template.name} failed on ${failedStep?.step.stepType ?? "a step"}`,
      customerId: customer?.id,
      customerName: customer?.name,
      opportunityId: instance.opportunity?.id,
      href: instance.opportunity?.id
        ? `/crm/opportunities/${instance.opportunity.id}`
        : customer?.id
          ? customerDetailPath(customer.id)
          : "/crm/sequences",
      nextActionLabel: instance.opportunity?.id ? "Open opportunity" : "Review sequence",
      nextActionHref: instance.opportunity?.id
        ? `/crm/opportunities/${instance.opportunity.id}`
        : customer?.id
          ? customerDetailPath(customer.id)
          : "/crm/sequences",
      whenLabel: relativeWhen(instance.updatedAt),
      severity: failedStep ? "danger" : "warning",
    } satisfies CommandCenterItem;
  });

  return {
    kpis: {
      openOpportunities,
      dueNow: dueNowItems.length,
      staleProspects: staleProspectItems.length,
      blockers: blockerItems.length,
      waitingConversations: inboundWaiting,
      sequenceExceptions: sequenceItems.length,
    },
    filters: {
      owners: ownerRows
        .map((row) => row.owner)
        .filter((owner): owner is NonNullable<typeof ownerRows[number]["owner"]> => owner != null)
        .map((owner) => ({
          value: owner.id,
          label: owner.fullName ?? owner.email,
        })),
      stages: stageRows.map((stage) => ({ value: stage.id, label: stage.name })),
      sources: sourceRows
        .map((row) => row.source)
        .filter((source): source is string => Boolean(source))
        .map((source) => ({ value: source, label: source })),
    },
    pressure: {
      overdueTasks: dueTasks.filter((task) => task.dueAt && task.dueAt < now).length,
      callbacksDueToday: dueCallbacks.length,
      inboundWaiting,
      noNextAction: blockerRows.filter((opp) => !opp.nextActionText || !opp.nextActionAt).length,
      failedJobs,
    },
    pipeline: {
      stages: pipelineFunnel,
    },
    sections: {
      dueNow: dueNowItems,
      staleProspects: staleProspectItems,
      pipelineBlockers: blockerItems,
      sequenceExceptions: sequenceItems,
    },
  };
}
