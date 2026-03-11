import { prisma } from "@/lib/db";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as signalsDb from "../db/signals";
import { Prisma } from "@prisma/client";
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
  timingsMs?: {
    queryCounts: number;
    reconcile: number;
    total: number;
    details?: Record<string, number>;
  };
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

function toDbDomain(domain: SignalDomain): IntelligenceSignal["domain"] {
  switch (domain) {
    case "inventory":
      return "INVENTORY";
    case "crm":
      return "CRM";
    case "deals":
      return "DEALS";
    case "operations":
      return "OPERATIONS";
    case "acquisition":
      return "ACQUISITION";
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

function toDbSeverity(severity: SignalSeverity): IntelligenceSignal["severity"] {
  switch (severity) {
    case "info":
      return "INFO";
    case "success":
      return "SUCCESS";
    case "warning":
      return "WARNING";
    case "danger":
      return "DANGER";
  }
}

function isSameMetadata(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const startedAt = Date.now();
  const value = await fn();
  return {
    value,
    durationMs: Date.now() - startedAt,
  };
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

type OperationSignalSpec = {
  code: "operations.title_issue_hold" | "operations.title_pending";
  count: number;
  severity: SignalSeverity;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

type AcquisitionSignalSpec = {
  code: "acquisition.appraisal_draft" | "acquisition.source_lead_new";
  count: number;
  severity: SignalSeverity;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

type DealSignalSpec = {
  code: "deals.contracts_to_review" | "deals.funding_pending";
  count: number;
  severity: SignalSeverity;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

type InventorySignalSpec = {
  code: "inventory.recon_queue" | "inventory.aged_90d";
  count: number;
  severity: SignalSeverity;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

async function reconcileOperationSignals(
  counters: DomainRunCounters,
  dealershipId: string,
  specs: readonly OperationSignalSpec[]
): Promise<{ totalMs: number; details: Record<string, number> }> {
  const startedAt = Date.now();
  const details: Record<string, number> = {};
  const now = new Date();
  const activeSignals = await prisma.intelligenceSignal.findMany({
    where: {
      dealershipId,
      domain: "OPERATIONS",
      code: { in: specs.map((spec) => spec.code) },
      entityType: null,
      entityId: null,
      resolvedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      severity: true,
      title: true,
      description: true,
      actionLabel: true,
      actionHref: true,
      metadata: true,
    },
  });
  const existingByCode = new Map<string, (typeof activeSignals)[number]>();
  for (const signal of activeSignals) {
    if (!existingByCode.has(signal.code)) {
      existingByCode.set(signal.code, signal);
    }
  }

  await Promise.all(
    specs.map(async (spec) => {
      const timedResult = await timed(async () => {
        const existing = existingByCode.get(spec.code);
        if (spec.count > 0) {
          const metadata = { count: spec.count };
          if (!existing) {
            await prisma.intelligenceSignal.create({
              data: {
                dealershipId,
                domain: "OPERATIONS",
                code: spec.code,
                severity: toDbSeverity(spec.severity),
                title: spec.title,
                description: spec.description,
                actionLabel: spec.actionLabel,
                actionHref: spec.actionHref,
                metadata,
                happenedAt: now,
                entityType: null,
                entityId: null,
              },
            });
            counters.created += 1;
            return;
          }

          const changed =
            existing.severity !== toDbSeverity(spec.severity) ||
            existing.title !== spec.title ||
            (existing.description ?? null) !== (spec.description ?? null) ||
            (existing.actionLabel ?? null) !== (spec.actionLabel ?? null) ||
            (existing.actionHref ?? null) !== (spec.actionHref ?? null) ||
            !isSameMetadata(existing.metadata, metadata);

          if (!changed) {
            counters.unchanged += 1;
            return;
          }

          await prisma.intelligenceSignal.update({
            where: { id: existing.id },
            data: {
              severity: toDbSeverity(spec.severity),
              title: spec.title,
              description: spec.description,
              actionLabel: spec.actionLabel,
              actionHref: spec.actionHref,
              metadata,
              happenedAt: now,
            },
          });
          counters.updated += 1;
          return;
        }

        if (!existing) return;
        const result = await prisma.intelligenceSignal.updateMany({
          where: {
            dealershipId,
            domain: "OPERATIONS",
            code: spec.code,
            entityType: null,
            entityId: null,
            resolvedAt: null,
            deletedAt: null,
          },
          data: {
            resolvedAt: now,
          },
        });
        counters.resolved += result.count;
      });
      details[`operations.reconcile.${spec.code.split(".").slice(1).join(".")}`] =
        timedResult.durationMs;
    })
  );

  return {
    totalMs: Date.now() - startedAt,
    details,
  };
}

async function reconcileAcquisitionSignals(
  counters: DomainRunCounters,
  dealershipId: string,
  specs: readonly AcquisitionSignalSpec[]
): Promise<{ totalMs: number; details: Record<string, number> }> {
  const startedAt = Date.now();
  const details: Record<string, number> = {};
  const now = new Date();
  const activeSignals = await prisma.intelligenceSignal.findMany({
    where: {
      dealershipId,
      domain: "ACQUISITION",
      code: { in: specs.map((spec) => spec.code) },
      entityType: null,
      entityId: null,
      resolvedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      severity: true,
      title: true,
      description: true,
      actionLabel: true,
      actionHref: true,
      metadata: true,
    },
  });
  const existingByCode = new Map<string, (typeof activeSignals)[number]>();
  for (const signal of activeSignals) {
    if (!existingByCode.has(signal.code)) {
      existingByCode.set(signal.code, signal);
    }
  }

  await Promise.all(
    specs.map(async (spec) => {
      const timedResult = await timed(async () => {
        const existing = existingByCode.get(spec.code);
        if (spec.count > 0) {
          const metadata = { count: spec.count };
          if (!existing) {
            await prisma.intelligenceSignal.create({
              data: {
                dealershipId,
                domain: toDbDomain("acquisition"),
                code: spec.code,
                severity: toDbSeverity(spec.severity),
                title: spec.title,
                description: spec.description,
                actionLabel: spec.actionLabel,
                actionHref: spec.actionHref,
                metadata,
                happenedAt: now,
                entityType: null,
                entityId: null,
              },
            });
            counters.created += 1;
            return;
          }

          const changed =
            existing.severity !== toDbSeverity(spec.severity) ||
            existing.title !== spec.title ||
            (existing.description ?? null) !== (spec.description ?? null) ||
            (existing.actionLabel ?? null) !== (spec.actionLabel ?? null) ||
            (existing.actionHref ?? null) !== (spec.actionHref ?? null) ||
            !isSameMetadata(existing.metadata, metadata);

          if (!changed) {
            counters.unchanged += 1;
            return;
          }

          await prisma.intelligenceSignal.update({
            where: { id: existing.id },
            data: {
              severity: toDbSeverity(spec.severity),
              title: spec.title,
              description: spec.description,
              actionLabel: spec.actionLabel,
              actionHref: spec.actionHref,
              metadata,
              happenedAt: now,
            },
          });
          counters.updated += 1;
          return;
        }

        if (!existing) {
          return;
        }

        const result = await prisma.intelligenceSignal.updateMany({
          where: {
            dealershipId,
            domain: toDbDomain("acquisition"),
            code: spec.code,
            entityType: null,
            entityId: null,
            resolvedAt: null,
            deletedAt: null,
          },
          data: {
            resolvedAt: now,
          },
        });
        counters.resolved += result.count;
      });
      details[`acquisition.reconcile.${spec.code.split(".").slice(1).join(".")}`] =
        timedResult.durationMs;
    })
  );

  return {
    totalMs: Date.now() - startedAt,
    details,
  };
}

async function reconcileDealSignals(
  counters: DomainRunCounters,
  dealershipId: string,
  specs: readonly DealSignalSpec[]
): Promise<{ totalMs: number; details: Record<string, number> }> {
  const startedAt = Date.now();
  const details: Record<string, number> = {};
  const now = new Date();
  const activeSignals = await prisma.intelligenceSignal.findMany({
    where: {
      dealershipId,
      domain: "DEALS",
      code: { in: specs.map((spec) => spec.code) },
      entityType: null,
      entityId: null,
      resolvedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      severity: true,
      title: true,
      description: true,
      actionLabel: true,
      actionHref: true,
      metadata: true,
    },
  });
  const existingByCode = new Map<string, (typeof activeSignals)[number]>();
  for (const signal of activeSignals) {
    if (!existingByCode.has(signal.code)) {
      existingByCode.set(signal.code, signal);
    }
  }

  await Promise.all(
    specs.map(async (spec) => {
      const timedResult = await timed(async () => {
        const existing = existingByCode.get(spec.code);
        if (spec.count > 0) {
          const metadata = { count: spec.count };
          if (!existing) {
            await prisma.intelligenceSignal.create({
              data: {
                dealershipId,
                domain: toDbDomain("deals"),
                code: spec.code,
                severity: toDbSeverity(spec.severity),
                title: spec.title,
                description: spec.description,
                actionLabel: spec.actionLabel,
                actionHref: spec.actionHref,
                metadata,
                happenedAt: now,
                entityType: null,
                entityId: null,
              },
            });
            counters.created += 1;
            return;
          }

          const changed =
            existing.severity !== toDbSeverity(spec.severity) ||
            existing.title !== spec.title ||
            (existing.description ?? null) !== (spec.description ?? null) ||
            (existing.actionLabel ?? null) !== (spec.actionLabel ?? null) ||
            (existing.actionHref ?? null) !== (spec.actionHref ?? null) ||
            !isSameMetadata(existing.metadata, metadata);

          if (!changed) {
            counters.unchanged += 1;
            return;
          }

          await prisma.intelligenceSignal.update({
            where: { id: existing.id },
            data: {
              severity: toDbSeverity(spec.severity),
              title: spec.title,
              description: spec.description,
              actionLabel: spec.actionLabel,
              actionHref: spec.actionHref,
              metadata,
              happenedAt: now,
            },
          });
          counters.updated += 1;
          return;
        }

        if (!existing) {
          return;
        }

        const result = await prisma.intelligenceSignal.updateMany({
          where: {
            dealershipId,
            domain: toDbDomain("deals"),
            code: spec.code,
            entityType: null,
            entityId: null,
            resolvedAt: null,
            deletedAt: null,
          },
          data: {
            resolvedAt: now,
          },
        });
        counters.resolved += result.count;
      });
      details[`deals.reconcile.${spec.code.split(".").slice(1).join(".")}`] = timedResult.durationMs;
    })
  );

  return {
    totalMs: Date.now() - startedAt,
    details,
  };
}

async function reconcileInventorySignals(
  counters: DomainRunCounters,
  dealershipId: string,
  specs: readonly InventorySignalSpec[]
): Promise<{ totalMs: number; details: Record<string, number> }> {
  const startedAt = Date.now();
  const details: Record<string, number> = {};
  const now = new Date();
  const activeSignals = await prisma.intelligenceSignal.findMany({
    where: {
      dealershipId,
      domain: "INVENTORY",
      code: { in: specs.map((spec) => spec.code) },
      entityType: null,
      entityId: null,
      resolvedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      severity: true,
      title: true,
      description: true,
      actionLabel: true,
      actionHref: true,
      metadata: true,
    },
  });
  const existingByCode = new Map<string, (typeof activeSignals)[number]>();
  for (const signal of activeSignals) {
    if (!existingByCode.has(signal.code)) {
      existingByCode.set(signal.code, signal);
    }
  }

  await Promise.all(
    specs.map(async (spec) => {
      const timedResult = await timed(async () => {
        const existing = existingByCode.get(spec.code);
        if (spec.count > 0) {
          const metadata = { count: spec.count };
          if (!existing) {
            await prisma.intelligenceSignal.create({
              data: {
                dealershipId,
                domain: toDbDomain("inventory"),
                code: spec.code,
                severity: toDbSeverity(spec.severity),
                title: spec.title,
                description: spec.description,
                actionLabel: spec.actionLabel,
                actionHref: spec.actionHref,
                metadata,
                happenedAt: now,
                entityType: null,
                entityId: null,
              },
            });
            counters.created += 1;
            return;
          }

          const changed =
            existing.severity !== toDbSeverity(spec.severity) ||
            existing.title !== spec.title ||
            (existing.description ?? null) !== (spec.description ?? null) ||
            (existing.actionLabel ?? null) !== (spec.actionLabel ?? null) ||
            (existing.actionHref ?? null) !== (spec.actionHref ?? null) ||
            !isSameMetadata(existing.metadata, metadata);

          if (!changed) {
            counters.unchanged += 1;
            return;
          }

          await prisma.intelligenceSignal.update({
            where: { id: existing.id },
            data: {
              severity: toDbSeverity(spec.severity),
              title: spec.title,
              description: spec.description,
              actionLabel: spec.actionLabel,
              actionHref: spec.actionHref,
              metadata,
              happenedAt: now,
            },
          });
          counters.updated += 1;
          return;
        }

        if (!existing) {
          return;
        }

        const result = await prisma.intelligenceSignal.updateMany({
          where: {
            dealershipId,
            domain: toDbDomain("inventory"),
            code: spec.code,
            entityType: null,
            entityId: null,
            resolvedAt: null,
            deletedAt: null,
          },
          data: {
            resolvedAt: now,
          },
        });
        counters.resolved += result.count;
      });
      details[`inventory.reconcile.${spec.code.split(".").slice(1).join(".")}`] =
        timedResult.durationMs;
    })
  );

  return {
    totalMs: Date.now() - startedAt,
    details,
  };
}

export async function generateInventorySignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const totalStartedAt = Date.now();
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const queryCountsTimed = await timed(async () => {
    const rows = await prisma.$queryRaw<
      Array<{ recon_count: bigint; aged_count: bigint }>
    >(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "status" = 'REPAIR')::bigint AS recon_count,
        count(*) FILTER (
          WHERE "created_at" < ${ninetyDaysAgo}
            AND "status" IN ('AVAILABLE', 'HOLD', 'REPAIR')
        )::bigint AS aged_count
      FROM "Vehicle"
      WHERE "dealership_id" = ${dealershipId}::uuid
        AND "deleted_at" IS NULL
    `);
    const row = rows[0] ?? { recon_count: BigInt(0), aged_count: BigInt(0) };
    return [Number(row.recon_count), Number(row.aged_count)] as const;
  });
  const [reconQueueCount, agedNinetyCount] = queryCountsTimed.value;

  const reconcileTimed = await timed(() =>
    reconcileInventorySignals(counters, dealershipId, [
      {
        code: "inventory.recon_queue",
        count: reconQueueCount,
        severity: "warning",
        title: "Cars in recon",
        description: `${reconQueueCount} vehicle(s) currently in recon queue.`,
        actionHref: "/inventory",
        actionLabel: "Open inventory",
      },
      {
        code: "inventory.aged_90d",
        count: agedNinetyCount,
        severity: "danger",
        title: "Units older than 90 days",
        description: `${agedNinetyCount} vehicle(s) are aging beyond 90 days.`,
        actionHref: "/inventory?alertType=STALE",
        actionLabel: "Review aged units",
      },
    ])
  );

  counters.timingsMs = {
    queryCounts: queryCountsTimed.durationMs,
    reconcile: reconcileTimed.value.totalMs,
    total: Date.now() - totalStartedAt,
    details: {
      ...reconcileTimed.value.details,
    },
  };

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

  await Promise.all([
    reconcileCountSignal(counters, {
      dealershipId,
      domain: "crm",
      code: "crm.followup_overdue",
      count: followupsOverdueCount,
      severity: "warning",
      title: "Follow-ups overdue",
      description: `${followupsOverdueCount} customer follow-up task(s) are overdue.`,
      actionHref: "/customers",
      actionLabel: "Open tasks",
    }),
    reconcileCountSignal(counters, {
      dealershipId,
      domain: "crm",
      code: "crm.new_prospects",
      count: newProspectsCount,
      severity: "info",
      title: "New prospects in pipeline",
      description: `${newProspectsCount} open prospect(s) need action.`,
      actionHref: "/crm/opportunities",
      actionLabel: "Open prospects",
    }),
  ]);

  return counters;
}

export async function generateDealSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const totalStartedAt = Date.now();
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const contractsCountTimedPromise = timed(() =>
    prisma.deal.count({
      where: { dealershipId, deletedAt: null, status: "CONTRACTED" },
    })
  );
  const fundingCountTimedPromise = timed(() =>
    prisma.financeSubmission.count({
      where: {
        dealershipId,
        fundingStatus: "PENDING",
        status: { in: ["SUBMITTED", "DECISIONED"] },
      },
    })
  );
  const queryCountsTimed = await timed(() =>
    Promise.all([contractsCountTimedPromise, fundingCountTimedPromise])
  );
  const [contractsToReviewCountTimed, fundingPendingCountTimed] = queryCountsTimed.value;
  const contractsToReviewCount = contractsToReviewCountTimed.value;
  const fundingPendingCount = fundingPendingCountTimed.value;

  const reconcileTimed = await timed(() =>
    reconcileDealSignals(counters, dealershipId, [
      {
        code: "deals.contracts_to_review",
        count: contractsToReviewCount,
        severity: "warning",
        title: "Contracts to review",
        description: `${contractsToReviewCount} contracted deal(s) require review.`,
        actionHref: "/deals",
        actionLabel: "Review deals",
      },
      {
        code: "deals.funding_pending",
        count: fundingPendingCount,
        severity: "danger",
        title: "Funding pending",
        description: `${fundingPendingCount} submission(s) are pending funding.`,
        actionHref: "/deals",
        actionLabel: "Open funding queue",
      },
    ])
  );

  counters.timingsMs = {
    queryCounts: queryCountsTimed.durationMs,
    reconcile: reconcileTimed.value.totalMs,
    total: Date.now() - totalStartedAt,
    details: {
      "deals.query.contracts_to_review_count": contractsToReviewCountTimed.durationMs,
      "deals.query.funding_pending_count": fundingPendingCountTimed.durationMs,
      ...reconcileTimed.value.details,
    },
  };

  return counters;
}

export async function generateOperationSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const totalStartedAt = Date.now();
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const queryCountsTimed = await timed(async () => {
    const grouped = await prisma.dealTitle.groupBy({
      by: ["titleStatus"],
      where: {
        dealershipId,
        titleStatus: {
          in: ["ISSUE_HOLD", "TITLE_PENDING", "TITLE_SENT", "TITLE_RECEIVED"],
        },
      },
      _count: { _all: true },
    });
    let issueHoldCount = 0;
    let titlePendingCount = 0;
    for (const row of grouped) {
      if (row.titleStatus === "ISSUE_HOLD") {
        issueHoldCount += row._count._all;
      } else {
        titlePendingCount += row._count._all;
      }
    }
    return [issueHoldCount, titlePendingCount] as const;
  });
  const [issueHoldCount, titlePendingCount] = queryCountsTimed.value;

  const reconcileTimed = await timed(() =>
    reconcileOperationSignals(counters, dealershipId, [
      {
        code: "operations.title_issue_hold",
        count: issueHoldCount,
        severity: "danger",
        title: "Title issues on hold",
        description: `${issueHoldCount} title item(s) are blocked with issue hold.`,
        actionHref: "/deals",
        actionLabel: "Resolve holds",
      },
      {
        code: "operations.title_pending",
        count: titlePendingCount,
        severity: "warning",
        title: "Title work pending",
        description: `${titlePendingCount} title workflow item(s) are still pending.`,
        actionHref: "/deals",
        actionLabel: "Open title queue",
      },
    ])
  );

  counters.timingsMs = {
    queryCounts: queryCountsTimed.durationMs,
    reconcile: reconcileTimed.value.totalMs,
    total: Date.now() - totalStartedAt,
    details: {
      ...reconcileTimed.value.details,
    },
  };

  return counters;
}

export async function generateAcquisitionSignals(
  dealershipId: string
): Promise<DomainRunCounters> {
  const totalStartedAt = Date.now();
  const counters: DomainRunCounters = { ...EMPTY_COUNTERS };

  const queryCountsTimed = await timed(async () => {
    const [appraisalDraftCountTimed, sourceLeadNewCountTimed] = await Promise.all([
      timed(() =>
        prisma.vehicleAppraisal.count({
          where: { dealershipId, status: "DRAFT" },
        })
      ),
      timed(() =>
        prisma.inventorySourceLead.count({
          where: { dealershipId, status: "NEW" },
        })
      ),
    ]);
    return { appraisalDraftCountTimed, sourceLeadNewCountTimed };
  });
  const appraisalDraftCount = queryCountsTimed.value.appraisalDraftCountTimed.value;
  const sourceLeadNewCount = queryCountsTimed.value.sourceLeadNewCountTimed.value;
  const reconcileTimed = await timed(() =>
    reconcileAcquisitionSignals(counters, dealershipId, [
      {
        code: "acquisition.appraisal_draft",
        count: appraisalDraftCount,
        severity: "info",
        title: "Draft appraisals",
        description: `${appraisalDraftCount} appraisal(s) are still in draft.`,
      actionHref: "/inventory/acquisition",
        actionLabel: "Open acquisition",
      },
      {
        code: "acquisition.source_lead_new",
        count: sourceLeadNewCount,
        severity: "warning",
        title: "New source leads",
        description: `${sourceLeadNewCount} acquisition lead(s) are newly created.`,
        actionHref: "/inventory/acquisition",
        actionLabel: "Review leads",
      },
    ])
  );

  counters.timingsMs = {
    queryCounts: queryCountsTimed.durationMs,
    reconcile: reconcileTimed.value.totalMs,
    total: Date.now() - totalStartedAt,
    details: {
      "acquisition.query.appraisal_draft_count":
        queryCountsTimed.value.appraisalDraftCountTimed.durationMs,
      "acquisition.query.source_lead_new_count":
        queryCountsTimed.value.sourceLeadNewCountTimed.durationMs,
      ...reconcileTimed.value.details,
    },
  };

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
