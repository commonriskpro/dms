"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { VehicleInventoryTable } from "./components/VehicleInventoryTable";
import { VehicleCardGrid } from "./components/VehicleCardGrid";
import { buildQueryString } from "@/lib/url/buildQueryString";
import { formatCents } from "@/lib/money";
import { apiFetch } from "@/lib/client/http";
import { widgetTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { InventoryPageOverview, VehicleListItem } from "@/modules/inventory/service/inventory-page";
import { VEHICLE_STATUS_OPTIONS } from "./types";

export type InventoryListContentProps = {
  initialData: InventoryPageOverview;
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
  /** Server-loaded preference for table vs cards. */
  initialViewMode?: "table" | "cards";
};

// ─── KPI card (same style as dashboard) ──────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full")}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
        {label}
      </p>
      <div
        className={cn(
          "tabular-nums text-[32px] font-bold leading-none",
          accent ? "text-[var(--warning)]" : "text-[var(--text)]"
        )}
      >
        {value}
      </div>
      {sub ? (
        <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">{sub}</p>
      ) : null}
    </section>
  );
}

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
        "flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
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
  const n = items.length;
  const avgPrice = n > 0 ? items.reduce((s, v) => s + v.salePriceCents, 0) / n : 0;
  const avgCost  = n > 0 ? items.reduce((s, v) => s + v.costCents, 0) / n : 0;
  const totalProfit = items.reduce((s, v) => s + (v.salePriceCents - v.costCents), 0);
  const pageAvgDays = n > 0
    ? Math.round(items.reduce((s, v) => s + (v.daysInStock ?? 0), 0) / n)
    : 0;

  const cols = [
    { label: "Vehicles",        value: total.toLocaleString() },
    { label: "Avg Days on Lot", value: String(avgDays > 0 ? avgDays : pageAvgDays) },
    { label: "Total Value",     value: formatCents(String(totalValueCents)) },
    { label: "Avg Price",       value: formatCents(String(Math.round(avgPrice))) },
    { label: "Avg Cost",        value: formatCents(String(Math.round(avgCost))) },
    { label: "Page Profit",     value: formatCents(String(totalProfit)) },
  ];

  return (
    <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center border-b border-[var(--border)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-text)]">
          Summary
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">
        {cols.map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
              {label}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-[var(--text)]">{value}</p>
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
    { label: "In Recon",       chipStatus: "REPAIR",      count: alerts.needsRecon },
    { label: "On Hold",        chipStatus: "HOLD",        count: null },
    { label: "Aged >90 Days",  chipStatus: "",            count: alerts.over90Days,   filterKey: "over90Only" },
    { label: "Missing Photos", chipStatus: "",            count: alerts.missingPhotos, filterKey: "missingPhotosOnly" },
    { label: "Floor Planned",  chipStatus: "",            count: filterChips.floorPlannedCount, filterKey: "floorPlannedOnly" },
  ];

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  return (
    <PageShell className="flex flex-col space-y-3">

      {/* ── 1. KPI cards ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Inventory"
          value={kpis.totalUnits.toLocaleString()}
          sub={`+${kpis.addedThisWeek} this week`}
        />
        <KpiCard
          label="In Recon"
          value={alerts.needsRecon.toLocaleString()}
          sub="units flagged"
          accent={alerts.needsRecon > 0}
        />
        <KpiCard
          label="Aged >90 Days"
          value={alerts.over90Days.toLocaleString()}
          sub="units aging"
          accent={alerts.over90Days > 0}
        />
        <KpiCard
          label="Avg Days on Lot"
          value={weightedDays}
          sub="across all units"
        />
        <KpiCard
          label="Floor Planned"
          value={filterChips.floorPlannedCount.toLocaleString()}
          sub="units financed"
        />
      </div>

      {/* ── 2. Quick-filter chips ── */}
      <div className="flex flex-wrap items-center gap-2">
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
        {/* Toggle + result count */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            <button
              type="button"
              onClick={() => handleViewModeChange("table")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "table"
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
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "cards"
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--muted-text)] hover:text-[var(--text)]"
              )}
            >
              Cards
            </button>
          </div>
          <span className="text-xs tabular-nums text-[var(--muted-text)]">
            {initialData.list.total.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* ── 3. Content (Table or Cards) ── */}
      {viewMode === "cards" ? (
        <VehicleCardGrid items={initialData.list.items} canWrite={canWrite} />
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
        />
      )}

      {/* ── 4. Summary strip ── */}
      <SummaryStrip
        items={initialData.list.items}
        total={initialData.list.total}
        totalValueCents={kpis.inventoryValueCents}
        avgDays={weightedDays}
      />

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
