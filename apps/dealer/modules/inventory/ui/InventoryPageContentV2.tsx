"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { typography } from "@/lib/ui/tokens";
import { VehicleInventoryTable } from "./components/VehicleInventoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Widget } from "@/components/ui-system/widgets/Widget";
import type { InventoryPageOverview } from "@/modules/inventory/service/inventory-page";
import { buildQueryString } from "@/lib/url/buildQueryString";
import { apiFetch } from "@/lib/client/http";
import { formatCents } from "@/lib/money";
import { VEHICLE_STATUS_OPTIONS } from "./types";
import { AlertTriangle, CheckCircle, Handshake, Image } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type InventoryPageContentV2Props = {
  initialData: InventoryPageOverview;
  /** Current query used for pagination/filter URLs. */
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
};

type BulkImportJobItem = {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number | null;
  createdAt: string;
  completedAt: string | null;
};

type InventoryHeroCardProps = {
  label: string;
  value: string;
  detail: string;
  accentClassName: string;
};

function InventoryHeroCard({
  label,
  value,
  detail,
  accentClassName,
}: InventoryHeroCardProps) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div className={cn("absolute inset-x-0 bottom-0 h-px opacity-90", accentClassName)} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</p>
      <div className="mt-2 text-[42px] font-bold leading-none tracking-[-0.03em] text-[var(--text)] tabular-nums">
        {value}
      </div>
      <p className="mt-2 text-sm text-[var(--muted-text)]">{detail}</p>
    </section>
  );
}

type InventoryLensProps = {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "warning" | "info";
};

function InventoryLens({
  icon: Icon,
  label,
  value,
  detail,
  tone = "info",
}: InventoryLensProps) {
  const toneClasses =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : "text-sky-400";

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/80">
            <Icon className={cn("h-4.5 w-4.5", toneClasses)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-[var(--text)]">{label}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
              Inventory decision lens
            </p>
          </div>
        </div>
        <div className="shrink-0 text-[34px] font-bold leading-none tracking-[-0.03em] text-[var(--text)] tabular-nums">
          {value}
        </div>
      </div>
      <p className="mt-5 text-sm leading-7 text-[var(--muted-text)]">{detail}</p>
    </div>
  );
}

type InventorySignal = {
  id: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  severity: "success" | "warning" | "danger" | "info";
};

function InventoryExceptionsRail({ signals }: { signals: InventorySignal[] }) {
  return (
    <Widget
      title="Inventory exceptions"
      subtitle="Surface the lot blockers, aging units, and handoff queues that need action before they disappear under list work."
      className="h-full"
    >
      <div className="space-y-2.5">
        {signals.length === 0 ? (
          <div className="rounded-[22px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/80">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-[var(--text)]">No urgent inventory exceptions</p>
                <p className="text-sm leading-7 text-[var(--muted-text)]">
                  Recon, aging, merchandising, and funding handoff queues are currently under control.
                </p>
              </div>
            </div>
          </div>
        ) : (
          signals.map((signal) => {
            const toneClass =
              signal.severity === "danger"
                ? "text-red-400"
                : signal.severity === "warning"
                  ? "text-amber-400"
                  : signal.severity === "success"
                    ? "text-emerald-400"
                    : "text-sky-400";
            return (
              <Link
                key={signal.id}
                href={signal.href}
                className="flex items-start justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-4 transition-colors hover:bg-[var(--surface-2)]/80"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{signal.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">{signal.detail}</p>
                </div>
                <div className={cn("shrink-0 text-2xl font-bold tabular-nums", toneClass)}>{signal.count}</div>
              </Link>
            );
          })
        )}
      </div>
    </Widget>
  );
}

function InventoryFlowPanel({
  pipeline,
  filterChips,
}: {
  pipeline: InventoryPageOverview["pipeline"];
  filterChips: InventoryPageOverview["filterChips"];
}) {
  const items = [
    { label: "Leads", count: pipeline.leads, detail: "Inventory-sourced demand waiting to be worked." },
    { label: "Appointments", count: pipeline.appointments, detail: "Upcoming lot conversations and test-drive pressure." },
    { label: "Working deals", count: pipeline.workingDeals, detail: "Deals actively moving against current inventory." },
    { label: "Pending funding", count: pipeline.pendingFunding, detail: "Deal completion pressure still tied to inventory." },
    { label: "Sold today", count: pipeline.soldToday, detail: "Units converted into closed business today." },
  ];

  return (
    <Widget
      title="Demand and handoff"
      subtitle="Keep lead flow, deal handoff, and inventory-specific pressure visible in one place."
      className="h-full"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[22px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{item.label}</p>
            <p className="mt-2 text-[30px] font-bold leading-none tracking-[-0.03em] text-[var(--text)] tabular-nums">
              {item.count}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">{item.detail}</p>
          </div>
        ))}
        <div className="rounded-[22px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] p-4 sm:col-span-2 xl:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Inventory context</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              Floor planned {filterChips.floorPlannedCount}
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              Previously sold {filterChips.previouslySoldCount}
            </span>
          </div>
        </div>
      </div>
    </Widget>
  );
}

function InventoryHealthPanel({
  health,
}: {
  health: InventoryPageOverview["health"];
}) {
  const total = health.lt30 + health.d30to60 + health.d60to90 + health.gt90;
  const rows = [
    { label: "<30 days", count: health.lt30, tone: "bg-emerald-400" },
    { label: "30-60 days", count: health.d30to60, tone: "bg-sky-400" },
    { label: "60-90 days", count: health.d60to90, tone: "bg-amber-400" },
    { label: ">90 days", count: health.gt90, tone: "bg-red-400" },
  ];

  return (
    <Widget
      title="Lot health and age distribution"
      subtitle="The live list stays canonical, but aging and merchandising pressure should be legible before you start row work."
      className="h-full"
    >
      <div className="space-y-4">
        {rows.map((row) => {
          const width = total === 0 ? 0 : Math.max(2, Math.round((row.count / total) * 100));
          return (
            <div key={row.label} className="flex items-center gap-4">
              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text)]">{row.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className={cn("h-full rounded-full", row.tone)} style={{ width: `${width}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--muted-text)]">
                {row.count}
              </span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

function ImportHistoryDialog({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [jobs, setJobs] = React.useState<BulkImportJobItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ data: BulkImportJobItem[]; meta: { total: number } }>(
      "/api/inventory/bulk/import?limit=10&offset=0"
    )
      .then((res) => {
        if (!cancelled) setJobs(res.data ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      contentClassName="relative z-50 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4 flex flex-col"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">Import history</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 min-h-0 border border-[var(--border)] rounded-md">
          {loading && (
            <p className="p-4 text-sm text-[var(--muted-text)]">Loading…</p>
          )}
          {error && (
            <p className="p-4 text-sm text-[var(--danger)]">{error}</p>
          )}
          {!loading && !error && jobs.length === 0 && (
            <p className="p-4 text-sm text-[var(--muted-text)]">No import jobs yet.</p>
          )}
          {!loading && !error && jobs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--surface-2)]">
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Rows</TableHead>
                  <TableHead scope="col">Created</TableHead>
                  <TableHead scope="col">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.status}</TableCell>
                    <TableCell>
                      {j.processedRows != null ? `${j.processedRows} / ${j.totalRows}` : j.totalRows}
                    </TableCell>
                    <TableCell className="text-[var(--muted-text)]">
                      {new Date(j.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-[var(--muted-text)]">
                      {j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryPageContentV2({
  initialData,
  currentQuery,
  canWrite,
}: InventoryPageContentV2Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = React.useState(false);

  const [status, setStatus] = React.useState(String(currentQuery.status ?? ""));
  const [search, setSearch] = React.useState(String(currentQuery.search ?? ""));
  const [minPriceDollars, setMinPriceDollars] = React.useState(
    currentQuery.minPrice != null ? String(Math.round(Number(currentQuery.minPrice) / 100)) : ""
  );
  const [maxPriceDollars, setMaxPriceDollars] = React.useState(
    currentQuery.maxPrice != null ? String(Math.round(Number(currentQuery.maxPrice) / 100)) : ""
  );
  const [sortBy, setSortBy] = React.useState(String(currentQuery.sortBy ?? "createdAt"));
  const [sortOrder, setSortOrder] = React.useState(String(currentQuery.sortOrder ?? "desc"));

  const buildPaginatedUrl = React.useCallback(
    (params: { page: number; pageSize: number }) => {
      const q = { ...currentQuery, page: params.page, pageSize: params.pageSize };
      const qs = buildQueryString(q);
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, currentQuery]
  );

  const pushFilters = React.useCallback((overrides: Record<string, string | number | undefined> = {}) => {
    const minCents = minPriceDollars.trim() ? Math.round(parseFloat(minPriceDollars) * 100) : undefined;
    const maxCents = maxPriceDollars.trim() ? Math.round(parseFloat(maxPriceDollars) * 100) : undefined;
    const q: Record<string, string | number | undefined> = {
      page: overrides.page !== undefined ? Number(overrides.page) : 1,
      pageSize: overrides.pageSize !== undefined ? Number(overrides.pageSize) : initialData.list.pageSize,
      sortBy: overrides.sortBy !== undefined ? String(overrides.sortBy) : sortBy,
      sortOrder: (overrides.sortOrder !== undefined ? String(overrides.sortOrder) : sortOrder) as "asc" | "desc",
    };
    const nextStatus = overrides.status !== undefined ? overrides.status : status;
    const nextSearch = overrides.search !== undefined ? overrides.search : (search.trim() || undefined);
    if (nextStatus) q.status = String(nextStatus);
    if (nextSearch) q.search = String(nextSearch);
    if (minCents != null && !Number.isNaN(minCents)) q.minPrice = minCents;
    if (maxCents != null && !Number.isNaN(maxCents)) q.maxPrice = maxCents;
    Object.assign(q, overrides);
    const qs = buildQueryString(q);
    router.push(`${pathname}?${qs}`);
    setFilterOpen(false);
  }, [initialData.list.pageSize, maxPriceDollars, minPriceDollars, pathname, router, search, sortBy, sortOrder, status]);

  const applyFilters = () => pushFilters();

  React.useEffect(() => {
    setSearch(String(currentQuery.search ?? ""));
  }, [currentQuery.search]);

  React.useEffect(() => {
    const trimmedSearch = search.trim();
    const currentSearch = String(currentQuery.search ?? "").trim();
    if (trimmedSearch === currentSearch) return;

    const timeoutId = window.setTimeout(() => {
      pushFilters({ search: trimmedSearch || undefined, page: 1 });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [search, currentQuery.search, pushFilters]);

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const sortOptions: SelectOption[] = [
    { value: "createdAt", label: "Date added" },
    { value: "salePriceCents", label: "Sale price" },
    { value: "mileage", label: "Mileage" },
    { value: "stockNumber", label: "Stock #" },
    { value: "updatedAt", label: "Last updated" },
  ];

  const totalUnits = initialData.kpis.totalUnits;
  const valueLabel =
    initialData.kpis.inventoryValueCents > 0
      ? formatCents(String(initialData.kpis.inventoryValueCents))
      : "$0";
  const avgValueLabel =
    initialData.kpis.avgValuePerVehicleCents > 0
      ? formatCents(String(initialData.kpis.avgValuePerVehicleCents))
      : "$0";
  const totalHealthUnits =
    initialData.health.lt30 + initialData.health.d30to60 + initialData.health.d60to90 + initialData.health.gt90;
  const healthyUnits = initialData.health.lt30 + initialData.health.d30to60;
  const healthScore = totalHealthUnits > 0 ? Math.round((healthyUnits / totalHealthUnits) * 100) : 100;
  const blockerCount =
    initialData.alerts.missingPhotos + initialData.alerts.needsRecon + initialData.alerts.over90Days;
  const exceptionSignals = [
    {
      id: "missing-photos",
      label: "Missing photos",
      detail: "Vehicles that still need merchandising assets before they are retail-ready.",
      count: initialData.alerts.missingPhotos,
      href: "/inventory?missingPhotosOnly=1",
      severity: initialData.alerts.missingPhotos > 0 ? "warning" : "success",
    },
    {
      id: "recon-overdue",
      label: "Recon backlog",
      detail: "Units still sitting in recon and slowing frontline availability.",
      count: initialData.alerts.needsRecon,
      href: "/inventory?status=REPAIR",
      severity: initialData.alerts.needsRecon > 0 ? "warning" : "success",
    },
    {
      id: "aged-units",
      label: "Aged units",
      detail: "Vehicles past 90 days on lot and now threatening turn performance.",
      count: initialData.alerts.over90Days,
      href: "/inventory?over90Only=1",
      severity: initialData.alerts.over90Days > 0 ? "danger" : "success",
    },
    {
      id: "deal-handoff",
      label: "Pending funding handoff",
      detail: "Inventory still tied to deals that have not fully cleared the funding step.",
      count: initialData.pipeline.pendingFunding,
      href: "/deals/funding",
      severity: initialData.pipeline.pendingFunding > 0 ? "warning" : "success",
    },
  ] satisfies InventorySignal[];

  const visibleExceptionSignals = exceptionSignals.filter((signal) => signal.count > 0);

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col space-y-4 min-[1800px]:space-y-5"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Inventory command board
            </p>
            <h1 className={cn(typography.pageTitle, "tracking-[-0.04em]")}>Vehicle inventory</h1>
            <p className="max-w-4xl min-[1800px]:max-w-5xl text-sm leading-7 text-[var(--muted-text)]">
              The live inventory list stays canonical, but this page now surfaces readiness, aging pressure, merchandising blockers, and deal handoff risk before row-level work.
            </p>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {totalUnits} live unit{totalUnits === 1 ? "" : "s"}
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {initialData.kpis.addedThisWeek} added this week
            </div>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2 min-[1500px]:grid-cols-3 min-[2000px]:grid-cols-6 min-[2400px]:grid-cols-8">
        <InventoryHeroCard
          label="Live units"
          value={String(totalUnits)}
          detail="Retail-visible inventory currently on the lot."
          accentClassName="bg-[linear-gradient(90deg,rgba(56,189,248,0.0)_0%,rgba(56,189,248,0.85)_100%)]"
        />
        <InventoryHeroCard
          label="Inventory value"
          value={valueLabel}
          detail="Current aggregated list value from the live inventory snapshot."
          accentClassName="bg-[linear-gradient(90deg,rgba(34,197,94,0.0)_0%,rgba(34,197,94,0.85)_100%)]"
        />
        <InventoryHeroCard
          label="Avg unit value"
          value={avgValueLabel}
          detail="Average current sale price across active inventory."
          accentClassName="bg-[linear-gradient(90deg,rgba(168,85,247,0.0)_0%,rgba(168,85,247,0.85)_100%)]"
        />
        <InventoryHeroCard
          label="Added this week"
          value={String(initialData.kpis.addedThisWeek)}
          detail="Fresh units landed in the last seven days."
          accentClassName="bg-[linear-gradient(90deg,rgba(14,165,233,0.0)_0%,rgba(14,165,233,0.85)_100%)]"
        />
        <InventoryHeroCard
          label="Aged 90+"
          value={String(initialData.alerts.over90Days)}
          detail="Units already in the highest aging-risk bucket."
          accentClassName="bg-[linear-gradient(90deg,rgba(239,68,68,0.0)_0%,rgba(239,68,68,0.88)_100%)]"
        />
        <InventoryHeroCard
          label="Recon backlog"
          value={String(initialData.alerts.needsRecon)}
          detail="Units blocked by recon and not yet frontline-ready."
          accentClassName="bg-[linear-gradient(90deg,rgba(245,158,11,0.0)_0%,rgba(245,158,11,0.88)_100%)]"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_0.95fr] min-[1800px]:grid-cols-[1.85fr_1fr] min-[2200px]:grid-cols-[1.95fr_0.9fr]">
        <Widget
          title="Inventory command center"
          subtitle="Compress lot health, retail readiness, and deal handoff into a first-read before you drop into the list."
          action={
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1 text-xs font-medium text-[var(--muted-text)]">
              Filtered list total {initialData.list.total}
            </div>
          }
        >
          <div className="grid gap-3 min-[1500px]:grid-cols-2 min-[2200px]:grid-cols-4">
            <InventoryLens
              icon={CheckCircle}
              label="How healthy is the lot?"
              value={`${healthScore}%`}
              detail={`${healthyUnits} unit${healthyUnits === 1 ? "" : "s"} are still inside the under-60-day operating band.`}
              tone={healthScore >= 75 ? "success" : healthScore >= 50 ? "info" : "warning"}
            />
            <InventoryLens
              icon={AlertTriangle}
              label="Where is aging risk?"
              value={String(initialData.health.gt90)}
              detail="Vehicles past 90 days should be treated as the first turn-risk queue."
              tone={initialData.health.gt90 > 0 ? "warning" : "success"}
            />
            <InventoryLens
              icon={Image}
              label="What is blocked now?"
              value={String(blockerCount)}
              detail="Combines missing photos, recon backlog, and aged-unit pressure into one blocker count."
              tone={blockerCount > 0 ? "warning" : "success"}
            />
            <InventoryLens
              icon={Handshake}
              label="Where is demand handoff?"
              value={String(initialData.pipeline.workingDeals + initialData.pipeline.pendingFunding)}
              detail="Units actively tied to deals, approvals, and funding completion pressure."
              tone={initialData.pipeline.pendingFunding > 0 ? "warning" : "info"}
            />
          </div>
        </Widget>

            <InventoryExceptionsRail signals={visibleExceptionSignals} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr] min-[1800px]:grid-cols-[1.5fr_0.95fr] min-[2200px]:grid-cols-[1.6fr_1fr]">
        <InventoryFlowPanel pipeline={initialData.pipeline} filterChips={initialData.filterChips} />
        <InventoryHealthPanel health={initialData.health} />
      </div>

      <VehicleInventoryTable
        items={initialData.list.items}
        page={initialData.list.page}
        pageSize={initialData.list.pageSize}
        total={initialData.list.total}
        canRead={true}
        canWrite={canWrite}
        buildPaginatedUrl={buildPaginatedUrl}
        search={search}
        onSearchChange={setSearch}
        onSearch={applyFilters}
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          pushFilters({ status: v || undefined, page: 1 });
        }}
        onAdvancedFilters={() => setFilterOpen(true)}
        floorPlannedCount={initialData.filterChips.floorPlannedCount}
      />

      <div className="flex flex-wrap items-center gap-4 px-1">
        <Link
          href="/inventory/aging"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View aging report
        </Link>
        <Link
          href="/inventory/list"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          Open list-focused mode
        </Link>
        {canWrite && (
          <button
            type="button"
            onClick={() => setImportHistoryOpen(true)}
            className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Import history
          </button>
        )}
      </div>

      {importHistoryOpen && (
        <ImportHistoryDialog onOpenChange={setImportHistoryOpen} />
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Status" options={statusOptions} value={status} onChange={setStatus} />
              <Input
                label="Search (VIN / make / model)"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                label="Min price ($)"
                placeholder="e.g. 5000"
                value={minPriceDollars}
                onChange={(e) => setMinPriceDollars(e.target.value)}
              />
              <Input
                label="Max price ($)"
                placeholder="e.g. 25000"
                value={maxPriceDollars}
                onChange={(e) => setMaxPriceDollars(e.target.value)}
              />
              <Select label="Sort by" options={sortOptions} value={sortBy} onChange={setSortBy} />
              <Select
                label="Order"
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
                value={sortOrder}
                onChange={(v) => setSortOrder(v)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button variant="secondary" onClick={() => setFilterOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </PageShell>
  );
}
