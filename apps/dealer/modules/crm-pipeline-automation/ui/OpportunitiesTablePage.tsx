"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import type {
  Opportunity,
  Pipeline,
  Stage,
  ApiListResponse,
  ApiDataResponse,
} from "./types";
import { formatCents } from "@/lib/money";
import { shouldFetchCrm } from "./crm-guards";

const DEBOUNCE_MS = 300;
const LIMIT = 25;

export function OpportunitiesTablePage() {
  const router = useRouter();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();

  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [pipelineId, setPipelineId] = React.useState("");
  const [stageId, setStageId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [appliedFilters, setAppliedFilters] = React.useState({
    pipelineId: "",
    stageId: "",
    status: "",
  });
  const [searchInput, setSearchInput] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchApplied(searchInput.trim());
      setMeta((m) => ({ ...m, offset: 0 }));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const fetchPipelines = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const res = await apiFetch<ApiListResponse<Pipeline>>("/api/crm/pipelines?limit=100");
    setPipelines(res.data);
  }, [canRead]);

  const fetchStages = React.useCallback(
    async (pid: string) => {
      if (!shouldFetchCrm(canRead) || !pid) return;
      const res = await apiFetch<ApiDataResponse<Stage[]>>(
        `/api/crm/pipelines/${pid}/stages`
      );
      setStages(res.data);
    },
    [canRead]
  );

  const fetchOpportunities = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
    });
    if (appliedFilters.pipelineId) params.set("pipelineId", appliedFilters.pipelineId);
    if (appliedFilters.stageId) params.set("stageId", appliedFilters.stageId);
    if (appliedFilters.status) params.set("status", appliedFilters.status);
    const res = await apiFetch<ApiListResponse<Opportunity>>(
      `/api/crm/opportunities?${params}`
    );
    setOpportunities(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, appliedFilters]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchPipelines().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [canRead, fetchPipelines]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) return;
    fetchStages(appliedFilters.pipelineId || pipelineId);
  }, [canRead, appliedFilters.pipelineId, pipelineId, fetchStages]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) return;
    setLoading(true);
    fetchOpportunities().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, [canRead, meta.offset, appliedFilters, fetchOpportunities]);

  const handleApplyFilters = () => {
    setAppliedFilters({ pipelineId, stageId, status });
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const filteredBySearch = React.useMemo(() => {
    if (!searchApplied) return opportunities;
    const lower = searchApplied.toLowerCase();
    return opportunities.filter(
      (o) =>
        o.customer?.name?.toLowerCase().includes(lower)
    );
  }, [opportunities, searchApplied]);

  const handleQuickStatus = React.useCallback(
    async (oppId: string, newStatus: "WON" | "LOST") => {
      if (!canWrite) return;
      try {
        await apiFetch(`/api/crm/opportunities/${oppId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        addToast("success", "Status updated");
        fetchOpportunities();
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      }
    },
    [canWrite, addToast, fetchOpportunities]
  );

  const handleMoveStage = React.useCallback(
    async (oppId: string, toStageId: string) => {
      if (!canWrite) return;
      try {
        await apiFetch(`/api/crm/opportunities/${oppId}`, {
          method: "PATCH",
          body: JSON.stringify({ stageId: toStageId }),
        });
        addToast("success", "Stage updated");
        fetchOpportunities();
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      }
    },
    [canWrite, addToast, fetchOpportunities]
  );

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          fetchOpportunities().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
        }}
      />
    );
  }

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    { value: "OPEN", label: "Open" },
    { value: "WON", label: "Won" },
    { value: "LOST", label: "Lost" },
  ];

  const pipelineOptions: SelectOption[] = [
    { value: "", label: "All pipelines" },
    ...pipelines.map((p) => ({ value: p.id, label: p.name })),
  ];

  const stageOptions: SelectOption[] = [
    { value: "", label: "All stages" },
    ...stages.map((s) => ({ value: s.id, label: s.name })),
  ];

  const statusBadge = (s: Opportunity["status"]) => {
    const c =
      s === "OPEN"
        ? "bg-blue-100 text-blue-800"
        : s === "WON"
          ? "bg-green-100 text-green-800"
          : "bg-[var(--muted)] text-[var(--text-soft)]";
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">Opportunities</h1>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search by customer name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
          aria-label="Search by customer name"
        />
        <Select
          label="Pipeline"
          options={pipelineOptions}
          value={pipelineId}
          onChange={setPipelineId}
        />
        <Select
          label="Stage"
          options={stageOptions}
          value={stageId}
          onChange={setStageId}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={status}
          onChange={setStatus}
        />
        <Button onClick={handleApplyFilters}>Apply</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="rounded-md border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Assigned</TableHead>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBySearch.map((opp) => (
                  <TableRow
                    key={opp.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/crm/opportunities/${opp.id}`)}
                  >
                    <TableCell className="font-medium">
                      {opp.customer?.name ?? opp.customerId.slice(0, 8)}
                    </TableCell>
                    <TableCell>{opp.stage?.name ?? "—"}</TableCell>
                    <TableCell>{statusBadge(opp.status)}</TableCell>
                    <TableCell>
                      {opp.estimatedValueCents
                        ? formatCents(opp.estimatedValueCents)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {opp.owner?.fullName ?? opp.owner?.email ?? "—"}
                    </TableCell>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <WriteGuard>
                          <div className="flex gap-2">
                            {opp.status === "OPEN" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={writeDisabled}
                                  onClick={() => handleQuickStatus(opp.id, "WON")}
                                >
                                  Won
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={writeDisabled}
                                  onClick={() => handleQuickStatus(opp.id, "LOST")}
                                >
                                  Lost
                                </Button>
                              </>
                            )}
                            {stages.length > 0 && (
                              <select
                                aria-label="Move to stage"
                                value=""
                                disabled={writeDisabled}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v) handleMoveStage(opp.id, v);
                                  e.target.value = "";
                                }}
                                className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-xs"
                              >
                                <option value="">Move…</option>
                                {stages
                                  .filter((s) => s.id !== opp.stageId)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        </WriteGuard>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredBySearch.length === 0 && (
            <EmptyState
              title="No opportunities"
              description={searchApplied ? "No match for your search." : "Create one from the board."}
            />
          )}

          <Pagination
            meta={meta}
            onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
          />
        </>
      )}
    </div>
  );
}
