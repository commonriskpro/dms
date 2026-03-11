"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { cn } from "@/lib/utils";
import type { CommandCenterItem, CommandCenterResponse } from "./types";
import { buildCrmWorkspaceQuery, normalizeCrmScope, type CrmWorkspaceQuery } from "./query-state";

type Scope = "mine" | "team" | "all";
type CommandCenterQuery = Pick<
  CrmWorkspaceQuery,
  "scope" | "ownerId" | "stageId" | "status" | "source" | "q"
>;

function ScopeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
      )}
    >
      {label}
    </button>
  );
}

function QueueSection({
  title,
  subtitle,
  items,
  emptyLabel,
  onPrimaryAction,
  onOpen,
  formatHref,
  workedCustomerId,
  workedOpportunityId,
}: {
  title: string;
  subtitle: string;
  items: CommandCenterItem[];
  emptyLabel: string;
  onPrimaryAction: (item: CommandCenterItem) => void;
  onOpen: (item: CommandCenterItem) => void;
  formatHref: (href: string) => string;
  workedCustomerId?: string | null;
  workedOpportunityId?: string | null;
}) {
  return (
    <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted-text)]">{subtitle}</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
          {items.length.toLocaleString()} items
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--muted-text)]">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                item.customerId === workedCustomerId || item.opportunityId === workedOpportunityId
                  ? "bg-[var(--accent)]/5"
                  : ""
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={formatHref(item.href)} className="truncate text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)]">
                    {item.title}
                  </Link>
                  {item.customerId === workedCustomerId || item.opportunityId === workedOpportunityId ? (
                    <StatusBadge variant="success">Just worked</StatusBadge>
                  ) : null}
                  {item.severity ? (
                    <StatusBadge
                      variant={
                        item.severity === "danger"
                          ? "danger"
                          : item.severity === "warning"
                            ? "warning"
                            : "info"
                      }
                    >
                      {item.severity}
                    </StatusBadge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted-text)]">{item.detail}</p>
                {item.whenLabel ? (
                  <p className="mt-1 text-[12px] font-medium text-[var(--text-soft)]">{item.whenLabel}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => onOpen(item)}>
                  Open
                </Button>
                <Button size="sm" onClick={() => onPrimaryAction(item)}>
                  {item.nextActionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrmCommandCenterPage({
  initialQuery,
}: {
  initialQuery?: CommandCenterQuery;
}) {
  const { hasPermission } = useSession();
  const canRead = hasPermission("crm.read");
  const canWriteCustomers = hasPermission("customers.write");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState<CommandCenterQuery>({
    scope: normalizeCrmScope(initialQuery?.scope),
    ownerId: initialQuery?.ownerId,
    stageId: initialQuery?.stageId,
    status: initialQuery?.status,
    source: initialQuery?.source,
    q: initialQuery?.q,
  });
  const [searchDraft, setSearchDraft] = React.useState(initialQuery?.q ?? "");
  const [data, setData] = React.useState<CommandCenterResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const workedCustomerId = searchParams.get("workedCustomerId");
  const workedOpportunityId = searchParams.get("workedOpportunityId");
  const refreshed = searchParams.get("refreshed") === "1";
  const scope = normalizeCrmScope(query.scope) as Scope;
  const activeFilters = [
    scope !== "all",
    query.ownerId,
    query.stageId,
    query.status,
    query.source,
    query.q?.trim(),
  ].filter(Boolean).length;

  React.useEffect(() => {
    setQuery({
      scope: normalizeCrmScope(initialQuery?.scope),
      ownerId: initialQuery?.ownerId,
      stageId: initialQuery?.stageId,
      status: initialQuery?.status,
      source: initialQuery?.source,
      q: initialQuery?.q,
    });
    setSearchDraft(initialQuery?.q ?? "");
  }, [
    initialQuery?.ownerId,
    initialQuery?.q,
    initialQuery?.scope,
    initialQuery?.source,
    initialQuery?.stageId,
    initialQuery?.status,
  ]);

  const pushQuery = React.useCallback(
    (overrides: Partial<CommandCenterQuery>) => {
      const next: CommandCenterQuery = {
        ...query,
        ...overrides,
        scope: normalizeCrmScope(overrides.scope ?? query.scope),
      };
      setQuery(next);
      const qs = buildCrmWorkspaceQuery(next);
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, query, router]
  );

  const currentQueueHref = React.useMemo(() => {
    const qs = buildCrmWorkspaceQuery({
      scope,
      ownerId: query.ownerId,
      stageId: query.stageId,
      status: query.status,
      source: query.source,
      q: query.q?.trim() || undefined,
    });
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, query.ownerId, query.q, query.source, query.stageId, query.status, scope]);
  const opportunitiesWorkspaceHref = React.useMemo(() => {
    const qs = buildCrmWorkspaceQuery({
      view: "board",
      scope,
      ownerId: query.ownerId,
      stageId: query.stageId,
      status: query.status,
      source: query.source,
      q: query.q,
    });
    return qs ? `/crm/opportunities?${qs}` : "/crm/opportunities";
  }, [query.ownerId, query.q, query.source, query.stageId, query.status, scope]);
  const inboxWorkspaceHref = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("returnTo", currentQueueHref);
    return `/crm/inbox?${params.toString()}`;
  }, [currentQueueHref]);

  const withReturnTo = React.useCallback(
    (href: string) => {
      const [base, existingQuery = ""] = href.split("?");
      const params = new URLSearchParams(existingQuery);
      params.set("returnTo", currentQueueHref);
      const nextQuery = params.toString();
      return nextQuery ? `${base}?${nextQuery}` : base;
    },
    [currentQueueHref]
  );

  const fetchData = React.useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = buildCrmWorkspaceQuery({
        scope,
        ownerId: query.ownerId,
        stageId: query.stageId,
        status: query.status,
        source: query.source,
        q: query.q?.trim() || undefined,
      });
      const result = await apiFetch<{ data: CommandCenterResponse }>(
        `/api/crm/command-center${qs ? `?${qs}` : ""}`
      );
      setData(result.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canRead, query.ownerId, query.q, query.source, query.stageId, query.status, scope]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpen = React.useCallback(
    (item: CommandCenterItem) => {
      router.push(withReturnTo(item.href));
    },
    [router, withReturnTo]
  );

  const handlePrimaryAction = React.useCallback(
    async (item: CommandCenterItem) => {
      if (item.kind === "task" && item.customerId && canWriteCustomers) {
        await apiFetch(`/api/customers/${item.customerId}/tasks/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ completedAt: new Date().toISOString() }),
        });
        await fetchData();
        return;
      }
      if (item.kind === "callback" && item.customerId && canWriteCustomers) {
        await apiFetch(`/api/customers/${item.customerId}/callbacks/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "DONE" }),
        });
        await fetchData();
        return;
      }
      router.push(withReturnTo(item.nextActionHref));
    },
    [canWriteCustomers, fetchData, router, withReturnTo]
  );

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
        </div>
      </PageShell>
    );
  }

  if (loading && !data) {
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10">
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <ErrorState message={error ?? "Failed to load CRM command center"} onRetry={fetchData} />
      </PageShell>
    );
  }

  const highestStage = [...data.pipeline.stages].sort((a, b) => b.count - a.count)[0];

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
              CRM command center
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
                Live follow-up queue
              </h1>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                Customer-centered workflow
              </span>
            </div>
          </div>
        }
        description="Triage callbacks, stale prospects, conversations, and pipeline blockers before dropping into customer or opportunity detail."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {data.kpis.dueNow.toLocaleString()} due now
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {activeFilters} active filters
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Open Opportunities" value={data.kpis.openOpportunities.toLocaleString()} sub="current pipeline load" color="blue" trend={[data.kpis.openOpportunities || 1, data.kpis.openOpportunities || 1]} onClick={() => router.push(opportunitiesWorkspaceHref)} />
        <KpiCard label="Due Now" value={data.kpis.dueNow.toLocaleString()} sub="callbacks, tasks, inbox" color="amber" accentValue={data.kpis.dueNow > 0} hasUpdate={data.kpis.dueNow > 0} trend={[data.kpis.dueNow || 1, data.kpis.dueNow || 1]} />
        <KpiCard label="Stale Prospects" value={data.kpis.staleProspects.toLocaleString()} sub="cooling leads" color="amber" accentValue={data.kpis.staleProspects > 0} hasUpdate={data.kpis.staleProspects > 0} trend={[data.kpis.staleProspects || 1, data.kpis.staleProspects || 1]} />
        <KpiCard label="Pipeline Blockers" value={data.kpis.blockers.toLocaleString()} sub="missing owner or next step" color="violet" accentValue={data.kpis.blockers > 0} hasUpdate={data.kpis.blockers > 0} trend={[data.kpis.blockers || 1, data.kpis.blockers || 1]} />
        <KpiCard label="Waiting Conversations" value={data.kpis.waitingConversations.toLocaleString()} sub="latest inbound threads" color="cyan" trend={[data.kpis.waitingConversations || 1, data.kpis.waitingConversations || 1]} onClick={() => router.push(inboxWorkspaceHref)} />
        <KpiCard label="Sequence Exceptions" value={data.kpis.sequenceExceptions.toLocaleString()} sub="paused or failed" color="green" trend={[data.kpis.sequenceExceptions || 1, data.kpis.sequenceExceptions || 1]} onClick={() => router.push("/crm/sequences")} />
      </div>

      {refreshed ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text)]">
              Queue refreshed. {workedCustomerId || workedOpportunityId ? "Your last worked record is highlighted below." : "Recent CRM changes are reflected in this lens."}
            </p>
            <Button size="sm" variant="secondary" onClick={fetchData}>
              Refresh again
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <ScopeChip label="All work" active={scope === "all"} onClick={() => pushQuery({ scope: "all" })} />
            <ScopeChip label="My work" active={scope === "mine"} onClick={() => pushQuery({ scope: "mine" })} />
            <ScopeChip label="Team lens" active={scope === "team"} onClick={() => pushQuery({ scope: "team" })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
              {data.sections.dueNow.length.toLocaleString()} due now
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
              {activeFilters} active filters
            </span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(240px,1.2fr)_repeat(4,minmax(160px,0.8fr))_auto]">
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                pushQuery({ q: searchDraft.trim() || undefined });
              }
            }}
            placeholder="Search customers or next actions"
            aria-label="Search CRM command center"
          />
          <Select
            options={[{ value: "", label: "All owners" }, ...data.filters.owners]}
            value={query.ownerId ?? ""}
            onChange={(value) => pushQuery({ ownerId: value || undefined })}
            aria-label="Filter by owner"
          />
          <Select
            options={[{ value: "", label: "All stages" }, ...data.filters.stages]}
            value={query.stageId ?? ""}
            onChange={(value) => pushQuery({ stageId: value || undefined })}
            aria-label="Filter by stage"
          />
          <Select
            options={[
              { value: "", label: "All statuses" },
              { value: "OPEN", label: "Open" },
              { value: "WON", label: "Won" },
              { value: "LOST", label: "Lost" },
            ]}
            value={query.status ?? ""}
            onChange={(value) => pushQuery({ status: value || undefined })}
            aria-label="Filter by status"
          />
          <Select
            options={[{ value: "", label: "All sources" }, ...data.filters.sources]}
            value={query.source ?? ""}
            onChange={(value) => pushQuery({ source: value || undefined })}
            aria-label="Filter by source"
          />
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="secondary" onClick={() => pushQuery({ q: searchDraft.trim() || undefined })}>
              Apply
            </Button>
            <Button variant="secondary" onClick={fetchData}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchDraft("");
                pushQuery({
                  scope: "all",
                  ownerId: undefined,
                  stageId: undefined,
                  status: undefined,
                  source: undefined,
                  q: undefined,
                });
              }}
              disabled={activeFilters === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 min-[1800px]:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.68fr)] min-[2200px]:grid-cols-[minmax(0,2.15fr)_minmax(420px,0.72fr)]">
        <div className="space-y-4">
          <QueueSection title="Due now" subtitle="Immediate callbacks, overdue tasks, and active conversations." items={data.sections.dueNow} emptyLabel="No urgent CRM work is waiting right now." onPrimaryAction={handlePrimaryAction} onOpen={handleOpen} formatHref={withReturnTo} workedCustomerId={workedCustomerId} workedOpportunityId={workedOpportunityId} />
          <QueueSection title="Stale prospects" subtitle="Leads with fading momentum that need a rep back in the record." items={data.sections.staleProspects} emptyLabel="No stale prospects in the current lens." onPrimaryAction={handlePrimaryAction} onOpen={handleOpen} formatHref={withReturnTo} workedCustomerId={workedCustomerId} workedOpportunityId={workedOpportunityId} />
          <QueueSection title="Pipeline blockers" subtitle="Open opportunities missing an owner, next action, or recent movement." items={data.sections.pipelineBlockers} emptyLabel="No pipeline blockers in the current lens." onPrimaryAction={handlePrimaryAction} onOpen={handleOpen} formatHref={withReturnTo} workedCustomerId={workedCustomerId} workedOpportunityId={workedOpportunityId} />
          <QueueSection title="Sequence exceptions" subtitle="Paused or failed automations that need manual attention." items={data.sections.sequenceExceptions} emptyLabel="No sequence exceptions are active." onPrimaryAction={handlePrimaryAction} onOpen={handleOpen} formatHref={withReturnTo} workedCustomerId={workedCustomerId} workedOpportunityId={workedOpportunityId} />
        </div>

        <div className="space-y-3">
          <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="flex items-center border-b border-[var(--border)] px-3 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Summary</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
              {[
                { label: "Overdue Tasks", value: data.pressure.overdueTasks },
                { label: "Callbacks Today", value: data.pressure.callbacksDueToday },
                { label: "Inbound Waiting", value: data.pressure.inboundWaiting },
                { label: "No Next Action", value: data.pressure.noNextAction },
                { label: "Failed Jobs", value: data.pressure.failedJobs },
              ].map((item) => (
                <div key={item.label} className="px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">{item.label}</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-[var(--text)]">{item.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
          <Widget compact title="Follow-up pressure" subtitle="Where CRM work is pooling before reps open a record.">
            <div className="space-y-3">
              {[
                { label: "Due now", count: data.kpis.dueNow, tone: "bg-amber-400" },
                { label: "Stale leads", count: data.kpis.staleProspects, tone: "bg-red-400" },
                { label: "Blockers", count: data.kpis.blockers, tone: "bg-sky-400" },
                { label: "Sequences", count: data.kpis.sequenceExceptions, tone: "bg-emerald-400" },
              ].map((row) => {
                const total = Math.max(data.kpis.dueNow + data.kpis.staleProspects + data.kpis.blockers + data.kpis.sequenceExceptions, 1);
                const width = row.count === 0 ? 0 : Math.max(2, Math.round((row.count / total) * 100));
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px] font-medium text-[var(--text)]">{row.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className={cn("h-full rounded-full", row.tone)} style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--muted-text)]">{row.count}</span>
                  </div>
                );
              })}
            </div>
          </Widget>
          <Widget compact title="Pipeline read" subtitle="Top stage concentration for quick manager visibility." footer={<Link href={opportunitiesWorkspaceHref} className="text-sm font-medium text-[var(--accent)] hover:underline">Open pipeline workspace</Link>}>
            <div className="space-y-3">
              {data.pipeline.stages.slice(0, 5).map((stage) => {
                const max = Math.max(highestStage?.count ?? 1, 1);
                const width = stage.count === 0 ? 0 : Math.max(2, Math.round((stage.count / max) * 100));
                return (
                  <div key={stage.stageId} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[13px] font-medium text-[var(--text)]">{stage.stageName}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--muted-text)]">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          </Widget>
          {(data.kpis.sequenceExceptions > 0 || data.pressure.failedJobs > 0) ? (
            <Widget compact title="Ops warnings" subtitle="Automation exceptions surfaced back into the daily CRM lens.">
              <div className="space-y-3 text-sm">
                {data.kpis.sequenceExceptions > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text)]">Sequence exceptions</span>
                    <Link href="/crm/sequences" className="font-medium text-[var(--accent)] hover:underline">
                      {data.kpis.sequenceExceptions} active
                    </Link>
                  </div>
                ) : null}
                {data.pressure.failedJobs > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text)]">Failed jobs</span>
                    <Link href="/crm/jobs" className="font-medium text-[var(--accent)] hover:underline">
                      {data.pressure.failedJobs} need review
                    </Link>
                  </div>
                ) : null}
              </div>
            </Widget>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
