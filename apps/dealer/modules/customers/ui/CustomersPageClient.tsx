"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { CustomersTableCard } from "./components/CustomersTableCard";
import { CustomerCardGrid } from "./components/CustomerCardGrid";
import { cn } from "@/lib/utils";
import { buildQueryString } from "@/lib/url/buildQueryString";
import type { CustomerListItem } from "@/lib/types/customers";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";
import type { SavedFilterCatalogItem, SavedSearchCatalogItem } from "@/lib/types/saved-filters-searches";

export type CustomersPageInitialData = {
  list: { data: CustomerListItem[]; total: number; page: number; pageSize: number };
  summary: CustomerSummaryMetrics;
};

export type CustomersSearchParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  leadSource?: string;
  assignedTo?: string;
  q?: string;
  savedSearchId?: string;
};

export type CustomersPageClientProps = {
  initialData: CustomersPageInitialData | null;
  canRead: boolean;
  canWrite: boolean;
  searchParams: CustomersSearchParams;
  savedFilters: SavedFilterCatalogItem[];
  savedSearches: SavedSearchCatalogItem[];
};

// ─── Quick-filter chip (same style as inventory) ────────────────────────────
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

export function CustomersPageClient({
  initialData,
  canRead,
  canWrite,
  searchParams,
}: CustomersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [search, setSearch] = React.useState(searchParams.q ?? "");
  const [status, setStatus] = React.useState(searchParams.status ?? "");

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to customers.</p>
        </div>
      </PageShell>
    );
  }

  const list = initialData?.list ?? { data: [], total: 0, page: 1, pageSize: 25 };
  const summary = initialData?.summary ?? {
    totalCustomers: 0,
    totalLeads: 0,
    activeCustomers: 0,
    activeCount: 0,
    inactiveCustomers: 0,
    soldCount: 0,
    recentlyContacted: 0,
    callbacksToday: 0,
    newThisWeek: 0,
  };

  const buildPaginatedUrl = (params: { page: number; pageSize: number }) => {
    const q: Record<string, string | number | undefined> = {
      page: params.page,
      pageSize: params.pageSize,
      ...(status ? { status } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(searchParams.sortBy ? { sortBy: searchParams.sortBy } : {}),
      ...(searchParams.sortOrder ? { sortOrder: searchParams.sortOrder } : {}),
      ...(searchParams.leadSource ? { leadSource: searchParams.leadSource } : {}),
      ...(searchParams.assignedTo ? { assignedTo: searchParams.assignedTo } : {}),
    };
    const qs = buildQueryString(q);
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const pushFilters = (overrides: Record<string, string | number | undefined> = {}) => {
    const q: Record<string, string | number | undefined> = {
      page: 1,
      pageSize: list.pageSize,
      ...(status ? { status } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(searchParams.sortBy ? { sortBy: searchParams.sortBy } : {}),
      ...(searchParams.sortOrder ? { sortOrder: searchParams.sortOrder } : {}),
      ...(searchParams.leadSource ? { leadSource: searchParams.leadSource } : {}),
      ...(searchParams.assignedTo ? { assignedTo: searchParams.assignedTo } : {}),
      ...overrides,
    };
    router.push(`${pathname}?${buildQueryString(q)}`);
  };

  const handleStatusChipClick = (chipStatus: string) => {
    setStatus(chipStatus);
    pushFilters({ status: chipStatus || undefined, page: 1 });
  };

  const handleStatusChange = (v: string) => {
    setStatus(v);
    pushFilters({ status: v || undefined, page: 1 });
  };

  const handleSearch = () => pushFilters();

  // ─── Chips ──────────────────────────────────────────────────────────────────
  const chips = [
    { label: "All",       chipStatus: "",         count: summary.totalCustomers },
    { label: "Active",    chipStatus: "ACTIVE",   count: summary.activeCustomers },
    { label: "Prospects", chipStatus: "LEAD",     count: summary.totalLeads },
    { label: "Sold",      chipStatus: "SOLD",     count: summary.soldCount },
    { label: "Archived",  chipStatus: "INACTIVE", count: summary.inactiveCustomers },
  ];

  return (
    <PageShell className="flex flex-col space-y-3">

      {/* ── 1. KPI cards (click to apply status filter) ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Customers"
          value={summary.totalCustomers.toLocaleString()}
          sub={summary.newThisWeek > 0 ? `+${summary.newThisWeek} this week` : undefined}
          color="blue"
          hasUpdate={summary.newThisWeek > 0}
          trend={[summary.totalCustomers, summary.totalCustomers]}
          onClick={() => handleStatusChipClick("")}
          active={status === ""}
        />
        <KpiCard
          label="New Leads"
          value={summary.totalLeads.toLocaleString()}
          sub={summary.newThisWeek > 0 ? `${summary.newThisWeek} new this week` : undefined}
          color="violet"
          hasUpdate={summary.newThisWeek > 0}
          trend={[summary.totalLeads, summary.totalLeads]}
          onClick={() => handleStatusChipClick("LEAD")}
          active={status === "LEAD"}
        />
        <KpiCard
          label="Recently Contacted"
          value={summary.recentlyContacted.toLocaleString()}
          sub="last 7 days"
          color="green"
          hasUpdate={summary.recentlyContacted > 0}
          trend={[summary.recentlyContacted, summary.recentlyContacted]}
          onClick={() => handleStatusChipClick("")}
          active={false}
        />
        <KpiCard
          label="Appointments Today"
          value={summary.callbacksToday.toLocaleString()}
          color="amber"
          accentValue={summary.callbacksToday > 0}
          hasUpdate={summary.callbacksToday > 0}
          trend={[summary.callbacksToday, summary.callbacksToday]}
          onClick={() => handleStatusChipClick("")}
          active={false}
        />
        <KpiCard
          label="Repeat"
          value={summary.soldCount.toLocaleString()}
          sub="returning customers"
          color="cyan"
          trend={[summary.soldCount, summary.soldCount]}
          onClick={() => handleStatusChipClick("SOLD")}
          active={status === "SOLD"}
        />
      </div>

      {/* ── 2. Quick-filter chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(({ label, chipStatus, count }) => (
          <Chip
            key={label}
            label={label}
            count={count}
            active={status === chipStatus}
            onClick={() => handleStatusChipClick(chipStatus)}
          />
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
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
              onClick={() => setViewMode("cards")}
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
            {list.total.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* ── 3. Content (Table or Cards) ── */}
      {viewMode === "cards" ? (
        <CustomerCardGrid items={list.data} canWrite={canWrite} />
      ) : (
        <CustomersTableCard
          data={list.data}
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          canRead={canRead}
          canWrite={canWrite}
          search={search}
          onSearchChange={setSearch}
          onSearch={handleSearch}
          status={status}
          onStatusChange={handleStatusChange}
          buildPaginatedUrl={buildPaginatedUrl}
        />
      )}
    </PageShell>
  );
}
