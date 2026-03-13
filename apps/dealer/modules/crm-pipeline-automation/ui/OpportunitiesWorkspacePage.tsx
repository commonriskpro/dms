"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { StageColumn } from "./components/StageColumn";
import { buildCrmWorkspaceQuery, normalizeCrmScope, normalizeCrmView, type CrmOpportunityView, type CrmWorkspaceQuery } from "./query-state";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ApiDataResponse, ApiListResponse, Opportunity, Pipeline, Stage } from "./types";
import { opportunityStatusToVariant } from "./types";
import { customerDetailPath } from "@/lib/routes/detail-paths";
import { X } from "@/lib/ui/icons";
import {
  modalDepthFooterSubtle,
  modalDepthInteractive,
  modalDepthSurface,
  modalDepthSurfaceStrong,
  modalFieldTone,
} from "@/lib/ui/modal-depth";

type OpportunitiesWorkspacePageProps = {
  initialQuery?: CrmWorkspaceQuery;
  lockedView?: CrmOpportunityView;
};

const DEFAULT_PAGE_SIZE = 25;

function ageSince(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export function OpportunitiesWorkspacePage({
  initialQuery,
  lockedView,
}: OpportunitiesWorkspacePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, user } = useSession();
  const { addToast } = useToast();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const canReadMembers = hasPermission("admin.memberships.read");

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [owners, setOwners] = React.useState<SelectOption[]>([{ value: "", label: "All owners" }]);
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = React.useState<Opportunity | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<{ id: string; name: string }[]>([]);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createCustomerId, setCreateCustomerId] = React.useState("");
  const [createStageId, setCreateStageId] = React.useState("");
  const [createOwnerId, setCreateOwnerId] = React.useState("");
  const [createValueDollars, setCreateValueDollars] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState(initialQuery?.q ?? "");
  const [previewOwnerId, setPreviewOwnerId] = React.useState("");
  const [previewNextActionText, setPreviewNextActionText] = React.useState("");
  const [previewNextActionAt, setPreviewNextActionAt] = React.useState("");
  const [previewSaving, setPreviewSaving] = React.useState(false);

  const [query, setQuery] = React.useState<CrmWorkspaceQuery>({
    view: lockedView ?? normalizeCrmView(initialQuery?.view),
    scope: normalizeCrmScope(initialQuery?.scope),
    customerId: initialQuery?.customerId,
    pipelineId: initialQuery?.pipelineId,
    stageId: initialQuery?.stageId,
    ownerId: initialQuery?.ownerId,
    status: initialQuery?.status,
    source: initialQuery?.source,
    q: initialQuery?.q,
    page: initialQuery?.page ?? 1,
    pageSize: initialQuery?.pageSize ?? DEFAULT_PAGE_SIZE,
    sortBy: initialQuery?.sortBy ?? "updatedAt",
    sortOrder: initialQuery?.sortOrder ?? "desc",
  });

  const view = lockedView ?? normalizeCrmView(query.view);
  const scope = normalizeCrmScope(query.scope);

  const pushQuery = React.useCallback(
    (overrides: Partial<CrmWorkspaceQuery>) => {
      const next = {
        ...query,
        ...overrides,
        view: lockedView ?? overrides.view ?? query.view ?? "board",
      };
      setQuery(next);
      const qs = buildCrmWorkspaceQuery(next);
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [lockedView, pathname, query, router]
  );

  const effectivePipelineId = React.useMemo(() => {
    if (query.pipelineId) return query.pipelineId;
    return pipelines.find((pipeline) => pipeline.isDefault)?.id ?? pipelines[0]?.id ?? "";
  }, [pipelines, query.pipelineId]);

  const fetchPipelines = React.useCallback(async () => {
    const res = await apiFetch<ApiListResponse<Pipeline>>("/api/crm/pipelines?limit=100");
    setPipelines(res.data);
  }, []);

  const fetchStages = React.useCallback(async (pipelineId: string) => {
    if (!pipelineId) {
      setStages([]);
      return;
    }
    const res = await apiFetch<ApiDataResponse<Stage[]>>(`/api/crm/pipelines/${pipelineId}/stages`);
    setStages(res.data);
  }, []);

  const fetchOwners = React.useCallback(async () => {
    if (!canReadMembers) {
      setOwners([{ value: "", label: "All owners" }]);
      return;
    }
    const res = await apiFetch<{ data: { user: { id: string; fullName: string | null; email: string } }[] }>(
      "/api/admin/memberships?limit=100"
    );
    setOwners([
      { value: "", label: "All owners" },
      ...res.data.map((entry) => ({
        value: entry.user.id,
        label: entry.user.fullName ?? entry.user.email,
      })),
    ]);
  }, [canReadMembers]);

  const fetchOpportunities = React.useCallback(async () => {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;
    const limit = view === "board" ? 500 : pageSize;
    const offset = view === "board" ? 0 : (page - 1) * pageSize;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      sortBy: query.sortBy ?? "updatedAt",
      sortOrder: query.sortOrder ?? "desc",
      ...(view === "board" && effectivePipelineId ? { pipelineId: effectivePipelineId } : {}),
    });
    if (query.pipelineId && view !== "board") params.set("pipelineId", query.pipelineId);
    if (query.customerId) params.set("customerId", query.customerId);
    if (query.stageId) params.set("stageId", query.stageId);
    const scopedOwnerId = scope === "mine" ? user?.id ?? query.ownerId : query.ownerId;
    if (scopedOwnerId) params.set("ownerId", scopedOwnerId);
    if (query.status) params.set("status", query.status);
    if (query.source) params.set("source", query.source);
    if (query.q?.trim()) params.set("q", query.q.trim());

    const res = await apiFetch<ApiListResponse<Opportunity>>(`/api/crm/opportunities?${params.toString()}`);
    setOpportunities(res.data);
    setMeta(res.meta);
    setSelectedOpportunity((current) => res.data.find((row) => row.id === current?.id) ?? res.data[0] ?? null);
  }, [effectivePipelineId, query.customerId, query.ownerId, query.page, query.pageSize, query.pipelineId, query.q, query.sortBy, query.sortOrder, query.source, query.stageId, query.status, scope, user?.id, view]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchPipelines(), fetchOwners()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load CRM"))
      .finally(() => setLoading(false));
  }, [canRead, fetchOwners, fetchPipelines]);

  React.useEffect(() => {
    if (!canRead) return;
    fetchStages(effectivePipelineId).catch(() => setStages([]));
  }, [canRead, effectivePipelineId, fetchStages]);

  React.useEffect(() => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    fetchOpportunities()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load opportunities"))
      .finally(() => setLoading(false));
  }, [canRead, fetchOpportunities]);

  React.useEffect(() => {
    if (!selectedOpportunity) {
      setPreviewOwnerId("");
      setPreviewNextActionText("");
      setPreviewNextActionAt("");
      return;
    }
    setPreviewOwnerId(selectedOpportunity.ownerId ?? "");
    setPreviewNextActionText(selectedOpportunity.nextActionText ?? "");
    setPreviewNextActionAt(selectedOpportunity.nextActionAt ? new Date(selectedOpportunity.nextActionAt).toISOString().slice(0, 16) : "");
  }, [selectedOpportunity]);

  const persistViewPreference = React.useCallback(async (nextView: CrmOpportunityView) => {
    try {
      await apiFetch("/api/crm/opportunities/view-preference", {
        method: "PATCH",
        body: JSON.stringify({ view: nextView }),
      });
    } catch {
      // Preference persistence should not block navigation.
    }
  }, []);

  const handleViewChange = (nextView: CrmOpportunityView) => {
    void persistViewPreference(nextView);
    pushQuery({ view: nextView, page: 1 });
  };

  const handleQuickStatus = async (oppId: string, newStatus: "WON" | "LOST") => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/crm/opportunities/${oppId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "LOST" ? { lossReason: "Updated from pipeline workspace" } : {}),
        }),
      });
      addToast("success", "Opportunity updated");
      await fetchOpportunities();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleMoveStage = async (oppId: string, nextStageId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/crm/opportunities/${oppId}`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: nextStageId }),
      });
      addToast("success", "Stage updated");
      await fetchOpportunities();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handlePreviewSave = async () => {
    if (!canWrite || !selectedOpportunity) return;
    setPreviewSaving(true);
    try {
      await apiFetch(`/api/crm/opportunities/${selectedOpportunity.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ownerId: previewOwnerId || null,
          nextActionText: previewNextActionText || null,
          nextActionAt: previewNextActionAt ? new Date(previewNextActionAt).toISOString() : null,
        }),
      });
      addToast("success", "Opportunity updated");
      await fetchOpportunities();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setPreviewSaving(false);
    }
  };

  const openCreateModal = React.useCallback(async () => {
    if (!canWrite) return;
    setCreateOpen(true);
    setCreateCustomerId("");
    setCreateStageId(stages[0]?.id ?? "");
    setCreateOwnerId("");
    setCreateValueDollars("");
    const res = await apiFetch<{ data: { id: string; name: string }[] }>("/api/customers?limit=200");
    setCustomers(res.data ?? []);
  }, [canWrite, stages]);

  const handleCreateOpportunity = async () => {
    if (!canWrite || !createCustomerId || !createStageId) return;
    setCreateLoading(true);
    try {
      const cents = parseDollarsToCents(createValueDollars);
      await apiFetch("/api/crm/opportunities", {
        method: "POST",
        body: JSON.stringify({
          customerId: createCustomerId,
          stageId: createStageId,
          ownerId: createOwnerId || null,
          ...(cents ? { estimatedValueCents: String(cents) } : {}),
        }),
      });
      addToast("success", "Opportunity created");
      setCreateOpen(false);
      await fetchOpportunities();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setCreateLoading(false);
    }
  };

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={fetchOpportunities} />
      </PageShell>
    );
  }

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    { value: "OPEN", label: "Open" },
    { value: "WON", label: "Won" },
    { value: "LOST", label: "Lost" },
  ];
  const pipelineOptions: SelectOption[] = [{ value: "", label: view === "board" ? "Default pipeline" : "All pipelines" }, ...pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))];
  const stageOptions: SelectOption[] = [{ value: "", label: "All stages" }, ...stages.map((stage) => ({ value: stage.id, label: stage.name }))];
  const sourceOptions: SelectOption[] = [{ value: "", label: "All sources" }, ...Array.from(new Set(opportunities.map((opp) => opp.source).filter(Boolean))).map((source) => ({ value: source!, label: source! }))];
  const customerOptions: SelectOption[] = [{ value: "", label: "Select customer" }, ...customers.map((customer) => ({ value: customer.id, label: customer.name }))];

  const missingOwnerCount = opportunities.filter((opp) => !opp.ownerId).length;
  const missingNextActionCount = opportunities.filter((opp) => !opp.nextActionText || !opp.nextActionAt).length;
  const staleCount = opportunities.filter((opp) => Date.now() - new Date(opp.updatedAt).getTime() > 3 * 86_400_000).length;
  const groupedByStage = stages.map((stage) => ({
    stage,
    opportunities: opportunities.filter((opp) => opp.stageId === stage.id),
    totalValueCents: opportunities
      .filter((opp) => opp.stageId === stage.id)
      .reduce((sum, opp) => sum + (opp.estimatedValueCents ? Number(opp.estimatedValueCents) : 0), 0),
  }));

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col space-y-4 min-[1800px]:space-y-5"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">CRM pipeline workspace</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">Live opportunities</h1>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">Shared board and list</span>
            </div>
          </div>
        }
        description="Run stage movement and queue-based follow-up from one route. Filters stay intact while you switch views."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
              <button type="button" onClick={() => handleViewChange("board")} className={cn("rounded-full px-3 py-1 text-[11px] font-medium transition-colors", view === "board" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--muted-text)] hover:text-[var(--text)]")}>
                Board
              </button>
              <button type="button" onClick={() => handleViewChange("list")} className={cn("rounded-full px-3 py-1 text-[11px] font-medium transition-colors", view === "list" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--muted-text)] hover:text-[var(--text)]")}>
                List
              </button>
            </div>
            {canWrite ? (
              <WriteGuard>
                <Button onClick={() => void openCreateModal()} disabled={writeDisabled}>New opportunity</Button>
              </WriteGuard>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Open Pipeline" value={meta.total.toLocaleString()} sub="rows in current lens" color="blue" trend={[meta.total || 1, meta.total || 1]} />
        <KpiCard label="Missing Owner" value={missingOwnerCount.toLocaleString()} sub="assignment blockers" color="amber" accentValue={missingOwnerCount > 0} hasUpdate={missingOwnerCount > 0} trend={[missingOwnerCount || 1, missingOwnerCount || 1]} />
        <KpiCard label="No Next Action" value={missingNextActionCount.toLocaleString()} sub="needs a follow-up commitment" color="violet" accentValue={missingNextActionCount > 0} hasUpdate={missingNextActionCount > 0} trend={[missingNextActionCount || 1, missingNextActionCount || 1]} />
        <KpiCard label="Stale Movement" value={staleCount.toLocaleString()} sub="older than 3 days" color="cyan" trend={[staleCount || 1, staleCount || 1]} />
        <KpiCard label="Scope" value={scope === "mine" ? "Mine" : scope === "team" ? "Team" : "All"} sub="current execution lens" color="green" trend={[1, 1]} />
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={scope === "all" ? "primary" : "secondary"} size="sm" onClick={() => pushQuery({ scope: "all", page: 1 })}>All</Button>
            <Button variant={scope === "mine" ? "primary" : "secondary"} size="sm" onClick={() => pushQuery({ scope: "mine", page: 1 })}>My pipeline</Button>
            <Button variant={scope === "team" ? "primary" : "secondary"} size="sm" onClick={() => pushQuery({ scope: "team", page: 1 })}>Team</Button>
            {query.customerId ? (
              <span className="inline-flex h-8 items-center rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-3 text-[12px] font-medium text-[var(--accent)]">
                Customer scoped
              </span>
            ) : null}
            {query.customerId ? (
              <Button variant="secondary" size="sm" onClick={() => pushQuery({ customerId: undefined, page: 1 })}>
                Clear customer
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(300px,1.45fr)_repeat(5,minmax(0,1fr))]">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") pushQuery({ q: searchDraft.trim() || undefined, page: 1 });
              }}
              placeholder="Search customer, source, or next action"
              aria-label="Search opportunities"
            />
            <Select options={pipelineOptions} value={query.pipelineId ?? ""} onChange={(value) => pushQuery({ pipelineId: value || undefined, stageId: undefined, page: 1 })} aria-label="Filter by pipeline" />
            <Select options={stageOptions} value={query.stageId ?? ""} onChange={(value) => pushQuery({ stageId: value || undefined, page: 1 })} aria-label="Filter by stage" />
            <Select options={owners} value={query.ownerId ?? ""} onChange={(value) => pushQuery({ ownerId: value || undefined, page: 1 })} aria-label="Filter by owner" />
            <Select options={statusOptions} value={query.status ?? ""} onChange={(value) => pushQuery({ status: value || undefined, page: 1 })} aria-label="Filter by status" />
            <Select options={sourceOptions} value={query.source ?? ""} onChange={(value) => pushQuery({ source: value || undefined, page: 1 })} aria-label="Filter by source" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 min-[1800px]:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.68fr)] min-[2200px]:grid-cols-[minmax(0,2.15fr)_minmax(420px,0.72fr)]">
        <div className="space-y-3">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : opportunities.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
              <EmptyState title="No opportunities" description="Adjust filters or create a new opportunity to populate the workspace." />
            </div>
          ) : view === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {groupedByStage.map(({ stage, opportunities: stageRows, totalValueCents }) => (
                <StageColumn key={stage.id} stage={stage} opportunities={stageRows} totalValueCents={totalValueCents} onMoveStage={handleMoveStage} stages={stages} canWrite={canWrite} writeDisabled={writeDisabled} onOpenOpportunity={(id) => router.push(`/crm/opportunities/${id}`)} />
              ))}
            </div>
          ) : (
            <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--text)]">Pipeline list</h2>
                  <p className="mt-1 text-sm text-[var(--muted-text)]">Queue mode for fast review, status changes, and quick handoffs.</p>
                </div>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">{meta.total.toLocaleString()} results</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id} className="cursor-pointer" onClick={() => setSelectedOpportunity(opp)}>
                      <TableCell>
                        <div>
                          <Link href={`/crm/opportunities/${opp.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">{opp.customer?.name ?? opp.customerId.slice(0, 8)}</Link>
                          <p className="text-xs text-[var(--muted-text)]">{opp.vehicle ? [opp.vehicle.year, opp.vehicle.make, opp.vehicle.model].filter(Boolean).join(" ") : opp.source ?? "No vehicle linked"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{opp.stage?.name ?? "—"}</TableCell>
                      <TableCell>{opp.owner?.fullName ?? opp.owner?.email ?? "Unassigned"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm text-[var(--text)]">{opp.nextActionText ?? "No next action set"}</p>
                          <p className="text-xs text-[var(--muted-text)]">{opp.nextActionAt ? new Date(opp.nextActionAt).toLocaleString() : "No due date"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{opp.estimatedValueCents ? formatCents(opp.estimatedValueCents) : "—"}</TableCell>
                      <TableCell>{ageSince(opp.updatedAt)}</TableCell>
                      <TableCell><StatusBadge variant={opportunityStatusToVariant(opp.status)}>{opp.status}</StatusBadge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canWrite ? (
                            <>
                              <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); handleQuickStatus(opp.id, "WON"); }}>Won</Button>
                              <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); handleQuickStatus(opp.id, "LOST"); }}>Lost</Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-[var(--border)] px-4 py-3">
                <Pagination meta={meta} onPageChange={(offset) => pushQuery({ page: Math.floor(offset / (query.pageSize ?? DEFAULT_PAGE_SIZE)) + 1 })} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Widget compact title="Quick preview" subtitle="Inspect the current opportunity without leaving the queue.">
            {!selectedOpportunity ? (
              <div className="py-4 text-sm text-[var(--muted-text)]">Select an opportunity to inspect owner, value, and next action context.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Link href={`/crm/opportunities/${selectedOpportunity.id}`} className="text-base font-semibold text-[var(--text)] hover:text-[var(--accent)]">{selectedOpportunity.customer?.name ?? selectedOpportunity.customerId.slice(0, 8)}</Link>
                  <p className="mt-1 text-sm text-[var(--muted-text)]">{selectedOpportunity.stage?.name ?? "Unknown stage"} · {selectedOpportunity.source ?? "No source"} · {selectedOpportunity.vehicle ? [selectedOpportunity.vehicle.year, selectedOpportunity.vehicle.make, selectedOpportunity.vehicle.model].filter(Boolean).join(" ") : "No vehicle"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Value</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedOpportunity.estimatedValueCents ? formatCents(selectedOpportunity.estimatedValueCents) : "—"}</p>
                  </div>
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Age</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">{ageSince(selectedOpportunity.updatedAt)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Select options={owners} value={previewOwnerId} onChange={setPreviewOwnerId} aria-label="Assign owner from preview" />
                  <Input value={previewNextActionText} onChange={(event) => setPreviewNextActionText(event.target.value)} placeholder="Next action text" aria-label="Next action text" />
                  <Input type="datetime-local" value={previewNextActionAt} onChange={(event) => setPreviewNextActionAt(event.target.value)} aria-label="Next action due time" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={customerDetailPath(selectedOpportunity.customerId)}><Button size="sm" variant="secondary">Customer</Button></Link>
                  <Link href={`/crm/inbox?customerId=${encodeURIComponent(selectedOpportunity.customerId)}`}><Button size="sm" variant="secondary">Inbox</Button></Link>
                  <Link href={`/crm/opportunities/${selectedOpportunity.id}`}><Button size="sm" variant="secondary">Full detail</Button></Link>
                  {canWrite ? <Button size="sm" onClick={handlePreviewSave} disabled={previewSaving}>{previewSaving ? "Saving…" : "Save quick edits"}</Button> : null}
                </div>
              </div>
            )}
          </Widget>
          <Widget compact title="Execution notes" subtitle="Use the preview rail for quick ownership and next-step maintenance.">
            <div className="space-y-2 text-sm text-[var(--muted-text)]">
              <p>Board mode is optimized for stage movement and manager visibility.</p>
              <p>List mode is optimized for reps working a queue and updating follow-up commitments.</p>
              <p>Route state is shared across both views, so filters stay intact while you switch.</p>
            </div>
          </Widget>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        contentClassName="relative z-50 w-full max-w-[1120px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-[color:rgba(148,163,184,0.18)] bg-[color-mix(in_srgb,var(--surface)_92%,rgba(10,20,38,0.72))] p-0 shadow-[0_24px_72px_rgba(2,8,23,0.34)] backdrop-blur"
      >
        <DialogContent>
          <div className="flex min-h-0 flex-col">
            <DialogHeader className="px-6 pb-4 pt-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
                    Pipeline intake
                  </p>
                  <DialogTitle className="text-[2rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    Create opportunity
                  </DialogTitle>
                  <p className="max-w-2xl text-sm text-[var(--muted-text)]">
                    Create the opportunity with the customer, initial stage, and owner context the team needs to work it immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.025)] text-[var(--muted-text)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]"
                  aria-label="Close create opportunity modal"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </DialogHeader>

            <div className="space-y-5 px-6 pb-6 pt-2 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`${modalDepthSurfaceStrong} rounded-[24px] px-4 py-3`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Customer</p>
                  <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                    {createCustomerId ? "Selected" : "Open"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    {createCustomerId ? "Ready to create" : "Choose who this opportunity belongs to"}
                  </p>
                </div>
                <div className={`${modalDepthSurfaceStrong} rounded-[24px] px-4 py-3`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Stage</p>
                  <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                    {stageOptions.filter((option) => option.value).find((option) => option.value === createStageId)?.label ?? "Unset"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">Initial pipeline position</p>
                </div>
                <div className={`${modalDepthSurface} rounded-[24px] px-4 py-3`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Owner</p>
                  <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                    {owners.find((option) => option.value === createOwnerId)?.label ?? "Unassigned"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">Who works the next step</p>
                </div>
                <div className={`${modalDepthSurface} rounded-[24px] px-4 py-3`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Estimated value</p>
                  <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                    {createValueDollars.trim() ? `$${createValueDollars}` : "$0.00"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">Initial desk estimate</p>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <section className={`${modalDepthSurface} rounded-[26px] px-5 py-5`}>
                  <div className="mb-5 flex items-end justify-between gap-4 border-b border-[color:rgba(148,163,184,0.14)] pb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Core setup</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Customer and stage</h3>
                    </div>
                    <p className="max-w-[300px] text-sm text-[var(--muted-text)]">Set the opportunity owner and first stage before it enters the queue.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Customer</Label>
                      <Select
                        options={customerOptions}
                        value={createCustomerId}
                        onChange={setCreateCustomerId}
                        className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Stage</Label>
                        <Select
                          options={stageOptions.filter((option) => option.value)}
                          value={createStageId}
                          onChange={setCreateStageId}
                          className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                        />
                      </div>
                      <div>
                        <Label>Owner</Label>
                        <Select
                          options={owners}
                          value={createOwnerId}
                          onChange={setCreateOwnerId}
                          className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className={`${modalDepthSurface} rounded-[26px] px-5 py-5`}>
                  <div className="mb-5 flex items-end justify-between gap-4 border-b border-[color:rgba(148,163,184,0.14)] pb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Commercial view</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Value posture</h3>
                    </div>
                    <p className="max-w-[280px] text-sm text-[var(--muted-text)]">Optional estimate to give the desk and pipeline widgets a starting number.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Estimated value</Label>
                      <Input
                        value={createValueDollars}
                        onChange={(event) => setCreateValueDollars(event.target.value)}
                        placeholder="0.00"
                        className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                      />
                    </div>
                    <div className={`${modalDepthInteractive} rounded-[20px] px-4 py-4`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Creation posture</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                          {createCustomerId ? "Customer set" : "Customer missing"}
                        </span>
                        <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                          {createStageId ? "Stage set" : "Stage missing"}
                        </span>
                        <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                          {createOwnerId ? "Owner assigned" : "Owner open"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <DialogFooter className={`sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-[color:rgba(148,163,184,0.12)] px-6 py-4 sm:px-7 ${modalDepthFooterSubtle}`}>
              <div className="min-w-0">
                <p className="text-sm text-[var(--text)]">The opportunity is created only when you submit.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {createCustomerId ? "Customer set" : "Customer missing"}
                  </span>
                  <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {createStageId ? "Stage set" : "Stage missing"}
                  </span>
                  <span className="rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {createOwnerId ? "Owner assigned" : "Owner open"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateOpportunity} disabled={createLoading || !createCustomerId || !createStageId}>
                  {createLoading ? "Creating…" : "Create opportunity"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
