"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Filter,
  type LucideIcon,
  PhoneCall,
  Users,
} from "@/lib/ui/icons";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
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
  view?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  draft?: "all" | "draft" | "final";
  leadSource?: string;
  assignedTo?: string;
  q?: string;
  savedSearchId?: string;
};

export type BuildCustomersQueryParams = {
  view?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  draft?: "all" | "draft" | "final";
  leadSource?: string;
  assignedTo?: string;
  q?: string;
  savedSearchId?: string;
};

export function buildCustomersQuery(params: BuildCustomersQueryParams): string {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  const page =
    params.page !== undefined && params.pageSize !== undefined
      ? params.page
      : Math.max(1, Math.floor(offset / limit) + 1);
  const pageSize = params.pageSize ?? limit;
  const record: Record<string, string | number | undefined> = {
    ...(params.view ? { view: params.view } : {}),
    page,
    pageSize,
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.draft && params.draft !== "all" ? { draft: params.draft } : {}),
    ...(params.leadSource ? { leadSource: params.leadSource } : {}),
    ...(params.assignedTo ? { assignedTo: params.assignedTo } : {}),
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.savedSearchId ? { savedSearchId: params.savedSearchId } : {}),
  };
  return buildQueryString(record);
}

export type CustomersPageClientProps = {
  initialData: CustomersPageInitialData | null;
  canRead: boolean;
  canWrite: boolean;
  searchParams: CustomersSearchParams;
  savedFilters: SavedFilterCatalogItem[];
  savedSearches: SavedSearchCatalogItem[];
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
      {children}
    </p>
  );
}

function InsetPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.032)_0%,rgba(255,255,255,0.012)_100%)] p-4 shadow-[var(--shadow-card)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "info",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "info" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]"
      : tone === "warning"
        ? "border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)]"
        : "border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]";

  return (
    <InsetPanel className="min-h-[164px]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
            <p className="mt-1 max-w-[26ch] text-sm leading-6 text-[var(--muted-text)]">{detail}</p>
          </div>
        </div>
        <span className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--text)]">
          {value}
        </span>
      </div>
    </InsetPanel>
  );
}

function CommandNote({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/55 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">{hint}</p>
    </div>
  );
}

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
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface)]/70 text-[var(--muted-text)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
      )}
    >
      {label}
      {count != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-[var(--accent)]/16 text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--muted-text)]"
          )}
        >
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function CustomersPageClient({
  initialData,
  canRead,
  canWrite,
  searchParams,
  savedFilters,
  savedSearches,
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
    const qs = buildCustomersQuery({
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

  const handleStatusChange = (v: string) => {
    setStatus(v);
    pushFilters({ status: v || undefined, page: 1 });
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
    { label: "Active", chipStatus: "ACTIVE", count: summary.activeCustomers },
    { label: "Prospects", chipStatus: "LEAD", count: summary.totalLeads },
    { label: "Sold", chipStatus: "SOLD", count: summary.soldCount },
    { label: "Archived", chipStatus: "INACTIVE", count: summary.inactiveCustomers },
  ];

  const recentlyContactedShare = formatPercent(summary.recentlyContacted, Math.max(summary.totalCustomers, 1));
  const activeBookShare = formatPercent(summary.activeCustomers + summary.soldCount, Math.max(summary.totalCustomers, 1));
  const currentFocusLabel = status || "ALL";

  return (
    <PageShell
      fullWidth
      className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.10),transparent_30%),var(--page-bg)]"
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10"
      rail={
        <div className="space-y-4">
          <InsetPanel>
            <SectionEyebrow>Current Focus</SectionEyebrow>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">
              Customer operating context
            </h3>
            <div className="mt-4 space-y-3">
              <CommandNote
                label="Filter posture"
                value={currentFocusLabel}
                hint={status ? "The workbench is narrowed to one lifecycle slice." : "The workbench is showing the full book."}
              />
              <CommandNote
                label="Search lens"
                value={search.trim() || "Broad"}
                hint={search.trim() ? "Results are scoped to the current search term." : "No text filter is constraining the board."}
              />
            </div>
          </InsetPanel>
          <InsetPanel>
            <SectionEyebrow>Saved Intelligence</SectionEyebrow>
            <div className="mt-3 space-y-3">
              <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text)]">Reusable views</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">
                  {savedSearches.length + savedFilters.length}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">
                  {savedSearches.length} saved searches and {savedFilters.length} saved filters available to the team.
                </p>
              </div>
              <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text)]">Coverage signal</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">
                  {recentlyContactedShare}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">
                  Of the current customer book has been contacted within the last seven days.
                </p>
              </div>
            </div>
          </InsetPanel>
        </div>
      }
    >
      <section className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(11,19,36,0.96)_0%,rgba(17,24,39,0.92)_45%,rgba(10,15,29,0.96)_100%)] p-6 shadow-[var(--shadow-card)]">
        <div className="absolute-pointer-events-none" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <SectionEyebrow>Customer Command Board</SectionEyebrow>
            <div className="space-y-3">
              <h1 className="max-w-[11ch] text-[42px] font-semibold leading-[0.95] tracking-[-0.05em] text-white min-[1800px]:text-[52px]">
                Relationship pipeline in one operating surface.
              </h1>
              <p className="max-w-[64ch] text-sm leading-7 text-slate-300">
                Run lead intake, contact rhythm, callback pressure, and retained-customer health from the same board.
                The goal is to keep customer momentum visible before reps drop into row-level work.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
                {list.total.toLocaleString()} visible results
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
                {summary.newThisWeek.toLocaleString()} new this week
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
                {summary.callbacksToday.toLocaleString()} callbacks due today
              </span>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href="/customers/new">
                  <Button size="sm" className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
                    Create customer
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => pushFilters({ page: 1 })}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  Refresh workbench
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InsightCard
              icon={Users}
              label="Prospect pressure"
              value={summary.totalLeads.toLocaleString()}
              detail="Customers still in lead status and not yet advanced into active ownership."
            />
            <InsightCard
              icon={PhoneCall}
              label="Contact rhythm"
              value={summary.recentlyContacted.toLocaleString()}
              detail="Customers touched within the last seven days. Use this to watch outreach consistency."
              tone="success"
            />
            <InsightCard
              icon={CalendarClock}
              label="Callback clock"
              value={summary.callbacksToday.toLocaleString()}
              detail="Scheduled callbacks due today. This is the immediate follow-up pressure on the team."
              tone="warning"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <InsetPanel className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <SectionEyebrow>Executive Read</SectionEyebrow>
              <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">
                Customer book health
              </h2>
              <p className="max-w-[58ch] text-sm leading-6 text-[var(--muted-text)]">
                Use these ratios to decide whether the team needs more intake, better follow-up discipline,
                or a cleaner handoff from lead to active customer management.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-soft)]">
              Live customer book
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <CommandNote
              label="Engagement coverage"
              value={recentlyContactedShare}
              hint="Recently contacted over total customers."
            />
            <CommandNote
              label="Active + sold mix"
              value={activeBookShare}
              hint="Customers that made it past prospecting or are already closed."
            />
            <CommandNote
              label="Follow-up load"
              value={(summary.callbacksToday + summary.totalLeads).toLocaleString()}
              hint="Callbacks due today plus open prospects needing movement."
            />
          </div>
        </InsetPanel>

        <InsetPanel className="space-y-4">
          <div className="space-y-1.5">
            <SectionEyebrow>Command Deck</SectionEyebrow>
            <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">
              Fast steering controls
            </h2>
            <p className="text-sm leading-6 text-[var(--muted-text)]">
              Pivot the workbench by lifecycle status, switch between dense list and cards, and keep search context visible.
            </p>
          </div>
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/70 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-[var(--muted-text)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]">
                <Filter className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Current lens</p>
                <p>
                  {status ? `Status filtered to ${status}.` : "Showing all statuses."}
                  {search.trim() ? ` Search is narrowed to “${search.trim()}”.` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "table"
                      ? "bg-[var(--surface-2)] text-[var(--text)] shadow-sm"
                      : "text-[var(--muted-text)] hover:text-[var(--text)]"
                  )}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "cards"
                      ? "bg-[var(--surface-2)] text-[var(--text)] shadow-sm"
                      : "text-[var(--muted-text)] hover:text-[var(--text)]"
                  )}
                >
                  Cards
                </button>
              </div>
              <span className="text-xs font-medium tabular-nums text-[var(--muted-text)]">
                {list.total.toLocaleString()} results
              </span>
            </div>
          </div>
        </InsetPanel>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Customers"
          value={summary.totalCustomers.toLocaleString()}
          sub={summary.newThisWeek > 0 ? `+${summary.newThisWeek} this week` : "full visible book"}
          color="blue"
          hasUpdate={summary.newThisWeek > 0}
          trend={[summary.totalCustomers || 1, summary.totalCustomers || 1]}
          onClick={() => handleStatusChipClick("")}
          active={status === ""}
        />
        <KpiCard
          label="New Leads"
          value={summary.totalLeads.toLocaleString()}
          sub={summary.newThisWeek > 0 ? `${summary.newThisWeek} new this week` : "prospect queue"}
          color="violet"
          hasUpdate={summary.newThisWeek > 0}
          trend={[summary.totalLeads || 1, summary.totalLeads || 1]}
          onClick={() => handleStatusChipClick("LEAD")}
          active={status === "LEAD"}
        />
        <KpiCard
          label="Recently Contacted"
          value={summary.recentlyContacted.toLocaleString()}
          sub="last 7 days"
          color="green"
          hasUpdate={summary.recentlyContacted > 0}
          trend={[summary.recentlyContacted || 1, summary.recentlyContacted || 1]}
          onClick={() => handleStatusChipClick("")}
          active={false}
        />
        <KpiCard
          label="Appointments Today"
          value={summary.callbacksToday.toLocaleString()}
          color="amber"
          accentValue={summary.callbacksToday > 0}
          hasUpdate={summary.callbacksToday > 0}
          trend={[summary.callbacksToday || 1, summary.callbacksToday || 1]}
          onClick={() => handleStatusChipClick("")}
          active={false}
        />
        <KpiCard
          label="Closed / Repeat"
          value={summary.soldCount.toLocaleString()}
          sub="sold customer base"
          color="cyan"
          trend={[summary.soldCount || 1, summary.soldCount || 1]}
          onClick={() => handleStatusChipClick("SOLD")}
          active={status === "SOLD"}
        />
      </div>

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
