"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { VehicleInventoryTable } from "./components/VehicleInventoryTable";
import { buildQueryString } from "@/lib/url/buildQueryString";
import { formatCents } from "@/lib/money";
import { apiFetch } from "@/lib/client/http";
import { cn } from "@/lib/utils";
import type { InventoryPageOverview, VehicleListItem } from "@/modules/inventory/service/inventory-page";
import { VEHICLE_STATUS_OPTIONS } from "./types";

const VehicleCardGrid = dynamic(
  () => import("./components/VehicleCardGrid").then((mod) => mod.VehicleCardGrid),
  {
    loading: () => (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted-text)]">
        Loading card view...
      </div>
    ),
  }
);

export type InventoryListContentProps = {
  initialData: InventoryPageOverview;
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
  /** Server-loaded preference for table vs cards. */
  initialViewMode?: "table" | "cards";
};

// ─── Quick-filter chip ────────────────────────────────────────────────────────
function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number | null;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
      )}
    >
      {label}
      {count != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--muted-text)]"
          )}
        >
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────
function SummaryStrip({
  items,
  total,
  totalValueCents,
  avgDays,
}: {
  items: VehicleListItem[];
  total: number;
  totalValueCents: number;
  avgDays: number;
}) {
  const cols = React.useMemo(() => {
    const n = items.length;
    const avgPrice = n > 0 ? items.reduce((s, v) => s + v.salePriceCents, 0) / n : 0;
    const avgCost = n > 0 ? items.reduce((s, v) => s + v.costCents, 0) / n : 0;
    const totalProfit = items.reduce((s, v) => s + (v.salePriceCents - v.costCents), 0);
    const pageAvgDays = n > 0
      ? Math.round(items.reduce((s, v) => s + (v.daysInStock ?? 0), 0) / n)
      : 0;

    return [
      { label: "Rows", value: total.toLocaleString() },
      { label: "Value", value: formatCents(String(totalValueCents)) },
      { label: "Avg Price", value: formatCents(String(Math.round(avgPrice))) },
      { label: "Avg Cost", value: formatCents(String(Math.round(avgCost))) },
      { label: "Page Profit", value: formatCents(String(totalProfit)) },
      { label: "Avg Days", value: String(avgDays > 0 ? avgDays : pageAvgDays) },
    ];
  }, [items, total, totalValueCents, avgDays]);

  return (
    <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center border-b border-[var(--border)] px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
          Summary
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">
        {cols.map(({ label, value }) => (
          <div key={label} className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
              {label}
            </p>
            <p className="mt-1 text-[13px] font-bold tabular-nums text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS: SelectOption[] = [
  { value: "createdAt",      label: "Date Added" },
  { value: "salePriceCents", label: "Sale Price" },
  { value: "mileage",        label: "Mileage" },
  { value: "stockNumber",    label: "Stock #" },
  { value: "updatedAt",      label: "Last Updated" },
];

const ORDER_OPTIONS: SelectOption[] = [
  { value: "desc", label: "Newest first" },
  { value: "asc",  label: "Oldest first" },
];

// ─── Page component ───────────────────────────────────────────────────────────
export function InventoryListContent({
  initialData,
  currentQuery,
  canWrite,
  initialViewMode = "table",
}: InventoryListContentProps) {
  const router   = useRouter();
  const pathname = usePathname();

  const [filterOpen, setFilterOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"table" | "cards">(initialViewMode);

  const [search,          setSearch]          = React.useState(String(currentQuery.search    ?? ""));
  const [status,          setStatus]          = React.useState(String(currentQuery.status    ?? ""));
  const [minPriceDollars, setMinPriceDollars] = React.useState(
    currentQuery.minPrice != null ? String(Math.round(Number(currentQuery.minPrice) / 100)) : ""
  );
  const [maxPriceDollars, setMaxPriceDollars] = React.useState(
    currentQuery.maxPrice != null ? String(Math.round(Number(currentQuery.maxPrice) / 100)) : ""
  );
  const [sortBy,    setSortBy]    = React.useState(String(currentQuery.sortBy    ?? "createdAt"));
  const [sortOrder, setSortOrder] = React.useState(String(currentQuery.sortOrder ?? "desc"));

  const buildPaginatedUrl = React.useCallback(
    (params: { page: number; pageSize: number }) => {
      const q = { ...currentQuery, view: "list", page: params.page, pageSize: params.pageSize };
      const qs = buildQueryString(q);
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, currentQuery]
  );

  const pushFilters = React.useCallback(
    (overrides: Record<string, string | number | undefined> = {}) => {
      const minCents = minPriceDollars.trim() ? Math.round(parseFloat(minPriceDollars) * 100) : undefined;
      const maxCents = maxPriceDollars.trim() ? Math.round(parseFloat(maxPriceDollars) * 100) : undefined;
      const q: Record<string, string | number | undefined> = {
        view: "list",
        page: 1,
        pageSize: initialData.list.pageSize,
        sortBy,
        sortOrder: sortOrder as "asc" | "desc",
        ...(status     ? { status }         : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(minCents != null && !Number.isNaN(minCents) ? { minPrice: minCents } : {}),
        ...(maxCents != null && !Number.isNaN(maxCents) ? { maxPrice: maxCents } : {}),
        ...(currentQuery.over90Only ? { over90Only: 1 } : {}),
        ...(currentQuery.missingPhotosOnly ? { missingPhotosOnly: 1 } : {}),
        ...(currentQuery.floorPlannedOnly ? { floorPlannedOnly: 1 } : {}),
        ...overrides,
      };
      router.push(`${pathname}?${buildQueryString(q)}`);
      setFilterOpen(false);
    },
    [minPriceDollars, maxPriceDollars, status, search, sortBy, sortOrder, initialData.list.pageSize, pathname, router, currentQuery.over90Only, currentQuery.missingPhotosOnly, currentQuery.floorPlannedOnly]
  );

  const applyFilters      = () => pushFilters();
  const handleStatusChange = (v: string) => {
    setStatus(v);
    pushFilters({ status: v || undefined, page: 1 });
  };
  const handleStatusChipClick = (chipStatus: string) => {
    setStatus(chipStatus);
    pushFilters({ status: chipStatus || undefined, page: 1 });
  };
  const handleFilterChipClick = (filterKey: "over90Only" | "missingPhotosOnly" | "floorPlannedOnly") => {
    const isOn = Boolean(currentQuery[filterKey]);
    pushFilters({ [filterKey]: isOn ? undefined : 1 });
  };

  const handleViewModeChange = React.useCallback((mode: "table" | "cards") => {
    setViewMode(mode);
    apiFetch("/api/inventory/list-view-preference", {
      method: "PATCH",
      body: JSON.stringify({ view: mode }),
    }).catch(() => { /* persist in background */ });
  }, []);

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

  // ── Derived values for KPI cards ──────────────────────────────────────────
  const { kpis, alerts, health, filterChips } = initialData;

  const totalHealthUnits = health.lt30 + health.d30to60 + health.d60to90 + health.gt90;
  const weightedDays =
    totalHealthUnits > 0
      ? Math.round(
          (health.lt30 * 15 + health.d30to60 * 45 + health.d60to90 * 75 + health.gt90 * 105) /
            totalHealthUnits
        )
      : 0;

  // ── Chips ─────────────────────────────────────────────────────────────────
  const chips: Array<
    | { label: string; chipStatus: string; count: number | null; info?: never; filterKey?: never }
    | { label: string; chipStatus: ""; count: number | null; info?: never; filterKey: "over90Only" | "missingPhotosOnly" | "floorPlannedOnly" }
  > = [
    { label: "All",            chipStatus: "",           count: kpis.totalUnits },
    { label: "Available",      chipStatus: "AVAILABLE",   count: null },
    { label: "On Hold",        chipStatus: "HOLD",        count: null },
  ];

  const listSignals = [
    {
      id: "missing-photos",
      label: "Missing photos",
      detail: "Retail-ready units still missing merchandising assets.",
      count: alerts.missingPhotos,
      href: `${pathname}?${buildQueryString({ ...currentQuery, view: "list", missingPhotosOnly: 1, page: 1 })}`,
      severity: alerts.missingPhotos > 0 ? "warning" : "success",
    },
    {
      id: "recon",
      label: "Recon backlog",
      detail: "Units sitting in recon before they can return to frontline inventory.",
      count: alerts.needsRecon,
      href: `${pathname}?${buildQueryString({ ...currentQuery, view: "list", status: "REPAIR", page: 1 })}`,
      severity: alerts.needsRecon > 0 ? "warning" : "success",
    },
    {
      id: "aged",
      label: "Aged >90 days",
      detail: "Units already in the highest aging-risk bucket.",
      count: alerts.over90Days,
      href: `${pathname}?${buildQueryString({ ...currentQuery, view: "list", over90Only: 1, page: 1 })}`,
      severity: alerts.over90Days > 0 ? "danger" : "success",
    },
  ] as const;

  const activeSignals = listSignals.filter((signal) => signal.count > 0);
  const activeChipCount = chips.filter(({ chipStatus, filterKey }) =>
    filterKey ? Boolean(currentQuery[filterKey]) : status === chipStatus
  ).length;
  const exceptionKpis = activeSignals.slice(0, 2).map((signal) => ({
    ...signal,
    color:
      signal.severity === "danger"
        ? "amber"
        : signal.severity === "warning"
          ? "amber"
          : signal.severity === "success"
            ? "green"
            : "blue",
    sub:
      signal.severity === "danger"
        ? "immediate blocker"
        : signal.severity === "warning"
          ? "needs attention"
          : "stable",
  })) satisfies Array<{
    id: string;
    label: string;
    count: number;
    href: string;
    color: "green" | "blue" | "amber";
    sub: string;
  }>;

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const isTableView = viewMode === "table";
  const isCardsView = viewMode === "cards";
  const viewModeToggle = (
    <div className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      <button
        type="button"
        onClick={() => handleViewModeChange("table")}
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
          isTableView
            ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
            : "text-[var(--muted-text)] hover:text-[var(--text)]"
        )}
      >
        Table
      </button>
      <button
        type="button"
        onClick={() => handleViewModeChange("cards")}
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
          isCardsView
            ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
            : "text-[var(--muted-text)] hover:text-[var(--text)]"
        )}
      >
        Cards
      </button>
    </div>
  );

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
              Inventory list board
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
                Live inventory list
              </h1>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                Canonical row workflow
              </span>
            </div>
          </div>
        }
        description="Use the list as the operating surface, but keep blockers, quick filters, and lot health visible before row-by-row work."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {initialData.list.total.toLocaleString()} results
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {activeChipCount} active filters
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7">
        <KpiCard
          label="Total Inventory"
          value={kpis.totalUnits.toLocaleString()}
          sub={`+${kpis.addedThisWeek} this week`}
          color="blue"
          hasUpdate={kpis.addedThisWeek > 0}
          trend={[kpis.totalUnits, kpis.totalUnits]}
        />
        <KpiCard
          label="In Recon"
          value={alerts.needsRecon.toLocaleString()}
          sub="units flagged"
          color="amber"
          accentValue={alerts.needsRecon > 0}
          hasUpdate={alerts.needsRecon > 0}
          trend={[alerts.needsRecon, alerts.needsRecon]}
        />
        <KpiCard
          label="Aged >90 Days"
          value={alerts.over90Days.toLocaleString()}
          sub="units aging"
          color="amber"
          accentValue={alerts.over90Days > 0}
          hasUpdate={alerts.over90Days > 0}
          trend={[alerts.over90Days, alerts.over90Days]}
        />
        <KpiCard
          label="Avg Days on Lot"
          value={weightedDays}
          sub="across all units"
          color="cyan"
          trend={[weightedDays, weightedDays]}
        />
        <KpiCard
          label="List Value"
          value={formatCents(String(kpis.inventoryValueCents))}
          sub="current retail exposure"
          color="violet"
          trend={[kpis.inventoryValueCents, kpis.inventoryValueCents]}
        />
        {exceptionKpis.map((signal) => (
          <KpiCard
            key={signal.id}
            label={signal.label}
            value={signal.count.toLocaleString()}
            sub={signal.sub}
            color={signal.color}
            accentValue={signal.count > 0}
            hasUpdate={signal.count > 0}
            trend={[signal.count, signal.count]}
            onClick={() => router.push(signal.href)}
          />
        ))}
      </div>

      <div className="grid gap-4 min-[1800px]:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.68fr)] min-[2200px]:grid-cols-[minmax(0,2.15fr)_minmax(420px,0.72fr)]">
        {viewMode === "cards" ? (
          <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--text)]">Inventory cards</h2>
                <p className="mt-1 text-sm text-[var(--muted-text)]">
                  Visual scan mode for merchandising, readiness, and quick deal starts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
                  {initialData.list.items.length.toLocaleString()} on page
                </span>
                {viewModeToggle}
              </div>
            </div>
            <div className="px-4 py-4 min-[1800px]:px-5 min-[1800px]:py-5">
              <VehicleCardGrid items={initialData.list.items} canWrite={canWrite} />
            </div>
          </div>
        ) : (
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
            onStatusChange={handleStatusChange}
            onAdvancedFilters={() => setFilterOpen(true)}
            floorPlannedCount={filterChips.floorPlannedCount}
            footerControls={viewModeToggle}
            topControls={
              <div className="flex flex-wrap items-center gap-1.5">
                {chips.map(({ label, chipStatus, count, filterKey }) => {
                  const active = filterKey
                    ? Boolean(currentQuery[filterKey])
                    : status === chipStatus;
                  const onClick = filterKey
                    ? () => handleFilterChipClick(filterKey)
                    : () => handleStatusChipClick(chipStatus);
                  return (
                    <Chip
                      key={label}
                      label={label}
                      count={count}
                      active={active}
                      onClick={onClick}
                    />
                  );
                })}
              </div>
            }
          />
        )}

        <div className="space-y-3">
          <SummaryStrip
            items={initialData.list.items}
            total={initialData.list.total}
            totalValueCents={kpis.inventoryValueCents}
            avgDays={weightedDays}
          />
          <Widget
            compact
            title="Lot pressure"
            subtitle="Quick context on aging and merchandising while you stay in the list."
          >
            <div className="space-y-3">
              {[
                { label: "<30 days", count: health.lt30, tone: "bg-emerald-400" },
                { label: "30-60 days", count: health.d30to60, tone: "bg-sky-400" },
                { label: "60-90 days", count: health.d60to90, tone: "bg-amber-400" },
                { label: ">90 days", count: health.gt90, tone: "bg-red-400" },
              ].map((row) => {
                const width = totalHealthUnits === 0 ? 0 : Math.max(2, Math.round((row.count / totalHealthUnits) * 100));
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px] font-medium text-[var(--text)]">{row.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className={cn("h-full rounded-full", row.tone)} style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--muted-text)]">
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Widget>
        </div>
      </div>

      {/* ── Advanced Filters dialog ── */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Status" options={statusOptions} value={status} onChange={setStatus} />
              <Input
                label="Search (VIN / make / model / stock)"
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
              <Select label="Sort by" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
              <Select
                label="Order"
                options={ORDER_OPTIONS}
                value={sortOrder}
                onChange={setSortOrder}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button variant="secondary" onClick={() => setFilterOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
