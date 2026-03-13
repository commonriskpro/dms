"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ShieldCheck,
  Siren,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  DashboardLayoutItem,
  DashboardV3Appointment,
  DashboardV3Data,
  DashboardV3MaterialChange,
  DealStageCounts,
  WidgetRow,
} from "./types";
import {
  buildAgendaItems,
  buildExecutiveSignals,
  buildOpsSignals,
  buildSalesSignals,
  formatCompactCurrencyFromCents,
  formatGeneratedAt,
  formatRelativeAge,
  getFloorplanUtilizationPercent,
  getOpenPipelineCount,
  getStageEntries,
  sumCounts,
  type AgendaItem,
  type ExecutiveSignal,
  type Severity,
} from "./dashboardExecutiveLogic";
import {
  DASHBOARD_PRESET_META,
  getDashboardPreset,
  type DashboardPreset,
} from "./dashboardExecutivePresets";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { DashboardCustomizePanel } from "./DashboardCustomizePanel";
import { MetricCard } from "./MetricCard";
import { InventoryWorkbenchCard } from "./InventoryWorkbenchCard";
import { InventorySignalListCard } from "./InventorySignalListCard";
import { AcquisitionInsightsCard } from "./AcquisitionInsightsCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { useRefreshSignal } from "@/lib/ui/refresh-signal";
import { cn } from "@/lib/utils";

type DashboardExecutiveClientProps = {
  initialData: DashboardV3Data;
  permissions: string[];
  userId?: string | null;
  activeDealershipId?: string | null;
  layout?: DashboardLayoutItem[];
};

const SECTION_GUIDANCE_STORAGE_PREFIX = "dealer-dashboard-executive-guidance:v1:";
const PRESET_STORAGE_PREFIX = "dealer-dashboard-executive-preset:v1:";

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function getVisibleSorted(layout: DashboardLayoutItem[]): DashboardLayoutItem[] {
  return layout
    .filter((item) => item.visible)
    .sort((a, b) => {
      const zoneA = a.zone === "topRow" ? 0 : 1;
      const zoneB = b.zone === "topRow" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.order - b.order;
    });
}

function severityClasses(severity: Severity): string {
  switch (severity) {
    case "danger":
      return "border-[var(--danger)]/25 bg-[var(--danger)]/10 text-[var(--danger)]";
    case "warning":
      return "border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]";
    case "success":
      return "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]";
    case "info":
    default:
      return "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]";
  }
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
      {children}
    </p>
  );
}

function InsetCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.028)_0%,rgba(255,255,255,0.01)_100%)] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function EmptyState({
  title,
  description,
  tone = "info",
}: {
  title: string;
  description: string;
  tone?: Severity;
}) {
  const Icon = tone === "success" ? ShieldCheck : tone === "warning" ? Siren : ClipboardList;
  return (
    <InsetCard className="flex min-h-[152px] items-center gap-3">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          severityClasses(tone)
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <p className="text-sm leading-6 text-[var(--muted-text)]">{description}</p>
      </div>
    </InsetCard>
  );
}

function SectionIntro({
  eyebrow,
  title,
  detail,
  meta,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)] min-[1800px]:text-[22px]">
          {title}
        </h2>
        <p className="max-w-[66ch] text-sm leading-6 text-[var(--muted-text)]">{detail}</p>
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
    </div>
  );
}

function SummaryLens({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  contextLabel = "GM decision lens",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: Severity;
  contextLabel?: string;
}) {
  return (
    <InsetCard className="flex min-h-[168px] flex-col justify-between min-[1800px]:min-h-[176px]">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", severityClasses(tone))}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-[var(--text)]">{label}</p>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">{contextLabel}</p>
            </div>
          </div>
          <span className="shrink-0 text-[24px] font-semibold leading-none tracking-[-0.04em] text-[var(--text)] min-[1800px]:text-[28px]">
            {value}
          </span>
        </div>
        <div className="h-px bg-[var(--border)]/70" />
      </div>
      <p className="text-sm leading-7 text-[var(--muted-text)]">{detail}</p>
    </InsetCard>
  );
}

function MiniStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <InsetCard className="min-h-[128px] min-[1800px]:min-h-[136px]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{label}</p>
      <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[var(--text)] min-[1800px]:text-[34px]">
        {value}
      </p>
      <p className="mt-1 max-w-[34ch] text-sm leading-6 text-[var(--muted-text)]">{detail}</p>
    </InsetCard>
  );
}

function ExecutiveSummaryCard({
  grossProfitDeltaCents,
  grossProfitFrontCents,
  grossProfitBackCents,
  openPipeline,
  demandPressure,
  floorplanUtilization,
  unresolvedOpsCount,
  operationsScore,
  generatedAtLabel,
  agendaItems,
}: {
  grossProfitDeltaCents: number | null;
  grossProfitFrontCents: number | null;
  grossProfitBackCents: number | null;
  openPipeline: number | null;
  demandPressure: number | null;
  floorplanUtilization: number | null;
  unresolvedOpsCount: number;
  operationsScore: number;
  generatedAtLabel: string;
  agendaItems: AgendaItem[];
}) {
  const topAgenda = agendaItems[0];
  return (
    <Widget
      title="GM command center"
      subtitle="Grounded in the live V3 data contract and reorganized around health, risk, blockers, and owner attention."
      action={
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)]">
          Snapshot {generatedAtLabel}
        </div>
      }
      className="h-full"
    >
      <div className="space-y-5">
        <InsetCard className="bg-[linear-gradient(135deg,rgba(56,189,248,0.08)_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.01)_100%)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Executive readout
              </p>
              <p className="text-sm text-[var(--muted-text)]">
                This section compresses the current dashboard payload into owner-level decisions instead of equal-weight operational cards.
              </p>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {topAgenda ? `Top queue: ${topAgenda.title}` : "All primary queues are currently calm"}
            </div>
          </div>
        </InsetCard>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <SummaryLens
            icon={ShieldCheck}
            label="Are we healthy today?"
            value={`${operationsScore}%`}
            detail={`${unresolvedOpsCount} unresolved blockers across ops, inventory, and revenue queues.`}
            tone={unresolvedOpsCount === 0 ? "success" : unresolvedOpsCount > 4 ? "danger" : "warning"}
          />
          <SummaryLens
            icon={TrendingUp}
            label="Where is profit moving?"
            value={
              grossProfitDeltaCents == null
                ? "N/A"
                : `${grossProfitDeltaCents >= 0 ? "+" : "-"}${formatCompactCurrencyFromCents(
                    Math.abs(grossProfitDeltaCents)
                  )}`
            }
            detail={
              grossProfitDeltaCents == null
                ? "Realized gross profit is hidden because deals access is not available for this session."
                : "Using realized contracted-deal gross from the live dashboard payload instead of a finance-volume proxy."
            }
            tone={grossProfitDeltaCents == null ? "info" : grossProfitDeltaCents >= 0 ? "success" : "warning"}
          />
          <SummaryLens
            icon={Siren}
            label="What is blocked now?"
            value={String(unresolvedOpsCount)}
            detail="This combines finance notices, inventory risk rows, and severe deal-pipeline pressure into one executive blocker count."
            tone={unresolvedOpsCount > 4 ? "danger" : unresolvedOpsCount > 0 ? "warning" : "success"}
          />
          <SummaryLens
            icon={ClipboardList}
            label="What needs attention next?"
            value={topAgenda?.count != null ? String(topAgenda.count) : "0"}
            detail={topAgenda ? `${topAgenda.title} is currently the loudest queue.` : "No urgent queue is currently elevated."}
            tone={topAgenda ? "info" : "success"}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2 min-[1600px]:grid-cols-4">
          <MiniStat
            label="Front gross"
            value={grossProfitFrontCents == null ? "N/A" : formatCompactCurrencyFromCents(grossProfitFrontCents)}
            detail={
              grossProfitFrontCents == null
                ? "Front-end gross is hidden because deals access is not available for this session."
                : "Realized front-end gross from contracted deals in the current dashboard window."
            }
          />
          <MiniStat
            label="Back gross"
            value={grossProfitBackCents == null ? "N/A" : formatCompactCurrencyFromCents(grossProfitBackCents)}
            detail={
              grossProfitBackCents == null
                ? "Back-end gross is hidden because deals access is not available for this session."
                : "Realized backend gross from finance and product contribution in contracted deals."
            }
          />
          <MiniStat
            label="Revenue flow"
            value={openPipeline == null ? "N/A" : String(openPipeline)}
            detail={
              openPipeline == null
                ? "Deal volume is hidden because deals access is not available for this session."
                : "Open deals moving through desk, approval, and contract stages."
            }
          />
          <MiniStat
            label="Demand pressure"
            value={demandPressure == null ? "N/A" : String(demandPressure)}
            detail={
              demandPressure == null
                ? "CRM and customer queues are hidden because those permissions are not available."
                : "Customer follow-ups, prospects, inbox, and pending appointment tasks."
            }
          />
          <MiniStat
            label="Capital exposure"
            value={floorplanUtilization != null ? `${floorplanUtilization}%` : "N/A"}
            detail={
              floorplanUtilization == null
                ? "Floorplan utilization is hidden because lender access is not available."
                : "Floorplan utilization across live lender lines."
            }
          />
        </div>
      </div>
    </Widget>
  );
}

function SalesSummaryCard({
  leadsCount,
  leadsDelta,
  demandPressure,
  appointmentsCount,
  openPipeline,
  fundedCount,
  topCloserName,
  topCloserDealsClosed,
  topGrossRepName,
  topGrossRepCents,
  averageGrossPerDealCents,
  rankedRepCount,
  staleLeadCount,
  oldestStaleLeadAgeDays,
  overdueFollowUpCount,
  appointmentsSetToday,
  callbacksScheduledToday,
  rangeLabel,
  generatedAtLabel,
  agendaItems,
}: {
  leadsCount: number;
  leadsDelta: number | null;
  demandPressure: number | null;
  appointmentsCount: number | null;
  openPipeline: number | null;
  fundedCount: number | null;
  topCloserName: string | null;
  topCloserDealsClosed: number;
  topGrossRepName: string | null;
  topGrossRepCents: number;
  averageGrossPerDealCents: number;
  rankedRepCount: number;
  staleLeadCount: number;
  oldestStaleLeadAgeDays: number | null;
  overdueFollowUpCount: number;
  appointmentsSetToday: number;
  callbacksScheduledToday: number;
  rangeLabel: string;
  generatedAtLabel: string;
  agendaItems: AgendaItem[];
}) {
  const topAgenda = agendaItems[0];
  return (
    <Widget
      title="Sales command center"
      subtitle="This preset reweights the current dashboard payload toward lead flow, follow-up pressure, appointments, and active deal movement."
      action={
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)]">
          Snapshot {generatedAtLabel}
        </div>
      }
      className="h-full"
    >
      <div className="space-y-5">
        <InsetCard className="bg-[linear-gradient(135deg,rgba(99,102,241,0.11)_0%,rgba(56,189,248,0.06)_34%,rgba(255,255,255,0.02)_68%,rgba(255,255,255,0.01)_100%)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Sales readout
              </p>
              <p className="text-sm text-[var(--muted-text)]">
                This view prioritizes where the sales team should push today: demand, appointments, follow-up load, and live deal flow.
              </p>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {topAgenda ? `Top queue: ${topAgenda.title}` : "No elevated sales queue"}
            </div>
          </div>
        </InsetCard>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <SummaryLens
            icon={TrendingUp}
            label="Are leads moving?"
            value={leadsDelta == null ? "N/A" : `${leadsDelta >= 0 ? "+" : ""}${leadsDelta}`}
            detail={
              leadsDelta == null
                ? "Lead trend is hidden because CRM access is not available."
                : "Seven-day lead movement from the current dashboard metrics."
            }
            tone={leadsDelta == null ? "info" : leadsDelta >= 0 ? "success" : "warning"}
            contextLabel="Sales decision lens"
          />
          <SummaryLens
            icon={Users}
            label="Where is follow-up pressure?"
            value={demandPressure == null ? "N/A" : String(demandPressure)}
            detail={
              demandPressure == null
                ? "Customer demand queues are hidden because CRM and customer access are not available."
                : "Combined follow-up, inbox, prospect, and appointment-related customer workload."
            }
            tone={demandPressure != null && demandPressure > 8 ? "warning" : "info"}
            contextLabel="Sales decision lens"
          />
          <SummaryLens
            icon={CalendarClock}
            label="What is on deck?"
            value={appointmentsCount == null ? "N/A" : String(appointmentsCount)}
            detail={
              appointmentsCount == null
                ? "Appointment visibility is hidden because CRM access is not available."
                : "Upcoming appointments that can be converted into active sales conversations."
            }
            tone={appointmentsCount != null && appointmentsCount > 0 ? "success" : "info"}
            contextLabel="Sales decision lens"
          />
          <SummaryLens
            icon={ClipboardList}
            label="What needs coaching next?"
            value={topAgenda?.count != null ? String(topAgenda.count) : "0"}
            detail={topAgenda ? `${topAgenda.title} is currently the loudest sales queue.` : "No urgent sales queue is currently elevated."}
            tone={topAgenda ? "info" : "success"}
            contextLabel="Sales decision lens"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          <MiniStat
            label="New leads"
            value={String(leadsCount)}
            detail="Current top-of-funnel volume from the live dashboard payload."
          />
          <MiniStat
            label="Stale leads"
            value={String(staleLeadCount)}
            detail={
              staleLeadCount === 0
                ? "No stale leads are currently surfaced by the 7-day inactivity threshold."
                : `Oldest surfaced lead has been idle for ${oldestStaleLeadAgeDays ?? 0}d.`
            }
          />
          <MiniStat
            label="Overdue follow-ups"
            value={String(overdueFollowUpCount)}
            detail={
              overdueFollowUpCount === 0
                ? "No customer follow-up tasks are overdue right now."
                : "Customer tasks past due date and still open."
            }
          />
          <MiniStat
            label="Appointments set today"
            value={String(appointmentsSetToday)}
            detail={
              callbacksScheduledToday > 0
                ? `${callbacksScheduledToday} callback${callbacksScheduledToday === 1 ? "" : "s"} also scheduled today.`
                : "No same-day callback scheduling pressure."
            }
          />
          <MiniStat
            label="Top closer"
            value={topCloserName ?? "N/A"}
            detail={
              rankedRepCount === 0
                ? `No ranked reps in ${rangeLabel.toLowerCase()}.`
                : `${topCloserDealsClosed} deals closed in ${rangeLabel.toLowerCase()}.`
            }
          />
          <MiniStat
            label="Top gross rep"
            value={topGrossRepName ?? "N/A"}
            detail={
              rankedRepCount === 0
                ? `No gross-ranked reps in ${rangeLabel.toLowerCase()}.`
                : `${formatCompactCurrencyFromCents(topGrossRepCents)} in realized gross.`
            }
          />
          <MiniStat
            label="Avg gross / deal"
            value={rankedRepCount === 0 ? "N/A" : formatCompactCurrencyFromCents(averageGrossPerDealCents)}
            detail={
              rankedRepCount === 0
                ? "Sales manager gross metrics are unavailable without contracted sales performance."
                : `Across ${rankedRepCount} ranked rep${rankedRepCount === 1 ? "" : "s"} in ${rangeLabel.toLowerCase()}.`
            }
          />
          <MiniStat
            label="Open pipeline"
            value={openPipeline == null ? "N/A" : String(openPipeline)}
            detail={
              openPipeline == null
                ? "Pipeline volume is hidden because deals access is not available."
                : "Open deals currently moving through structured, approved, and contracted stages."
            }
          />
          <MiniStat
            label="Funded wins"
            value={fundedCount == null ? "N/A" : String(fundedCount)}
            detail={
              fundedCount == null
                ? "Funded count is hidden because deals access is not available."
                : "Funded deals from the current stage-count snapshot."
            }
          />
        </div>
      </div>
    </Widget>
  );
}

function OpsSummaryCard({
  operationsScore,
  unresolvedOpsCount,
  titleQueueCount,
  titleQueueOldestAgeDays,
  deliveryQueueCount,
  deliveryQueueOldestAgeDays,
  fundingQueueCount,
  fundingQueueOldestAgeDays,
  openPipeline,
  generatedAtLabel,
  prioritySignal,
}: {
  operationsScore: number;
  unresolvedOpsCount: number;
  titleQueueCount: number | null;
  titleQueueOldestAgeDays: number | null;
  deliveryQueueCount: number | null;
  deliveryQueueOldestAgeDays: number | null;
  fundingQueueCount: number | null;
  fundingQueueOldestAgeDays: number | null;
  openPipeline: number | null;
  generatedAtLabel: string;
  prioritySignal?: ExecutiveSignal | null;
}) {
  return (
    <Widget
      title="Desk control center"
      subtitle="This preset reweights the current dashboard payload toward blocker clearance, desk throughput, funding pressure, and inventory readiness."
      action={
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)]">
          Snapshot {generatedAtLabel}
        </div>
      }
      className="h-full"
    >
      <div className="space-y-5">
        <InsetCard className="bg-[linear-gradient(135deg,rgba(245,158,11,0.10)_0%,rgba(34,197,94,0.07)_28%,rgba(56,189,248,0.05)_58%,rgba(255,255,255,0.015)_100%)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Ops readout
              </p>
              <p className="text-sm text-[var(--muted-text)]">
                This view prioritizes what the desk team must unblock next: finance notices, inventory readiness, active pipeline completion, and blocker removal.
              </p>
            </div>
            <div className="rounded-full border border-[var(--warning)]/20 bg-[var(--warning)]/8 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {prioritySignal ? `Top queue: ${prioritySignal.label}` : "No elevated desk queue"}
            </div>
          </div>
        </InsetCard>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <SummaryLens
            icon={ShieldCheck}
            label="Are we operationally healthy?"
            value={`${operationsScore}%`}
            detail="Current blocker-adjusted ops score based on finance, inventory, and revenue queue pressure."
            tone={unresolvedOpsCount === 0 ? "success" : unresolvedOpsCount > 3 ? "warning" : "info"}
            contextLabel="Desk decision lens"
          />
          <SummaryLens
            icon={Siren}
            label="What is blocked now?"
            value={String(unresolvedOpsCount)}
            detail="Combined finance notices, inventory blocker rows, and deal-stage pressure acting as desk friction."
            tone={unresolvedOpsCount > 0 ? "warning" : "success"}
            contextLabel="Desk decision lens"
          />
          <SummaryLens
            icon={ClipboardList}
            label="Where is throughput pressure?"
            value={openPipeline == null ? "N/A" : String(openPipeline)}
            detail={
              openPipeline == null
                ? "Deal throughput is hidden because deals access is not available."
                : "Open deals still moving through structured, approved, and contracted desk stages."
            }
            tone={openPipeline != null && openPipeline > 0 ? "info" : "success"}
            contextLabel="Desk decision lens"
          />
          <SummaryLens
            icon={TrendingUp}
            label="What needs clearing next?"
            value={prioritySignal?.count != null ? String(prioritySignal.count) : "0"}
            detail={prioritySignal ? `${prioritySignal.label} is currently the loudest desk queue.` : "No urgent desk queue is currently elevated."}
            tone={prioritySignal ? prioritySignal.severity : "success"}
            contextLabel="Desk decision lens"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <MiniStat
            label="Title queue"
            value={titleQueueCount == null ? "N/A" : String(titleQueueCount)}
            detail={
              titleQueueCount == null
                ? "Title queue depth is hidden because deals access is not available."
                : `Contracted deals still waiting to clear title and DMV completion work. Oldest item ${
                    titleQueueOldestAgeDays == null
                      ? "not aged yet"
                      : titleQueueOldestAgeDays === 0
                        ? "from today"
                        : `${titleQueueOldestAgeDays}d old`
                  }.`
            }
          />
          <MiniStat
            label="Delivery queue"
            value={deliveryQueueCount == null ? "N/A" : String(deliveryQueueCount)}
            detail={
              deliveryQueueCount == null
                ? "Delivery queue depth is hidden because deals access is not available."
                : `Contracted deals marked ready for delivery but not yet completed. Oldest item ${
                    deliveryQueueOldestAgeDays == null
                      ? "not aged yet"
                      : deliveryQueueOldestAgeDays === 0
                        ? "from today"
                        : `${deliveryQueueOldestAgeDays}d old`
                  }.`
            }
          />
          <MiniStat
            label="Funding queue"
            value={fundingQueueCount == null ? "N/A" : String(fundingQueueCount)}
            detail={
              fundingQueueCount == null
                ? "Funding queue depth is hidden because deals access is not available."
                : `Contracted deals still awaiting funding completion or approval clearance. Oldest item ${
                    fundingQueueOldestAgeDays == null
                      ? "not aged yet"
                      : fundingQueueOldestAgeDays === 0
                        ? "from today"
                        : `${fundingQueueOldestAgeDays}d old`
                  }.`
            }
          />
        </div>
      </div>
    </Widget>
  );
}

function ExecutiveExceptionsCard({ signals }: { signals: ExecutiveSignal[] }) {
  return (
    <ExceptionRail
      title="Executive exceptions"
      subtitle="Surface blocker queues before they get buried under routine dashboards and list views."
      emptyTitle="No urgent exceptions"
      emptyDescription="Finance notices and high-severity operational blockers are currently clear."
      signals={signals}
      collapsible
    />
  );
}

function ExceptionRail({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  signals,
  collapsible = false,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  signals: ExecutiveSignal[];
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const items = (collapsed ? signals.slice(0, 3) : signals.slice(0, 6));
  return (
    <Widget
      title={title}
      subtitle={subtitle}
      className="h-full"
      action={
        collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            {collapsed ? "Expand" : "Collapse"}
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            tone="success"
          />
        ) : (
          items.map((signal) => (
            <Link
              key={signal.id}
              href={signal.href}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-4 transition-colors hover:bg-[var(--surface-2)]/80 min-[2200px]:gap-2.5 min-[2200px]:p-3"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", severityClasses(signal.severity))}>
                    {signal.source}
                  </span>
                  <span className="text-xs text-[var(--text-soft)]">{signal.severity}</span>
                </div>
                <p className="truncate text-sm font-semibold text-[var(--text)]">{signal.label}</p>
                <p className="mt-1 text-sm text-[var(--muted-text)] min-[2200px]:text-[13px] min-[2200px]:leading-5">{signal.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {signal.count != null ? (
                  <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-sm font-semibold text-[var(--text)]">
                    {signal.count}
                  </span>
                ) : null}
                <ArrowRight className="h-4 w-4 text-[var(--text-soft)]" />
              </div>
            </Link>
          ))
        )}
        {collapsible && collapsed && signals.length > items.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/30 px-3.5 py-2 text-xs font-medium text-[var(--text-soft)]">
            {signals.length - items.length} more queue item{signals.length - items.length === 1 ? "" : "s"} hidden
          </div>
        ) : null}
      </div>
    </Widget>
  );
}

function PipelineOverviewCard({
  rows,
  stageCounts,
}: {
  rows: WidgetRow[];
  stageCounts?: DealStageCounts;
}) {
  const stages = getStageEntries(stageCounts);
  const pipelineRows = rows.slice(0, 5);
  return (
    <Widget
      title="Revenue and pipeline"
      subtitle="Keep the desk moving by making stage pressure and downstream blockers visible in one place."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {stages.length === 0 ? (
            <span className="text-sm text-[var(--muted-text)]">No stage-count data available.</span>
          ) : (
            stages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-[var(--text)]">{stage.label}</span>
                <span className="ml-2 tabular-nums text-[var(--muted-text)]">{stage.count}</span>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-2">
          {pipelineRows.length === 0 ? (
            <EmptyState
              title="Deal pipeline is currently quiet"
              description="No active revenue queue is elevated enough to surface here."
            />
          ) : (
            pipelineRows.map((row) => (
              <Link
                key={row.key}
                href={row.href ?? "/deals"}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/80"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("h-2.5 w-2.5 rounded-full", row.severity === "danger"
                    ? "bg-[var(--danger)]"
                    : row.severity === "warning"
                      ? "bg-[var(--warning)]"
                      : row.severity === "success"
                        ? "bg-[var(--success)]"
                        : "bg-[var(--accent)]")}
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{row.label}</p>
                    <p className="text-sm text-[var(--muted-text)]">Revenue queue focus area</p>
                  </div>
                </div>
                <span className="text-base font-semibold tabular-nums text-[var(--text)]">{row.count}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Widget>
  );
}

function DemandPanel({
  appointments,
  customerTasks,
}: {
  appointments: DashboardV3Appointment[];
  customerTasks: WidgetRow[];
}) {
  const topTasks = customerTasks.slice(0, 4);
  return (
    <Widget
      title="Customer demand"
      subtitle="Balance appointment flow with follow-up pressure so leads do not stall between teams."
      className="h-full"
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <InsetCard>
          <div className="mb-3 flex items-center gap-2 text-[var(--text)]">
            <CalendarClock className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold">Upcoming appointments</span>
          </div>
          <div className="space-y-2">
            {appointments.length === 0 ? (
              <EmptyState
                title="No upcoming appointments"
                description="Customer appointment flow is currently quiet."
              />
            ) : (
              appointments.slice(0, 4).map((apt) => (
                <div key={apt.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{apt.name}</p>
                      {apt.meta ? <p className="truncate text-sm text-[var(--muted-text)]">{apt.meta}</p> : null}
                    </div>
                    {apt.timeLabel ? (
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">
                        {apt.timeLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </InsetCard>

        <InsetCard>
          <div className="mb-3 flex items-center gap-2 text-[var(--text)]">
            <Users className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold">Follow-up pressure</span>
          </div>
          <div className="space-y-2">
            {topTasks.length === 0 ? (
              <EmptyState
                title="No customer queues are elevated"
                description="Follow-ups, inbox, and prospect demand are currently under control."
                tone="success"
              />
            ) : (
              topTasks.map((row) => (
                <Link
                  key={row.key}
                  href={row.href ?? "/customers"}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 transition-colors hover:bg-[var(--surface)]"
                >
                  <span className="text-sm font-medium text-[var(--text)]">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{row.count}</span>
                </Link>
              ))
            )}
          </div>
        </InsetCard>
      </div>
    </Widget>
  );
}

function OwnerAgendaCard({ agendaItems }: { agendaItems: AgendaItem[] }) {
  return (
    <Widget
      title="Activity and accountability"
      subtitle="Top owner-level queues pulled from the current dashboard payload."
      className="h-full"
    >
      <div className="space-y-2">
        {agendaItems.length === 0 ? (
          <EmptyState
            title="No urgent owner-level items"
            description="The top demand and revenue queues are currently settled enough that no agenda item has broken out."
            tone="success"
          />
        ) : (
          agendaItems.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/80"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-soft)]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</p>
                  <p className="truncate text-sm text-[var(--muted-text)]">{item.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.count != null ? (
                  <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{item.count}</span>
                ) : null}
                <ArrowRight className="h-4 w-4 text-[var(--text-soft)]" />
              </div>
            </Link>
          ))
        )}
      </div>
    </Widget>
  );
}

function MaterialChangesCard({ items }: { items: DashboardV3MaterialChange[] }) {
  return (
    <Widget
      title="Recent material changes"
      subtitle="Latest dealer-wide changes from deal progression, inventory updates, and customer activity."
      className="h-full"
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            title="No recent material changes"
            description="Visible deal, inventory, and customer changes are currently quiet."
            tone="success"
          />
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/80"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                      severityClasses(item.severity)
                    )}
                  >
                    {item.domain}
                  </span>
                  <span className="text-xs text-[var(--text-soft)]">{formatRelativeAge(item.timestamp)}</span>
                  <span className="text-xs text-[var(--text-soft)]">{formatGeneratedAt(item.timestamp)}</span>
                </div>
                <p className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--muted-text)]">{item.detail}</p>
                {item.actorLabel ? (
                  <p className="mt-2 text-xs font-medium text-[var(--text-soft)]">By {item.actorLabel}</p>
                ) : null}
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-soft)]" />
            </Link>
          ))
        )}
      </div>
    </Widget>
  );
}

function AgendaRail({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  agendaItems,
  collapsible = false,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  agendaItems: AgendaItem[];
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const visibleItems = collapsed ? agendaItems.slice(0, 3) : agendaItems;
  return (
    <Widget
      title={title}
      subtitle={subtitle}
      className="h-full"
      action={
        collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            {collapsed ? "Expand" : "Collapse"}
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {agendaItems.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            tone="success"
          />
        ) : (
          visibleItems.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/80 min-[2200px]:gap-2.5 min-[2200px]:px-3.5 min-[2200px]:py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-soft)] min-[2200px]:h-6 min-[2200px]:w-6">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</p>
                  <p className="truncate text-sm text-[var(--muted-text)] min-[2200px]:text-[13px]">{item.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.count != null ? (
                  <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{item.count}</span>
                ) : null}
                <ArrowRight className="h-4 w-4 text-[var(--text-soft)]" />
              </div>
            </Link>
          ))
        )}
        {collapsible && collapsed && agendaItems.length > visibleItems.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/30 px-3.5 py-2 text-xs font-medium text-[var(--text-soft)]">
            {agendaItems.length - visibleItems.length} more agenda item{agendaItems.length - visibleItems.length === 1 ? "" : "s"} hidden
          </div>
        ) : null}
      </div>
    </Widget>
  );
}

export function DashboardExecutiveClient({
  initialData,
  permissions,
  userId,
  activeDealershipId,
  layout: serverLayout,
}: DashboardExecutiveClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token: refreshToken } = useRefreshSignal();
  const searchParams = useSearchParams();
  const preset = getDashboardPreset(searchParams.get("preset"));
  const hasExplicitPreset = searchParams.has("preset");
  const [customizeOpen, setCustomizeOpen] = React.useState(
    () => searchParams.get("customize") === "true"
  );
  const guidanceStorageKey = React.useMemo(
    () => `${SECTION_GUIDANCE_STORAGE_PREFIX}${activeDealershipId ?? "global"}`,
    [activeDealershipId]
  );
  const presetStorageKey = React.useMemo(
    () => `${PRESET_STORAGE_PREFIX}${activeDealershipId ?? "global"}:${userId ?? "anonymous"}`,
    [activeDealershipId, userId]
  );
  const [showSectionGuidance, setShowSectionGuidance] = React.useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const key = `${SECTION_GUIDANCE_STORAGE_PREFIX}${activeDealershipId ?? "global"}`;
      return window.localStorage.getItem(key) !== "hidden";
    } catch {
      return true;
    }
  });

  const {
    metrics,
    customerTasks,
    inventoryAlerts,
    floorplan,
    dealPipeline,
    dealStageCounts,
    opsQueues,
    materialChanges,
    salesManager,
    appointments,
    financeNotices,
    dashboardGeneratedAt,
  } = initialData;

  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");
  const canAcquisitionRead = hasPermission(permissions, "inventory.acquisition.read") || canInventory;
  const canWriteInventory = canInventory && hasPermission(permissions, "inventory.write");
  const canWriteCustomers = canCustomers && hasPermission(permissions, "customers.write");
  const canWriteDeals = canDeals && hasPermission(permissions, "deals.write");

  const layout = serverLayout ?? [];
  const useLayout = layout.length > 0;
  const visibleIds = React.useMemo(() => {
    if (!useLayout) return null;
    return new Set(getVisibleSorted(layout).map((item) => item.widgetId));
  }, [useLayout, layout]);
  const isVisible = React.useCallback(
    (widgetId: DashboardLayoutItem["widgetId"]) => {
      if (!visibleIds) return true;
      return visibleIds.has(widgetId);
    },
    [visibleIds]
  );

  const unresolvedOpsCount = React.useMemo(() => {
    const inventorySignalCount = canInventory
      ? inventoryAlerts.filter((row) => row.severity === "warning" || row.severity === "danger").length
      : 0;
    const dealSignalCount = canDeals
      ? dealPipeline.filter((row) => row.severity === "warning" || row.severity === "danger").length
      : 0;
    const operationsCount = canLenders ? financeNotices.length : 0;
    const opsQueueCount = canDeals
      ? [opsQueues.titleQueueCount, opsQueues.deliveryQueueCount, opsQueues.fundingQueueCount].filter((count) => count > 0).length
      : 0;
    return Math.max(0, operationsCount + inventorySignalCount + dealSignalCount + opsQueueCount);
  }, [canDeals, canInventory, canLenders, dealPipeline, financeNotices, inventoryAlerts, opsQueues]);

  const operationsScore = Math.max(0, Math.min(99, 99 - unresolvedOpsCount * 4));
  const executiveSignals = React.useMemo(
    () =>
      buildExecutiveSignals({
        inventoryAlerts: canInventory && isVisible("inventory-alerts") ? inventoryAlerts : [],
        financeNotices: canLenders && isVisible("finance-notices") ? financeNotices : [],
        dealPipeline: canDeals && isVisible("deal-pipeline") ? dealPipeline : [],
      }),
    [canDeals, canInventory, canLenders, dealPipeline, financeNotices, inventoryAlerts, isVisible]
  );
  const salesSignals = React.useMemo(
    () =>
      buildSalesSignals({
        customerTasks: canCustomers || canCrm ? customerTasks : [],
        appointments: canCrm ? appointments : [],
        dealPipeline: canDeals ? dealPipeline : [],
      }),
    [appointments, canCrm, canCustomers, canDeals, customerTasks, dealPipeline]
  );
  const opsSignals = React.useMemo(
    () =>
      buildOpsSignals({
        inventoryAlerts: canInventory ? inventoryAlerts : [],
        financeNotices: canLenders ? financeNotices : [],
        dealPipeline: canDeals ? dealPipeline : [],
        opsQueues: canDeals
          ? opsQueues
          : {
              titleQueueCount: 0,
              titleQueueOldestAgeDays: null,
              deliveryQueueCount: 0,
              deliveryQueueOldestAgeDays: null,
              fundingQueueCount: 0,
              fundingQueueOldestAgeDays: null,
            },
      }),
    [canDeals, canInventory, canLenders, dealPipeline, financeNotices, inventoryAlerts, opsQueues]
  );
  const agendaItems = React.useMemo(
    () =>
      buildAgendaItems({
        customerTasks: canCustomers || canCrm ? customerTasks : [],
        appointments: canCrm ? appointments : [],
        dealPipeline: canDeals ? dealPipeline : [],
      }),
    [appointments, canCrm, canCustomers, canDeals, customerTasks, dealPipeline]
  );
  const floorplanUtilization = React.useMemo(() => getFloorplanUtilizationPercent(initialData), [initialData]);
  const generatedAtLabel = formatGeneratedAt(dashboardGeneratedAt);
  const summaryGrossProfit = canDeals ? metrics.grossProfitCents : null;
  const summaryGrossProfitDelta = canDeals ? metrics.grossProfitDelta7dCents ?? 0 : null;
  const summaryFrontGrossProfit = canDeals ? metrics.frontGrossProfitCents : null;
  const summaryBackGrossProfit = canDeals ? metrics.backGrossProfitCents : null;
  const summaryOpenPipeline = canDeals ? getOpenPipelineCount(dealStageCounts) : null;
  const summaryDemandPressure = canCustomers || canCrm ? sumCounts(customerTasks) : null;
  const summaryFloorplanUtilization = canLenders ? floorplanUtilization : null;
  const summaryFundedCount = canDeals ? dealStageCounts?.funded ?? 0 : null;
  const summaryAppointmentsCount = canCrm ? appointments.length : null;
  const summaryInventoryBlockerCount = canInventory
    ? inventoryAlerts.filter((row) => row.severity === "warning" || row.severity === "danger").length
    : null;
  const summaryTitleQueueCount = canDeals ? opsQueues.titleQueueCount : null;
  const summaryTitleQueueOldestAgeDays = canDeals ? opsQueues.titleQueueOldestAgeDays : null;
  const summaryDeliveryQueueCount = canDeals ? opsQueues.deliveryQueueCount : null;
  const summaryDeliveryQueueOldestAgeDays = canDeals ? opsQueues.deliveryQueueOldestAgeDays : null;
  const summaryFundingQueueCount = canDeals ? opsQueues.fundingQueueCount : null;
  const summaryFundingQueueOldestAgeDays = canDeals ? opsQueues.fundingQueueOldestAgeDays : null;

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(guidanceStorageKey);
      setShowSectionGuidance(stored !== "hidden");
    } catch {
      setShowSectionGuidance(true);
    }
  }, [guidanceStorageKey]);

  React.useEffect(() => {
    if (hasExplicitPreset) return;
    try {
      const storedPreset = window.localStorage.getItem(presetStorageKey);
      if (!storedPreset) return;
      const savedPreset = getDashboardPreset(storedPreset);
      if (savedPreset === preset) return;
      const params = new URLSearchParams(searchParams.toString());
      if (savedPreset === "gm") {
        params.delete("preset");
      } else {
        params.set("preset", savedPreset);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    } catch {
      // Ignore preset persistence failures; the route can still use its default preset.
    }
  }, [hasExplicitPreset, pathname, preset, presetStorageKey, router, searchParams]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(presetStorageKey, preset);
    } catch {
      // Ignore local persistence failures; session view can still switch presets.
    }
  }, [preset, presetStorageKey]);

  const dismissSectionGuidance = React.useCallback(() => {
    setShowSectionGuidance(false);
    try {
      window.localStorage.setItem(guidanceStorageKey, "hidden");
    } catch {
      // Ignore local persistence failures; session view can still hide guidance.
    }
  }, [guidanceStorageKey]);

  const restoreSectionGuidance = React.useCallback(() => {
    setShowSectionGuidance(true);
    try {
      window.localStorage.removeItem(guidanceStorageKey);
    } catch {
      // Ignore local persistence failures; session view can still show guidance.
    }
  }, [guidanceStorageKey]);

  const setPreset = React.useCallback(
    (nextPreset: DashboardPreset) => {
      try {
        window.localStorage.setItem(presetStorageKey, nextPreset);
      } catch {
        // Ignore local persistence failures; route switching should still work.
      }
      const params = new URLSearchParams(searchParams.toString());
      if (nextPreset === "gm") {
        params.delete("preset");
      } else {
        params.set("preset", nextPreset);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, presetStorageKey, router, searchParams]
  );

  const presetMeta = DASHBOARD_PRESET_META[preset];

  return (
    <PageShell
      fullWidth
      className="space-y-5"
      contentClassName="w-full px-3 sm:px-4 lg:px-6 2xl:px-8 min-[1800px]:px-10 min-[2200px]:px-12"
    >
      <PageHeader
        title={
          showSectionGuidance ? (
            <div className="space-y-2">
              <SectionEyebrow>{presetMeta.eyebrow}</SectionEyebrow>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[var(--text)] min-[1800px]:text-[36px]">
                  {presetMeta.title}
                </h1>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)]">
                  Live role-weighted dashboard
                </span>
                {presetMeta.badge ? (
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      presetMeta.badge.tone === "accent"
                        ? "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]"
                        : presetMeta.badge.tone === "warning"
                          ? "border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]"
                          : "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]"
                    )}
                  >
                    {presetMeta.badge.label}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[var(--text)] min-[1800px]:text-[36px]">
              {presetMeta.title}
            </h1>
          )
        }
        description={
          showSectionGuidance ? (
            <span className="block max-w-[78ch]">
              {presetMeta.description}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 p-1">
              <button
                type="button"
                onClick={() => setPreset("gm")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === "gm"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted-text)] hover:bg-[var(--surface-2)]"
                )}
              >
                GM
              </button>
              <button
                type="button"
                onClick={() => setPreset("sales")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === "sales"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted-text)] hover:bg-[var(--surface-2)]"
                )}
              >
                Sales
              </button>
              <button
                type="button"
                onClick={() => setPreset("ops")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === "ops"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted-text)] hover:bg-[var(--surface-2)]"
                )}
              >
                Ops
              </button>
            </div>
            {showSectionGuidance ? (
              <button
                type="button"
                onClick={dismissSectionGuidance}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-2)]"
              >
                Hide walkthrough
              </button>
            ) : (
              <button
                type="button"
                onClick={restoreSectionGuidance}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-2)]"
              >
                Show walkthrough again
              </button>
            )}
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              Last refresh {generatedAtLabel}
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              Role presets share one live payload
            </div>
          </div>
        }
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-3 md:grid-cols-2 min-[1800px]:gap-4",
          preset === "sales"
            ? "xl:grid-cols-6 min-[1600px]:grid-cols-6 min-[2000px]:grid-cols-7"
            : preset === "ops"
              ? "xl:grid-cols-6 min-[1600px]:grid-cols-6 min-[2000px]:grid-cols-7"
            : "xl:grid-cols-5 min-[1600px]:grid-cols-6 min-[2000px]:grid-cols-7"
        )}
      >
        {preset === "gm" ? (
          <>
            {canInventory && isVisible("metrics-inventory") ? (
              <MetricCard
                title="Inventory"
                value={metrics.inventoryCount}
                delta7d={metrics.inventoryDelta7d}
                delta30d={metrics.inventoryDelta30d}
                trend={metrics.inventoryTrend}
                href="/inventory"
                color="green"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {canDeals && isVisible("metrics-deals") ? (
              <MetricCard
                title="Active Deals"
                value={metrics.dealsCount}
                delta7d={metrics.dealsDelta7d}
                delta30d={metrics.dealsDelta30d}
                trend={metrics.dealsTrend}
                href="/deals"
                color="blue"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {canCrm && isVisible("metrics-leads") ? (
              <MetricCard
                title="New Leads"
                value={metrics.leadsCount}
                delta7d={metrics.leadsDelta7d}
                delta30d={metrics.leadsDelta30d}
                trend={metrics.leadsTrend}
                href="/crm/opportunities"
                color="violet"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {canDeals && isVisible("metrics-bhph") ? (
              <MetricCard
                title="Gross Profit"
                value={0}
                valueDisplay={formatCompactCurrencyFromCents(summaryGrossProfit)}
                delta7d={null}
                delta30d={null}
                deltaLabel={
                  summaryGrossProfitDelta == null ? (
                    "Realized gross hidden"
                  ) : (
                    <>
                      <span
                        className={
                          summaryGrossProfitDelta >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"
                        }
                      >
                        {summaryGrossProfitDelta >= 0 ? "+" : "-"}
                        {formatCompactCurrencyFromCents(Math.abs(summaryGrossProfitDelta))}
                      </span>
                      {" vs yesterday"}
                    </>
                  )
                }
                trend={metrics.grossProfitTrend}
                href="/deals"
                color="amber"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            <MetricCard
              title="Ops Score"
              value={operationsScore}
              valueSuffix="%"
              sub={
                <>
                  <span className={unresolvedOpsCount === 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                    {unresolvedOpsCount}
                  </span>
                  {" unresolved blockers"}
                </>
              }
              trend={metrics.opsTrend}
              href="/dashboard"
              color="cyan"
              refreshKey={refreshToken}
              className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
            />
            {summaryOpenPipeline != null ? (
              <div className="hidden min-[1600px]:block">
                <MetricCard
                  title="Open Pipeline"
                  value={summaryOpenPipeline}
                  sub={
                    <>
                      <span className="text-[var(--accent)]">{summaryFundedCount ?? 0}</span>
                      {" funded"}
                    </>
                  }
                  trend={metrics.dealsTrend}
                  href="/deals"
                  color="blue"
                  refreshKey={refreshToken}
                  className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
                />
              </div>
            ) : null}
            {summaryDemandPressure != null ? (
              <div className="hidden min-[2000px]:block">
                <MetricCard
                  title="Demand Pressure"
                  value={summaryDemandPressure}
                  sub={
                    <>
                      <span className={summaryAppointmentsCount && summaryAppointmentsCount > 0 ? "text-[var(--accent)]" : "text-[var(--text-soft)]"}>
                        {summaryAppointmentsCount ?? 0}
                      </span>
                      {" upcoming appointments"}
                    </>
                  }
                  trend={metrics.leadsTrend}
                  href="/customers"
                  color="violet"
                  refreshKey={refreshToken}
                  className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
                />
              </div>
            ) : null}
          </>
        ) : preset === "sales" ? (
          <>
            {canCrm && isVisible("metrics-leads") ? (
              <MetricCard
                title="New Leads"
                value={metrics.leadsCount}
                delta7d={metrics.leadsDelta7d}
                delta30d={metrics.leadsDelta30d}
                trend={metrics.leadsTrend}
                href="/crm/opportunities"
                color="violet"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryDemandPressure != null ? (
              <MetricCard
                title="Demand Pressure"
                value={summaryDemandPressure}
                sub={
                  <>
                    <span className={summaryAppointmentsCount && summaryAppointmentsCount > 0 ? "text-[var(--accent)]" : "text-[var(--text-soft)]"}>
                      {summaryAppointmentsCount ?? 0}
                    </span>
                    {" upcoming appointments"}
                  </>
                }
                trend={metrics.leadsTrend}
                href="/customers"
                color="violet"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryAppointmentsCount != null ? (
              <MetricCard
                title="Appointments"
                value={summaryAppointmentsCount}
                sub="On deck"
                trend={metrics.leadsTrend}
                href="/customers"
                color="cyan"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {canDeals && isVisible("metrics-deals") ? (
              <MetricCard
                title="Active Deals"
                value={metrics.dealsCount}
                delta7d={metrics.dealsDelta7d}
                delta30d={metrics.dealsDelta30d}
                trend={metrics.dealsTrend}
                href="/deals"
                color="blue"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryOpenPipeline != null ? (
              <MetricCard
                title="Open Pipeline"
                value={summaryOpenPipeline}
                sub={
                  <>
                    <span className="text-[var(--accent)]">{summaryFundedCount ?? 0}</span>
                    {" funded"}
                  </>
                }
                trend={metrics.dealsTrend}
                href="/deals"
                color="blue"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            <MetricCard
              title="Sales Health"
              value={operationsScore}
              valueSuffix="%"
              sub={
                <>
                  <span className={unresolvedOpsCount === 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                    {unresolvedOpsCount}
                  </span>
                  {" blocker signals"}
                </>
              }
              trend={metrics.opsTrend}
              href="/dashboard"
              color="cyan"
              refreshKey={refreshToken}
              className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
            />
            {canInventory && isVisible("metrics-inventory") ? (
              <div className="hidden min-[2000px]:block">
                <MetricCard
                  title="Inventory Context"
                  value={metrics.inventoryCount}
                  delta7d={metrics.inventoryDelta7d}
                  delta30d={metrics.inventoryDelta30d}
                  trend={metrics.inventoryTrend}
                  href="/inventory"
                  color="green"
                  refreshKey={refreshToken}
                  className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <MetricCard
              title="Ops Score"
              value={operationsScore}
              valueSuffix="%"
              sub={
                <>
                  <span className={unresolvedOpsCount === 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                    {unresolvedOpsCount}
                  </span>
                  {" blocker signals"}
                </>
              }
              trend={metrics.opsTrend}
              href="/dashboard"
              color="cyan"
              refreshKey={refreshToken}
              className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
            />
            {canInventory && isVisible("metrics-inventory") ? (
              <MetricCard
                title="Inventory"
                value={metrics.inventoryCount}
                delta7d={metrics.inventoryDelta7d}
                delta30d={metrics.inventoryDelta30d}
                trend={metrics.inventoryTrend}
                href="/inventory"
                color="green"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            <MetricCard
              title="Blockers"
              value={unresolvedOpsCount}
              sub={summaryInventoryBlockerCount != null ? `${summaryInventoryBlockerCount} inventory rows` : "Queue pressure"}
              trend={metrics.opsTrend}
              href="/dashboard"
              color="amber"
              refreshKey={refreshToken}
              className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
            />
            {summaryFundingQueueCount != null ? (
              <MetricCard
                title="Funding Queue"
                value={summaryFundingQueueCount}
                sub="Awaiting funding completion"
                trend={metrics.dealsTrend}
                href="/deals/funding"
                color="amber"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryOpenPipeline != null ? (
              <MetricCard
                title="Open Pipeline"
                value={summaryOpenPipeline}
                sub={
                  <>
                    <span className="text-[var(--accent)]">{summaryFundedCount ?? 0}</span>
                    {" funded"}
                  </>
                }
                trend={metrics.dealsTrend}
                href="/deals"
                color="blue"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryTitleQueueCount != null ? (
              <MetricCard
                title="Title Queue"
                value={summaryTitleQueueCount}
                sub="DMV and title follow-through"
                trend={metrics.dealsTrend}
                href="/deals/title"
                color="violet"
                refreshKey={refreshToken}
                className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
              />
            ) : null}
            {summaryDeliveryQueueCount != null ? (
              <div className="hidden min-[2000px]:block">
                <MetricCard
                  title="Delivery Queue"
                  value={summaryDeliveryQueueCount}
                  sub="Ready for delivery"
                  trend={metrics.dealsTrend}
                  href="/deals/delivery"
                  color="cyan"
                  refreshKey={refreshToken}
                  className="min-h-[116px] overflow-hidden min-[1800px]:min-h-[124px]"
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {preset === "gm" ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.7fr)_minmax(420px,0.9fr)] min-[2200px]:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.72fr)_minmax(340px,0.68fr)]">
            <div className="xl:col-span-8 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Executive summary"
                  title="Health, risk, and attention"
                  detail="This top section is optimized for the first five seconds of a GM review: health score, blocker count, current momentum, and what demands intervention next."
                  meta={
                    <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                      Executive first-read
                    </div>
                  }
                />
              ) : null}
              <ExecutiveSummaryCard
                grossProfitDeltaCents={summaryGrossProfitDelta}
                grossProfitFrontCents={summaryFrontGrossProfit}
                grossProfitBackCents={summaryBackGrossProfit}
                openPipeline={summaryOpenPipeline}
                demandPressure={summaryDemandPressure}
                floorplanUtilization={summaryFloorplanUtilization}
                unresolvedOpsCount={unresolvedOpsCount}
                operationsScore={operationsScore}
                generatedAtLabel={generatedAtLabel}
                agendaItems={agendaItems}
              />
            </div>
            <div className="xl:col-span-4 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Exception rail"
                  title="Escalations"
                  detail="The right rail is intentionally reserved for high-urgency queues so blockers are not lost inside general-purpose widgets."
                />
              ) : null}
              <ExecutiveExceptionsCard signals={executiveSignals} />
            </div>
            <div className="hidden min-[2200px]:block">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Owner agenda"
                  title="Immediate actions"
                  detail="On ultra-wide layouts the owner agenda is promoted into the first viewport to keep accountability visible beside exceptions."
                />
              ) : null}
              {isVisible("recommended-actions") || isVisible("customer-tasks") ? (
                <OwnerAgendaCard agendaItems={agendaItems} />
              ) : (
                <Widget
                  title="Activity and accountability"
                  subtitle="Owner agenda is unavailable for your current visibility settings."
                  className="h-full"
                >
                  <p className="text-sm text-[var(--muted-text)]">
                    Enable recommended actions or customer tasks to surface the owner agenda.
                  </p>
                </Widget>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.25fr)_minmax(460px,0.95fr)]">
            <div className="xl:col-span-7 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Revenue"
                  title="Pipeline pressure"
                  detail="Keep desk-stage movement and downstream blockage in one band so finance and sales can share the same revenue picture."
                />
              ) : null}
              {canDeals && isVisible("deal-pipeline") ? (
                <PipelineOverviewCard rows={dealPipeline} stageCounts={dealStageCounts} />
              ) : (
                <Widget
                  title="Revenue and pipeline"
                  subtitle="Deal visibility is unavailable for your current permissions."
                  className="h-full"
                >
                  <p className="text-sm text-[var(--muted-text)]">Pipeline detail requires deals access.</p>
                </Widget>
              )}
            </div>
            <div className="xl:col-span-5 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Demand"
                  title="Customer flow"
                  detail="This zone pairs appointments and follow-up pressure so lead momentum is visible without opening CRM subpages."
                />
              ) : null}
              {((canCrm && isVisible("upcoming-appointments")) || ((canCustomers || canCrm) && isVisible("customer-tasks"))) ? (
                <DemandPanel appointments={canCrm ? appointments : []} customerTasks={canCustomers || canCrm ? customerTasks : []} />
              ) : (
                <Widget title="Customer demand" subtitle="CRM visibility is unavailable for your current permissions." className="h-full">
                  <p className="text-sm text-[var(--muted-text)]">Appointments and follow-up queues require CRM or customer access.</p>
                </Widget>
              )}
            </div>
          </div>
        </>
      ) : preset === "sales" ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.28fr)_minmax(460px,0.94fr)] min-[2200px]:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.72fr)_minmax(360px,0.72fr)]">
            <div className="xl:col-span-7 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Sales summary"
                  title="Lead flow and rep attention"
                  detail="The first sales read focuses on demand movement, appointments, and which queue needs follow-up today."
                  meta={
                    <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                      Sales first-read
                    </div>
                  }
                />
              ) : null}
              <SalesSummaryCard
                leadsCount={metrics.leadsCount}
                leadsDelta={canCrm ? metrics.leadsDelta7d ?? 0 : null}
                demandPressure={summaryDemandPressure}
                appointmentsCount={summaryAppointmentsCount}
                openPipeline={summaryOpenPipeline}
                fundedCount={summaryFundedCount}
                topCloserName={canDeals ? salesManager.topCloserName : null}
                topCloserDealsClosed={canDeals ? salesManager.topCloserDealsClosed : 0}
                topGrossRepName={canDeals ? salesManager.topGrossRepName : null}
                topGrossRepCents={canDeals ? salesManager.topGrossRepCents : 0}
                averageGrossPerDealCents={canDeals ? salesManager.averageGrossPerDealCents : 0}
                rankedRepCount={canDeals ? salesManager.rankedRepCount : 0}
                staleLeadCount={canCustomers || canCrm ? salesManager.staleLeadCount : 0}
                oldestStaleLeadAgeDays={canCustomers || canCrm ? salesManager.oldestStaleLeadAgeDays : null}
                overdueFollowUpCount={canCustomers || canCrm ? salesManager.overdueFollowUpCount : 0}
                appointmentsSetToday={canCrm ? salesManager.appointmentsSetToday : 0}
                callbacksScheduledToday={canCrm ? salesManager.callbacksScheduledToday : 0}
                rangeLabel={salesManager.rangeLabel}
                generatedAtLabel={generatedAtLabel}
                agendaItems={agendaItems}
              />
            </div>
            <div className="xl:col-span-5 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Demand"
                  title="Appointments and follow-up"
                  detail="This panel stays high in the sales preset so the team sees customer momentum before deeper operational context."
                />
              ) : null}
              {((canCrm && isVisible("upcoming-appointments")) || ((canCustomers || canCrm) && isVisible("customer-tasks"))) ? (
                <DemandPanel appointments={canCrm ? appointments : []} customerTasks={canCustomers || canCrm ? customerTasks : []} />
              ) : (
                <Widget title="Customer demand" subtitle="CRM visibility is unavailable for your current permissions." className="h-full">
                  <p className="text-sm text-[var(--muted-text)]">Appointments and follow-up queues require CRM or customer access.</p>
                </Widget>
              )}
            </div>
            <div className="hidden min-[2200px]:block">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Sales focus"
                  title="Rep action rail"
                  detail="On ultra-wide layouts the sales action rail is promoted into the first viewport for immediate coaching and follow-up focus."
                />
              ) : null}
              <AgendaRail
                title="Rep focus and follow-up"
                subtitle="Top demand and deal queues that should be driven by the sales team today."
                emptyTitle="No urgent sales queues"
                emptyDescription="Lead, follow-up, and deal pressure are currently under control."
                agendaItems={agendaItems}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.88fr)]">
            <div className="xl:col-span-7 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Revenue"
                  title="Pipeline movement"
                  detail="Keep active deal pressure near the top so sales can move structured and approved deals without digging through ops context."
                />
              ) : null}
              {canDeals && isVisible("deal-pipeline") ? (
                <PipelineOverviewCard rows={dealPipeline} stageCounts={dealStageCounts} />
              ) : (
                <Widget title="Revenue and pipeline" subtitle="Deal visibility is unavailable for your current permissions." className="h-full">
                  <p className="text-sm text-[var(--muted-text)]">Pipeline detail requires deals access.</p>
                </Widget>
              )}
            </div>
            <div className="xl:col-span-5 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Sales exceptions"
                  title="Queues that need intervention"
                  detail="This right rail prioritizes stalled follow-up, appointment load, and deal pressure instead of broader executive blocker aggregation."
                />
              ) : null}
              <ExceptionRail
                title="Sales exceptions"
                subtitle="Surface the customer and deal queues that need manager intervention before they slip out of cadence."
                emptyTitle="No urgent sales exceptions"
                emptyDescription="Lead, appointment, and deal queues are currently within normal range."
                signals={salesSignals}
                collapsible
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.38fr)_minmax(440px,0.9fr)] min-[2200px]:grid-cols-[minmax(0,1.22fr)_minmax(390px,0.74fr)_minmax(350px,0.7fr)]">
            <div className="xl:col-span-7 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Ops summary"
                  title="Blockers, throughput, and clearance"
                  detail="The first ops read is tuned for desk and operations users: blocker count, finance pressure, inventory readiness, and active completion flow."
                  meta={
                    <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                      Ops first-read
                    </div>
                  }
                />
              ) : null}
              <OpsSummaryCard
                operationsScore={operationsScore}
                unresolvedOpsCount={unresolvedOpsCount}
                titleQueueCount={summaryTitleQueueCount}
                titleQueueOldestAgeDays={summaryTitleQueueOldestAgeDays}
                deliveryQueueCount={summaryDeliveryQueueCount}
                deliveryQueueOldestAgeDays={summaryDeliveryQueueOldestAgeDays}
                fundingQueueCount={summaryFundingQueueCount}
                fundingQueueOldestAgeDays={summaryFundingQueueOldestAgeDays}
                openPipeline={summaryOpenPipeline}
                generatedAtLabel={generatedAtLabel}
                prioritySignal={opsSignals[0] ?? null}
              />
            </div>
            <div className="xl:col-span-5 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Ops exceptions"
                  title="Desk queues that need clearing"
                  detail="This rail keeps finance notices, inventory blockers, and deal-stage friction visible before the user drops into list views."
                />
              ) : null}
              <ExceptionRail
                title="Ops exceptions"
                subtitle="Surface the inventory, finance, and desk queues that need operational intervention before they slow delivery and funding."
                emptyTitle="No urgent ops exceptions"
                emptyDescription="Finance notices, inventory blockers, and desk queues are currently under control."
                signals={opsSignals}
                collapsible
              />
            </div>
            <div className="hidden min-[2200px]:block">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Desk action rail"
                  title="Immediate operational focus"
                  detail="On ultra-wide layouts the ops action rail is promoted into the first viewport to keep queue clearance visible beside blockers."
                />
              ) : null}
              <AgendaRail
                title="Desk focus and queue clearance"
                subtitle="Top queues that should be cleared by operations, desk, and funding teams today."
                emptyTitle="No urgent desk queues"
                emptyDescription="Current inventory, finance, and deal queues are within normal range."
                agendaItems={agendaItems}
                collapsible
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.24fr)_minmax(400px,0.82fr)]">
            <div className="xl:col-span-7 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Revenue throughput"
                  title="Desk movement and completion"
                  detail="Keep stage movement and downstream completion pressure high in the ops preset so structured, approved, and contracted work keeps moving."
                />
              ) : null}
              {canDeals && isVisible("deal-pipeline") ? (
                <PipelineOverviewCard rows={dealPipeline} stageCounts={dealStageCounts} />
              ) : (
                <Widget title="Revenue and pipeline" subtitle="Deal visibility is unavailable for your current permissions." className="h-full">
                  <p className="text-sm text-[var(--muted-text)]">Pipeline detail requires deals access.</p>
                </Widget>
              )}
            </div>
            <div className="xl:col-span-5 min-[1800px]:col-span-1">
              {showSectionGuidance ? (
                <SectionIntro
                  eyebrow="Customer handoff"
                  title="Appointments and follow-up context"
                  detail="Demand context stays visible in the ops preset so handoff risk is clear, but it sits behind blocker and throughput visibility."
                />
              ) : null}
              {((canCrm && isVisible("upcoming-appointments")) || ((canCustomers || canCrm) && isVisible("customer-tasks"))) ? (
                <DemandPanel appointments={canCrm ? appointments : []} customerTasks={canCustomers || canCrm ? customerTasks : []} />
              ) : (
                <Widget title="Customer demand" subtitle="CRM visibility is unavailable for your current permissions." className="h-full">
                  <p className="text-sm text-[var(--muted-text)]">Appointments and follow-up queues require CRM or customer access.</p>
                </Widget>
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(0,1.6fr)_minmax(380px,0.72fr)]">
        <div className="xl:col-span-8 min-[1800px]:col-span-1">
          {showSectionGuidance ? (
            <SectionIntro
              eyebrow="Inventory command"
              title="Inventory workbench"
              detail="The live list stays as the operational heart of the dashboard, with signals and acquisition context adjacent instead of replacing the workbench."
            />
          ) : null}
          {(canInventory && isVisible("quick-actions")) || isVisible("inventory-alerts") ? (
            <InventoryWorkbenchCard
              canReadInventory={canInventory}
              canAddVehicle={canWriteInventory}
              canAddLead={canWriteCustomers}
              canStartDeal={canWriteDeals}
              refreshToken={refreshToken}
            />
          ) : (
            <Widget title="Inventory command view" subtitle="Inventory workbench is unavailable for your current permissions.">
              <p className="text-sm text-[var(--muted-text)]">Inventory read access is required to show the command view.</p>
            </Widget>
          )}
        </div>
        <div className="space-y-4 xl:col-span-4 min-[1800px]:col-span-1">
          {showSectionGuidance ? (
            <SectionIntro
              eyebrow="Inventory context"
              title="Signals and acquisition"
              detail="Keep the operational blockers and acquisition opportunity lens beside the live inventory surface."
            />
          ) : null}
          {canInventory && isVisible("inventory-alerts") ? <InventorySignalListCard rows={inventoryAlerts} /> : null}
          {canAcquisitionRead ? (
            <AcquisitionInsightsCard refreshToken={refreshToken} canRead={canAcquisitionRead} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 min-[1800px]:grid-cols-[minmax(320px,0.85fr)_minmax(360px,0.95fr)_minmax(360px,0.95fr)] min-[2200px]:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
        <div className="xl:col-span-4 min-[1800px]:col-span-1">
          {showSectionGuidance ? (
            <SectionIntro
              eyebrow="Capital"
              title="Floorplan context"
              detail="Preserve lender visibility as a separate capital lens rather than burying it in generic operational cards."
            />
          ) : null}
          {canLenders && isVisible("floorplan-lending") ? (
            <FloorplanLendingCard floorplan={floorplan} />
          ) : (
            <Widget title="Capital and floorplan" subtitle="Lender and capital visibility is unavailable for your current permissions." className="h-full">
              <p className="text-sm text-[var(--muted-text)]">Floorplan lines appear here when lender access is available.</p>
            </Widget>
          )}
        </div>
        <div className="xl:col-span-4 min-[1800px]:col-span-1">
          {showSectionGuidance ? (
            <SectionIntro
              eyebrow="Recent changes"
              title="Material changes across the dealership"
              detail="This feed turns recent deal movement, inventory edits, and customer activity into a real dashboard rail instead of a documented future state."
            />
          ) : null}
          <MaterialChangesCard items={materialChanges} />
        </div>
        <div className="xl:col-span-4 min-[1800px]:col-span-1 min-[2200px]:hidden">
          {showSectionGuidance ? (
            <SectionIntro
              eyebrow={preset === "sales" ? "Sales action rail" : preset === "ops" ? "Desk action rail" : "Accountability"}
              title={preset === "sales" ? "Rep focus and follow-up" : preset === "ops" ? "Desk focus and queue clearance" : "Owner agenda"}
              detail={
                preset === "sales"
                  ? "This stays lower on standard desktop and moves into the first viewport on ultra-wide, keeping rep action visible without crowding the demand-first top rows."
                  : preset === "ops"
                    ? "This stays lower on standard desktop and moves into the first viewport on ultra-wide, keeping desk queue clearance visible without crowding blocker-first top rows."
                  : "This stays in the lower layout on standard desktop and moves up on ultra-wide where there is room to keep it in the first screenful."
              }
            />
          ) : null}
          {isVisible("recommended-actions") || isVisible("customer-tasks") ? (
            preset === "sales" ? (
              <AgendaRail
                title="Rep focus and follow-up"
                subtitle="Top demand and deal queues that should be driven by the sales team today."
                emptyTitle="No urgent sales queues"
                emptyDescription="Lead, follow-up, and deal pressure are currently under control."
                agendaItems={agendaItems}
                collapsible
              />
            ) : preset === "ops" ? (
              <AgendaRail
                title="Desk focus and queue clearance"
                subtitle="Top queues that should be cleared by operations, desk, and funding teams today."
                emptyTitle="No urgent desk queues"
                emptyDescription="Current inventory, finance, and deal queues are within normal range."
                agendaItems={agendaItems}
                collapsible
              />
            ) : (
              <OwnerAgendaCard agendaItems={agendaItems} />
            )
          ) : (
            <Widget
              title={preset === "sales" ? "Rep focus and follow-up" : preset === "ops" ? "Desk focus and queue clearance" : "Activity and accountability"}
              subtitle={
                preset === "sales"
                  ? "Sales action rail is unavailable for your current visibility settings."
                  : preset === "ops"
                    ? "Desk action rail is unavailable for your current visibility settings."
                  : "Owner agenda is unavailable for your current visibility settings."
              }
              className="h-full"
            >
              <p className="text-sm text-[var(--muted-text)]">
                {preset === "sales"
                  ? "Enable recommended actions or customer tasks to surface the sales action rail."
                  : preset === "ops"
                    ? "Enable recommended actions or customer tasks to surface the desk action rail."
                  : "Enable recommended actions or customer tasks to surface the owner agenda."}
              </p>
            </Widget>
          )}
        </div>
      </div>

      {layout.length > 0 ? (
        <DashboardCustomizePanel open={customizeOpen} onOpenChange={setCustomizeOpen} layout={layout} />
      ) : null}
    </PageShell>
  );
}
