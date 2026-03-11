"use client";

import type {
  DashboardV3Appointment,
  DashboardV3Data,
  DashboardV3FinanceNotice,
  DashboardV3OpsQueues,
  DealStageCounts,
  WidgetRow,
} from "./types";

export type Severity = "info" | "success" | "warning" | "danger";

export type ExecutiveSignal = {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  count?: number | null;
  ageDays?: number | null;
  href: string;
  source: string;
};

export type AgendaItem = {
  id: string;
  title: string;
  detail: string;
  count?: number | null;
  href: string;
};

export function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Live snapshot";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatRelativeAge(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recent";
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatGeneratedAt(value);
}

export function formatCompactCurrencyFromCents(cents: number | null): string {
  if (cents == null) return "N/A";
  const dollars = cents / 100;
  if (Math.abs(dollars) < 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(dollars);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(dollars);
}

export function sumCounts(rows: WidgetRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export function getOpenPipelineCount(stageCounts?: DealStageCounts): number {
  if (!stageCounts) return 0;
  return stageCounts.draft + stageCounts.structured + stageCounts.approved + stageCounts.contracted;
}

export function getStageEntries(stageCounts?: DealStageCounts) {
  if (!stageCounts) return [];
  return [
    { label: "Draft", count: stageCounts.draft, tone: "info" as const },
    { label: "Structured", count: stageCounts.structured, tone: "info" as const },
    { label: "Approved", count: stageCounts.approved, tone: "warning" as const },
    { label: "Contracted", count: stageCounts.contracted, tone: "success" as const },
    { label: "Funded", count: stageCounts.funded, tone: "success" as const },
  ];
}

export function getFloorplanUtilizationPercent(payload: DashboardV3Data): number | null {
  const totals = payload.floorplan.reduce(
    (acc, line) => {
      acc.utilized += line.utilizedCents;
      acc.limit += line.limitCents;
      return acc;
    },
    { utilized: 0, limit: 0 }
  );
  if (totals.limit <= 0) return null;
  return Math.round((totals.utilized / totals.limit) * 100);
}

function severityRank(severity: Severity): number {
  switch (severity) {
    case "danger":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    case "success":
      return 3;
    default:
      return 4;
  }
}

function formatQueueAge(ageDays: number | null | undefined): string {
  if (ageDays == null) return "fresh";
  if (ageDays <= 0) return "today";
  if (ageDays === 1) return "1 day";
  return `${ageDays} days`;
}

function getQueueSeverity(
  count: number,
  ageDays: number | null | undefined,
  thresholds: { warningCount: number; dangerCount: number; warningAgeDays: number; dangerAgeDays: number }
): Severity {
  if (count >= thresholds.dangerCount || (ageDays != null && ageDays >= thresholds.dangerAgeDays)) return "danger";
  if (count >= thresholds.warningCount || (ageDays != null && ageDays >= thresholds.warningAgeDays)) return "warning";
  return count > 0 ? "info" : "success";
}

export function buildExecutiveSignals(args: {
  inventoryAlerts: WidgetRow[];
  financeNotices: DashboardV3FinanceNotice[];
  dealPipeline: WidgetRow[];
}) {
  const inventorySignals: ExecutiveSignal[] = args.inventoryAlerts
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `inventory-${row.key}`,
      label: row.label,
      detail: "Inventory blocker requiring attention",
      severity: row.severity ?? "info",
      count: row.count,
      href: row.href ?? "/inventory",
      source: "Inventory",
    }));

  const financeSignals: ExecutiveSignal[] = args.financeNotices.map((notice) => ({
    id: `finance-${notice.id}`,
    label: notice.title,
    detail: notice.subtitle ?? "Finance queue pressure",
    severity: notice.severity,
    count: null,
    href: "/lenders",
    source: "Finance",
  }));

  const dealSignals: ExecutiveSignal[] = args.dealPipeline
    .filter((row) => row.count > 0 && (row.severity === "warning" || row.severity === "danger"))
    .map((row) => ({
      id: `deals-${row.key}`,
      label: row.label,
      detail: "Revenue queue under pressure",
      severity: row.severity ?? "warning",
      count: row.count,
      href: row.href ?? "/deals",
      source: "Deals",
    }));

  return [...financeSignals, ...inventorySignals, ...dealSignals].sort((a, b) => {
    const rank = severityRank(a.severity) - severityRank(b.severity);
    if (rank !== 0) return rank;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

export function buildSalesSignals(args: {
  customerTasks: WidgetRow[];
  appointments: DashboardV3Appointment[];
  dealPipeline: WidgetRow[];
}): ExecutiveSignal[] {
  const taskSignals: ExecutiveSignal[] = args.customerTasks
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `sales-task-${row.key}`,
      label: row.label,
      detail: "Customer follow-up queue requiring sales attention",
      severity: row.count >= 10 ? "warning" : "info",
      count: row.count,
      href: row.href ?? "/customers",
      source: "CRM",
    }));

  const dealSignals: ExecutiveSignal[] = args.dealPipeline
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `sales-deal-${row.key}`,
      label: row.label,
      detail: "Deal-stage pressure affecting active sales flow",
      severity: row.severity ?? "info",
      count: row.count,
      href: row.href ?? "/deals",
      source: "Deals",
    }));

  const appointmentSignals: ExecutiveSignal[] =
    args.appointments.length > 0
      ? [
          {
            id: "sales-appointments",
            label: "Upcoming appointments",
            detail: "Scheduled customer conversations still on deck",
            severity: "info",
            count: args.appointments.length,
            href: "/customers",
            source: "Calendar",
          },
        ]
      : [];

  return [...taskSignals, ...dealSignals, ...appointmentSignals]
    .sort((a, b) => {
      const rank = severityRank(a.severity) - severityRank(b.severity);
      if (rank !== 0) return rank;
      return (b.count ?? 0) - (a.count ?? 0);
    })
    .slice(0, 6);
}

export function buildOpsSignals(args: {
  inventoryAlerts: WidgetRow[];
  financeNotices: DashboardV3FinanceNotice[];
  dealPipeline: WidgetRow[];
  opsQueues: DashboardV3OpsQueues;
}): ExecutiveSignal[] {
  const queueSignals: ExecutiveSignal[] = [
    {
      id: "ops-title-queue",
      label: "Title queue",
      detail: `Contracted deals still waiting to complete title work. Oldest item ${formatQueueAge(
        args.opsQueues.titleQueueOldestAgeDays
      )}.`,
      severity: getQueueSeverity(args.opsQueues.titleQueueCount, args.opsQueues.titleQueueOldestAgeDays, {
        warningCount: 1,
        dangerCount: 5,
        warningAgeDays: 5,
        dangerAgeDays: 10,
      }),
      count: args.opsQueues.titleQueueCount,
      ageDays: args.opsQueues.titleQueueOldestAgeDays,
      href: "/deals/title",
      source: "Title",
    },
    {
      id: "ops-delivery-queue",
      label: "Delivery queue",
      detail: `Contracted deals ready for delivery but not yet completed. Oldest item ${formatQueueAge(
        args.opsQueues.deliveryQueueOldestAgeDays
      )}.`,
      severity: getQueueSeverity(args.opsQueues.deliveryQueueCount, args.opsQueues.deliveryQueueOldestAgeDays, {
        warningCount: 1,
        dangerCount: 4,
        warningAgeDays: 2,
        dangerAgeDays: 5,
      }),
      count: args.opsQueues.deliveryQueueCount,
      ageDays: args.opsQueues.deliveryQueueOldestAgeDays,
      href: "/deals/delivery",
      source: "Delivery",
    },
    {
      id: "ops-funding-queue",
      label: "Funding queue",
      detail: `Contracted deals still awaiting funding completion or approval clearance. Oldest item ${formatQueueAge(
        args.opsQueues.fundingQueueOldestAgeDays
      )}.`,
      severity: getQueueSeverity(args.opsQueues.fundingQueueCount, args.opsQueues.fundingQueueOldestAgeDays, {
        warningCount: 1,
        dangerCount: 4,
        warningAgeDays: 2,
        dangerAgeDays: 4,
      }),
      count: args.opsQueues.fundingQueueCount,
      ageDays: args.opsQueues.fundingQueueOldestAgeDays,
      href: "/deals/funding",
      source: "Funding",
    },
  ].filter((signal) => (signal.count ?? 0) > 0);

  const financeSignals: ExecutiveSignal[] = args.financeNotices.map((notice) => ({
    id: `ops-finance-${notice.id}`,
    label: notice.title,
    detail: notice.subtitle ?? "Desk and funding queue pressure",
    severity: notice.severity,
    count: null,
    href: "/lenders",
    source: "Finance",
  }));

  const inventorySignals: ExecutiveSignal[] = args.inventoryAlerts
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `ops-inventory-${row.key}`,
      label: row.label,
      detail: "Inventory readiness issue impacting recon, merchandising, or delivery flow",
      severity: row.severity ?? "info",
      count: row.count,
      href: row.href ?? "/inventory",
      source: "Inventory",
    }));

  const dealSignals: ExecutiveSignal[] = args.dealPipeline
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `ops-deal-${row.key}`,
      label: row.label,
      detail: "Desk-stage throughput or funding pressure",
      severity: row.severity ?? "info",
      count: row.count,
      href: row.href ?? "/deals",
      source: "Deals",
    }));

  return [...queueSignals, ...financeSignals, ...inventorySignals, ...dealSignals]
    .sort((a, b) => {
      const rank = severityRank(a.severity) - severityRank(b.severity);
      if (rank !== 0) return rank;
      const ageRank = (b.ageDays ?? -1) - (a.ageDays ?? -1);
      if (ageRank !== 0) return ageRank;
      return (b.count ?? 0) - (a.count ?? 0);
    })
    .slice(0, 6);
}

export function buildAgendaItems(args: {
  customerTasks: WidgetRow[];
  appointments: DashboardV3Appointment[];
  dealPipeline: WidgetRow[];
}): AgendaItem[] {
  const taskItems = args.customerTasks
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `task-${row.key}`,
      title: row.label,
      detail: "Customer demand queue",
      count: row.count,
      href: row.href ?? "/customers",
    }));

  const dealItems = args.dealPipeline
    .filter((row) => row.count > 0)
    .map((row) => ({
      id: `deal-${row.key}`,
      title: row.label,
      detail: "Revenue queue",
      count: row.count,
      href: row.href ?? "/deals",
    }));

  const appointmentItem = args.appointments.length
    ? [
        {
          id: "appointments",
          title: "Upcoming appointments",
          detail: args.appointments[0]?.timeLabel ?? "Customer appointment flow",
          count: args.appointments.length,
          href: "/customers",
        },
      ]
    : [];

  return [...taskItems, ...dealItems, ...appointmentItem]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 6);
}
