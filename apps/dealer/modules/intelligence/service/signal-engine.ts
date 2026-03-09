import { prisma } from "@/lib/db";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as signalsDb from "../db/signals";
import type { IntelligenceSignal } from "@prisma/client";

export type SignalDomain = signalsDb.SignalDomain;
export type SignalSeverity = signalsDb.SignalSeverity;

type SignalListQuery = {
  domain?: SignalDomain;
  severity?: SignalSeverity;
  includeResolved?: boolean;
  limit: number;
  offset: number;
};

type DomainRunCounters = {
  created: number;
  updated: number;
  resolved: number;
  unchanged: number;
};

type SignalEngineRunResult = {
  dealershipId: string;
  inventory: DomainRunCounters;
  crm: DomainRunCounters;
  deals: DomainRunCounters;
  operations: DomainRunCounters;
  acquisition: DomainRunCounters;
};

const EMPTY_COUNTERS: DomainRunCounters = {
  created: 0,
  updated: 0,
  resolved: 0,
  unchanged: 0,
};

function toApiDomain(domain: IntelligenceSignal["domain"]): SignalDomain {
  switch (domain) {
    case "INVENTORY":
      return "inventory";
    case "CRM":
      return "crm";
    case "DEALS":
      return "deals";
    case "OPERATIONS":
      return "operations";
    case "ACQUISITION":
      return "acquisition";
  }
}

function toApiSeverity(severity: IntelligenceSignal["severity"]): SignalSeverity {
  switch (severity) {
    case "INFO":
      return "info";
    case "SUCCESS":
      return "success";
    case "WARNING":
      return "warning";
    case "DANGER":
      return "danger";
  }
}

export type SignalDto = {
  id: string;
  dealershipId: string;
  domain: SignalDomain;
  code: string;
  severity: SignalSeverity;
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  actionLabel: string | null;
  actionHref: string | null;
  metadata: unknown;
  happenedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: IntelligenceSignal): SignalDto {
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    domain: toApiDomain(row.domain),
    code: row.code,
    severity: toApiSeverity(row.severity),
    title: row.title,
    description: row.description ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    actionLabel: row.actionLabel ?? null,
    actionHref: row.actionHref ?? null,
    metadata: row.metadata ?? null,
    happenedAt: row.happenedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function bump(counters: DomainRunCounters, action: "created" | "updated" | "unchanged"): void {
  counters[action] += 1;
}

async function reconcileCountSignal(
  counters: DomainRunCounters,
  input: {
    dealershipId: string;
    domain: SignalDomain;
    code: string;
    count: number;
    severity: SignalSeverity;
    title: string;
    description: string;
    actionHref: string;
    actionLabel?: string;
  }
): Promise<void> {
  if (input.count > 0) {
    const result = await signalsDb.upsertActiveSignal({
      dealershipId: input.dealershipId,
      domain: input.domain,
      code: input.code,
      severity: input.severity,
      title: input.title,
      description: input.description,
      actionHref: input.actionHref,
      actionLabel: input.actionLabel ?? "View details",
      metadata: { count: input.count },
      happenedAt: new Date(),
    });
    bump(counters, result.action);
    return;
  }

  const resolved = await signalsDb.resolveActiveSignalByCode(
    input.dealershipId,
    input.domain,
    input.code
  );
  counters.resolved += resolved;
}

export async function generateInventorySignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [reconQueueCount, agedNinetyCount] = await Promise.all([
    prisma.vehicle.count({
      where: { dealershipId, deletedAt: null, status: "REPAIR" },
    }),
    prisma.vehicle.count({
      where: {
        dealershipId,
        deletedAt: null,
        createdAt: { lt: ninetyDaysAgo },
        status: { in: ["AVAILABLE", "HOLD", "REPAIR"] },
      },
    }),
  ]);

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "inventory",
    code: "inventory.recon_queue",
    count: reconQueueCount,
    severity: "warning",
    title: "Cars in recon",
    description: `${reconQueueCount} vehicle(s) currently in recon queue.`,
    actionHref: "/inventory",
    actionLabel: "Open inventory",
  });

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "inventory",
    code: "inventory.aged_90d",
    count: agedNinetyCount,
    severity: "danger",
    title: "Units older than 90 days",
    description: `${agedNinetyCount} vehicle(s) are aging beyond 90 days.`,
    actionHref: "/inventory?alertType=STALE",
    actionLabel: "Review aged units",
  });

  return counters;
}

export async function generateCrmSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };
  const now = new Date();

  const [followupsOverdueCount, newProspectsCount] = await Promise.all([
    prisma.customerTask.count({
      where: {
        dealershipId,
        deletedAt: null,
        completedAt: null,
        dueAt: { lt: now },
      },
    }),
    prisma.opportunity.count({
      where: { dealershipId, status: "OPEN" },
    }),
  ]);

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "crm",
    code: "crm.followup_overdue",
    count: followupsOverdueCount,
    severity: "warning",
    title: "Follow-ups overdue",
    description: `${followupsOverdueCount} customer follow-up task(s) are overdue.`,
    actionHref: "/customers",
    actionLabel: "Open tasks",
  });

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "crm",
    code: "crm.new_prospects",
    count: newProspectsCount,
    severity: "info",
    title: "New prospects in pipeline",
    description: `${newProspectsCount} open prospect(s) need action.`,
    actionHref: "/crm/opportunities",
    actionLabel: "Open prospects",
  });

  return counters;
}

export async function generateDealSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const [contractsToReviewCount, fundingPendingCount] = await Promise.all([
    prisma.deal.count({
      where: { dealershipId, deletedAt: null, status: "CONTRACTED" },
    }),
    prisma.financeSubmission.count({
      where: {
        dealershipId,
        fundingStatus: "PENDING",
        status: { in: ["SUBMITTED", "DECISIONED"] },
      },
    }),
  ]);

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "deals",
    code: "deals.contracts_to_review",
    count: contractsToReviewCount,
    severity: "warning",
    title: "Contracts to review",
    description: `${contractsToReviewCount} contracted deal(s) require review.`,
    actionHref: "/deals",
    actionLabel: "Review deals",
  });

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "deals",
    code: "deals.funding_pending",
    count: fundingPendingCount,
    severity: "danger",
    title: "Funding pending",
    description: `${fundingPendingCount} submission(s) are pending funding.`,
    actionHref: "/deals",
    actionLabel: "Open funding queue",
  });

  return counters;
}

export async function generateOperationSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const [issueHoldCount, titlePendingCount] = await Promise.all([
    prisma.dealTitle.count({
      where: { dealershipId, titleStatus: "ISSUE_HOLD" },
    }),
    prisma.dealTitle.count({
      where: {
        dealershipId,
        titleStatus: { in: ["TITLE_PENDING", "TITLE_SENT", "TITLE_RECEIVED"] },
      },
    }),
  ]);

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "operations",
    code: "operations.title_issue_hold",
    count: issueHoldCount,
    severity: "danger",
    title: "Title issues on hold",
    description: `${issueHoldCount} title item(s) are blocked with issue hold.`,
    actionHref: "/deals",
    actionLabel: "Resolve holds",
  });

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "operations",
    code: "operations.title_pending",
    count: titlePendingCount,
    severity: "warning",
    title: "Title work pending",
    description: `${titlePendingCount} title workflow item(s) are still pending.`,
    actionHref: "/deals",
    actionLabel: "Open title queue",
  });

  return counters;
}

export async function generateAcquisitionSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const [appraisalDraftCount, sourceLeadNewCount] = await Promise.all([
    prisma.vehicleAppraisal.count({
      where: { dealershipId, status: "DRAFT" },
    }),
    prisma.inventorySourceLead.count({
      where: { dealershipId, status: "NEW" },
    }),
  ]);

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "acquisition",
    code: "acquisition.appraisal_draft",
    count: appraisalDraftCount,
    severity: "info",
    title: "Draft appraisals",
    description: `${appraisalDraftCount} appraisal(s) are still in draft.`,
    actionHref: "/inventory/acquisition",
    actionLabel: "Open acquisition",
  });

  await reconcileCountSignal(counters, {
    dealershipId,
    domain: "acquisition",
    code: "acquisition.source_lead_new",
    count: sourceLeadNewCount,
    severity: "warning",
    title: "New source leads",
    description: `${sourceLeadNewCount} acquisition lead(s) are newly created.`,
    actionHref: "/inventory/acquisition",
    actionLabel: "Review leads",
  });

  return counters;
}

export async function runSignalEngine(
  dealershipId: string
): Promise<SignalEngineRunResult> {
  await requireTenantActiveForWrite(dealershipId);
  const [inventory, crm, deals, operations, acquisition] = await Promise.all([
    generateInventorySignals(dealershipId),
    generateCrmSignals(dealershipId),
    generateDealSignals(dealershipId),
    generateOperationSignals(dealershipId),
    generateAcquisitionSignals(dealershipId),
  ]);

  return {
    dealershipId,
    inventory,
    crm,
    deals,
    operations,
    acquisition,
  };
}

export async function listSignalsForDealership(
  dealershipId: string,
  query: SignalListQuery
): Promise<{ data: SignalDto[]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  const result = await signalsDb.listSignals({
    dealershipId,
    domain: query.domain,
    severity: query.severity,
    includeResolved: query.includeResolved ?? false,
    limit: Math.min(100, query.limit),
    offset: Math.max(0, query.offset),
  });
  return {
    data: result.data.map(toDto),
    total: result.total,
  };
}
