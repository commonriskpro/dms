"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { CustomersTableCard } from "./components/CustomersTableCard";
import { CustomerCardGrid } from "./components/CustomerCardGrid";
import {
  buildCustomersQuery,
  type CustomersPageInitialData,
  type CustomersSearchParams,
} from "./CustomersPageClient";
import { cn } from "@/lib/utils";

type CustomersListContentProps = {
  initialData: CustomersPageInitialData | null;
  canRead: boolean;
  canWrite: boolean;
  searchParams: CustomersSearchParams;
};

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

function SummaryStrip({
  total,
  prospects,
  active,
  sold,
  contacted,
  callbacks,
}: {
  total: number;
  prospects: number;
  active: number;
  sold: number;
  contacted: number;
  callbacks: number;
}) {
  const cols = [
    { label: "Rows", value: total.toLocaleString() },
    { label: "Prospects", value: prospects.toLocaleString() },
    { label: "Active", value: active.toLocaleString() },
    { label: "Sold", value: sold.toLocaleString() },
    { label: "Contacted 7d", value: contacted.toLocaleString() },
    { label: "Callbacks", value: callbacks.toLocaleString() },
  ];

  return (
    <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center border-b border-[var(--border)] px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
          Summary
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--border)] sm:grid-cols-3 lg:grid-cols-2 min-[2200px]:grid-cols-3">
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

export function CustomersListContent({
  initialData,
  canRead,
  canWrite,
  searchParams,
}: CustomersListContentProps) {
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
    const qs = buildCustomersQuery({
      view: "list",
      page: params.page,
      pageSize: params.pageSize,
      sortBy: searchParams.sortBy,
      sortOrder: searchParams.sortOrder,
      status: status || undefined,
      leadSource: searchParams.leadSource,
      assignedTo: searchParams.assignedTo,
      q: search.trim() || undefined,
      savedSearchId: searchParams.savedSearchId,
    });
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const pushFilters = (overrides: Record<string, string | number | undefined> = {}) => {
    const page = overrides.page !== undefined ? Number(overrides.page) : 1;
    const pageSize = overrides.pageSize !== undefined ? Number(overrides.pageSize) : list.pageSize;
    const qs = buildCustomersQuery({
      view: "list",
      page,
      pageSize,
      sortBy: searchParams.sortBy,
      sortOrder: searchParams.sortOrder,
      status: (overrides.status !== undefined ? overrides.status : status) as string | undefined,
      leadSource: searchParams.leadSource,
      assignedTo: searchParams.assignedTo,
      q: search.trim() || undefined,
      savedSearchId: searchParams.savedSearchId,
      ...overrides,
    });
    router.push(`${pathname}?${qs}`);
  };

  const handleStatusChipClick = (chipStatus: string) => {
    setStatus(chipStatus);
    pushFilters({ status: chipStatus || undefined, page: 1 });
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    pushFilters({ status: value || undefined, page: 1 });
  };

  const handleSearch = () => pushFilters();

  React.useEffect(() => {
    setSearch(searchParams.q ?? "");
  }, [searchParams.q]);

  React.useEffect(() => {
    const trimmedSearch = search.trim();
    const currentSearch = (searchParams.q ?? "").trim();
    if (trimmedSearch === currentSearch) return;

    const timeoutId = window.setTimeout(() => {
      pushFilters({ q: trimmedSearch || undefined, page: 1 });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [search, searchParams.q]);

  const chips = [
    { label: "All", chipStatus: "", count: summary.totalCustomers },
    { label: "Prospects", chipStatus: "LEAD", count: summary.totalLeads },
    { label: "Active", chipStatus: "ACTIVE", count: summary.activeCustomers },
    { label: "Sold", chipStatus: "SOLD", count: summary.soldCount },
    { label: "Archived", chipStatus: "INACTIVE", count: summary.inactiveCustomers },
  ];

  const contactCoverage =
    summary.totalCustomers > 0
      ? Math.round((summary.recentlyContacted / summary.totalCustomers) * 100)
      : 0;
  const staleCustomers = Math.max(summary.totalCustomers - summary.recentlyContacted, 0);
  const activeFilterCount = [status, search.trim()].filter(Boolean).length;
  const workbenchRows = [
    { label: "Prospects", count: summary.totalLeads, tone: "bg-sky-400" },
    { label: "Needs contact", count: staleCustomers, tone: "bg-amber-400" },
    { label: "Callbacks today", count: summary.callbacksToday, tone: "bg-emerald-400" },
    { label: "Archived", count: summary.inactiveCustomers, tone: "bg-red-400" },
  ];
  const pressureMax = Math.max(summary.totalCustomers, 1);

  const viewModeToggle = (
    <div className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      <button
        type="button"
        onClick={() => setViewMode("table")}
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
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
          "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
          viewMode === "cards"
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
              Customer list board
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
                Live customer list
              </h1>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                Canonical row workflow
              </span>
            </div>
          </div>
        }
        description="Use the list as the operating surface, but keep outreach pressure, follow-up load, and book health visible before row-by-row work."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {list.total.toLocaleString()} results
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {activeFilterCount} active filters
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 min-[1800px]:grid-cols-6">
        <KpiCard
          label="Total Customers"
          value={summary.totalCustomers.toLocaleString()}
          sub={`+${summary.newThisWeek} this week`}
          color="blue"
          hasUpdate={summary.newThisWeek > 0}
          trend={[summary.totalCustomers || 1, summary.totalCustomers || 1]}
          onClick={() => handleStatusChipClick("")}
          active={status === ""}
        />
        <KpiCard
          label="Prospects"
          value={summary.totalLeads.toLocaleString()}
          sub="open lead queue"
          color="amber"
          accentValue={summary.totalLeads > 0}
          hasUpdate={summary.totalLeads > 0}
          trend={[summary.totalLeads || 1, summary.totalLeads || 1]}
          onClick={() => handleStatusChipClick("LEAD")}
          active={status === "LEAD"}
        />
        <KpiCard
          label="Active Customers"
          value={summary.activeCustomers.toLocaleString()}
          sub="owned relationships"
          color="cyan"
          trend={[summary.activeCustomers || 1, summary.activeCustomers || 1]}
          onClick={() => handleStatusChipClick("ACTIVE")}
          active={status === "ACTIVE"}
        />
        <KpiCard
          label="Contacted 7 Days"
          value={summary.recentlyContacted.toLocaleString()}
          sub={`${contactCoverage}% of visible book`}
          color="green"
          hasUpdate={summary.recentlyContacted > 0}
          trend={[summary.recentlyContacted || 1, summary.recentlyContacted || 1]}
        />
        <KpiCard
          label="Callbacks Today"
          value={summary.callbacksToday.toLocaleString()}
          sub="follow-up due now"
          color="amber"
          accentValue={summary.callbacksToday > 0}
          hasUpdate={summary.callbacksToday > 0}
          trend={[summary.callbacksToday || 1, summary.callbacksToday || 1]}
        />
        <KpiCard
          label="Sold Base"
          value={summary.soldCount.toLocaleString()}
          sub="closed customer book"
          color="violet"
          trend={[summary.soldCount || 1, summary.soldCount || 1]}
          onClick={() => handleStatusChipClick("SOLD")}
          active={status === "SOLD"}
        />
      </div>

      <div className="grid gap-4 min-[1800px]:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.68fr)] min-[2200px]:grid-cols-[minmax(0,2.15fr)_minmax(420px,0.72fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map(({ label, chipStatus, count }) => (
                <Chip
                  key={label}
                  label={label}
                  count={count}
                  active={status === chipStatus}
                  onClick={() => handleStatusChipClick(chipStatus)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--muted-text)]">
                {list.data.length.toLocaleString()} on page
              </span>
              {viewModeToggle}
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--text)]">Customer cards</h2>
                  <p className="mt-1 text-sm text-[var(--muted-text)]">
                    Visual scan mode for contact state, ownership, and quick follow-up.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
                  {list.data.length.toLocaleString()} on page
                </span>
              </div>
              <div className="px-4 py-4 min-[1800px]:px-5 min-[1800px]:py-5">
                <CustomerCardGrid items={list.data} canWrite={canWrite} />
              </div>
            </div>
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
        </div>

        <div className="space-y-3">
          <SummaryStrip
            total={list.total}
            prospects={summary.totalLeads}
            active={summary.activeCustomers}
            sold={summary.soldCount}
            contacted={summary.recentlyContacted}
            callbacks={summary.callbacksToday}
          />
          <Widget
            compact
            title="Book pressure"
            subtitle="Quick context on lead load and follow-up risk while you stay in the list."
          >
            <div className="space-y-3">
              {workbenchRows.map((row) => {
                const width = row.count === 0 ? 0 : Math.max(2, Math.round((row.count / pressureMax) * 100));
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[13px] font-medium text-[var(--text)]">{row.label}</span>
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
    </PageShell>
  );
}
