"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import {
  ColumnHeader,
  RowActions,
  TableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-system/tables";
import { QueueTable } from "@/components/ui-system/queues";
import { SignalQueueSummary, type SignalSurfaceItem } from "@/components/ui-system/signals";
import { Select, type SelectOption } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/pagination";
import {
  tableHeaderRow,
  tableHeadCellCompact,
  tableCellCompact,
  tableRowHover,
  tableRowCompact,
} from "@/lib/ui/recipes/table";
import { cn } from "@/lib/utils";
import type { Job, ApiListResponse } from "./types";
import { shouldFetchCrm } from "./crm-guards";
import { fetchDomainSignals, toQueueSignals } from "@/modules/intelligence/ui/surface-adapters";

const LIMIT = 25;
const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "dead_letter", label: "Dead letter" },
];

export function JobsPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();

  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [appliedStatus, setAppliedStatus] = React.useState("");
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [runLoading, setRunLoading] = React.useState(false);
  const [queueSignals, setQueueSignals] = React.useState<SignalSurfaceItem[]>([]);

  const fetchJobs = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    if (appliedStatus) params.set("status", appliedStatus);
    const res = await apiFetch<ApiListResponse<Job>>(`/api/crm/jobs?${params}`);
    setJobs(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, appliedStatus]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchJobs().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, [canRead, meta.offset, appliedStatus, fetchJobs]);

  React.useEffect(() => {
    let mounted = true;
    fetchDomainSignals({ domain: "crm", limit: 20 })
      .then((signals) => {
        if (!mounted) return;
        setQueueSignals(toQueueSignals(signals, { maxVisible: 4 }));
      })
      .catch(() => {
        if (!mounted) return;
        setQueueSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRunWorker = async () => {
    if (!canWrite) return;
    setRunLoading(true);
    try {
      await apiFetch<{ data: { enqueued: boolean } }>("/api/crm/jobs/run", { method: "POST" });
      addToast("success", "CRM worker run queued");
      void fetchJobs();
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status === 403) addToast("error", "Not allowed to run worker");
      else if (err.status === 429) addToast("error", "Rate limited — try again soon");
      else addToast("error", getApiErrorMessage(e));
    } finally {
      setRunLoading(false);
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

  const jobStatusToVariant = (s: Job["status"]): "info" | "success" | "warning" | "danger" | "neutral" => {
    if (s === "pending") return "neutral";
    if (s === "running") return "info";
    if (s === "completed") return "success";
    if (s === "failed") return "warning";
    if (s === "dead_letter") return "danger";
    return "neutral";
  };

  const filtered = jobs.filter((job) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      job.queueType.toLowerCase().includes(q) ||
      job.id.toLowerCase().includes(q) ||
      job.status.toLowerCase().includes(q)
    );
  });
  const pendingCount = jobs.filter((job) => job.status === "pending").length;
  const runningCount = jobs.filter((job) => job.status === "running").length;
  const failedCount = jobs.filter((job) => job.status === "failed" || job.status === "dead_letter").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const state = loading ? "loading" : error ? "error" : filtered.length === 0 ? "empty" : "default";

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10"
      className="flex flex-col space-y-4"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Automation center
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
              CRM jobs
            </h1>
          </div>
        }
        description="Monitor background execution, retry pressure, and worker health without turning jobs into a rep-facing workflow."
        actions={
          canWrite ? (
            <MutationButton onClick={handleRunWorker} disabled={runLoading}>
              {runLoading ? "Queueing…" : "Queue worker run"}
            </MutationButton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Visible jobs" value={meta.total.toLocaleString()} sub="current page scope and filters" color="blue" trend={[meta.total || 1, meta.total || 1]} />
        <KpiCard label="Pending / running" value={`${pendingCount} / ${runningCount}`} sub="backlog and active execution" color="cyan" trend={[pendingCount + runningCount || 1, pendingCount + runningCount || 1]} />
        <KpiCard label="Failed / dead-letter" value={failedCount.toLocaleString()} sub="needs manual review" color="amber" accentValue={failedCount > 0} hasUpdate={failedCount > 0} trend={[failedCount || 1, failedCount || 1]} />
        <KpiCard label="Completed" value={completedCount.toLocaleString()} sub="successful runs in current lens" color="green" trend={[completedCount || 1, completedCount || 1]} />
      </div>

      <SignalQueueSummary items={queueSignals} />

      <div className="grid gap-4 min-[1600px]:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.82fr)]">
        <div className="space-y-4">
          <TableToolbar
            search={(
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queue type, status, or job id"
                aria-label="Search jobs queue"
              />
            )}
            filters={(
              <div className="flex items-center gap-2">
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <Button variant="secondary" onClick={() => setAppliedStatus(statusFilter)}>Apply</Button>
              </div>
            )}
          />

          <QueueTable
            state={state}
            errorMessage={error ?? undefined}
            onRetry={() => { setError(null); setLoading(true); fetchJobs().finally(() => setLoading(false)); }}
            emptyTitle="No jobs"
            emptyDescription="Jobs appear when automations or sequences run."
            pagination={<Pagination meta={meta} onPageChange={(o) => setMeta((m) => ({ ...m, offset: o }))} />}
          >
            <Table>
              <TableHeader>
                <TableRow className={tableHeaderRow}>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Queue</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Status</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Run at</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Created</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Retries</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((j) => (
                  <TableRow
                    key={j.id}
                    className={cn(tableRowHover, tableRowCompact)}
                    onClick={() => setSelectedJob(selectedJob?.id === j.id ? null : j)}
                  >
                    <TableCell className={tableCellCompact}>
                      <div>
                        <p className="font-medium text-[var(--text)]">{j.queueType}</p>
                        <p className="mt-1 text-xs text-[var(--muted-text)]">{j.id.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell className={tableCellCompact}>
                      <StatusBadge variant={jobStatusToVariant(j.status)}>{j.status}</StatusBadge>
                    </TableCell>
                    <TableCell className={tableCellCompact}>{new Date(j.runAt).toLocaleString()}</TableCell>
                    <TableCell className={tableCellCompact}>{new Date(j.createdAt).toLocaleString()}</TableCell>
                    <TableCell className={tableCellCompact}>{j.retryCount} / {j.maxRetries}</TableCell>
                    <TableCell className={tableCellCompact}>
                      <RowActions>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(selectedJob?.id === j.id ? null : j);
                          }}
                        >
                          {selectedJob?.id === j.id ? "Hide" : "Inspect"}
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueueTable>
        </div>

        <div className="space-y-3">
          <Widget compact title="Job details" subtitle="Inspect the selected execution record without opening raw worker logs.">
            {selectedJob ? (
              <div className="space-y-2 text-sm">
                <p><strong>ID:</strong> {selectedJob.id}</p>
                <p><strong>Status:</strong> {selectedJob.status}</p>
                <p><strong>Run at:</strong> {new Date(selectedJob.runAt).toLocaleString()}</p>
                <p><strong>Started at:</strong> {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : "—"}</p>
                <p><strong>Completed at:</strong> {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : "—"}</p>
                {selectedJob.errorMessage ? (
                  <p className="text-[var(--danger)]"><strong>Error:</strong> {selectedJob.errorMessage}</p>
                ) : null}
                <p><strong>Payload (summary):</strong></p>
                <pre className="overflow-auto rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="py-4 text-sm text-[var(--muted-text)]">Select a job to inspect worker timing, retries, and payload context.</div>
            )}
          </Widget>

          <Widget compact title="Ops guidance" subtitle="How this page fits the redesigned CRM workflow.">
            <div className="space-y-2 text-sm text-[var(--muted-text)]">
              <p>Failed and dead-letter jobs are exceptions for ops/admin review, not daily rep work.</p>
              <p>Worker runs should be queued deliberately when the backlog is stuck or after a deployment/config fix.</p>
              <p>When job failures affect active reps, summarize the issue back in command center instead of sending them here.</p>
            </div>
          </Widget>
        </div>
      </div>
    </PageShell>
  );
}
