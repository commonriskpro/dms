"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { QueueKpiStrip, QueueLayout, QueueTable } from "@/components/ui-system/queues";
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
import { widgetTokens } from "@/lib/ui/tokens";
import { typography } from "@/lib/ui/tokens";
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
      const d = await apiFetch<{ data: { processed: number; failed: number; deadLetter: number } }>("/api/crm/jobs/run", { method: "POST" });
      const result = d?.data;
      addToast("success", result ? `Processed: ${result.processed}, Failed: ${result.failed}` : "Worker run requested");
      fetchJobs();
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
      <QueueLayout
        title={<h1 className={typography.pageTitle}>CRM jobs queue</h1>}
        description="Background automation and sequence jobs."
        table={
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
          </div>
        }
      />
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
  const state = loading ? "loading" : error ? "error" : filtered.length === 0 ? "empty" : "default";

  return (
    <QueueLayout
      title={<h1 className={typography.pageTitle}>CRM jobs queue</h1>}
      description="Monitor async CRM jobs and trigger worker runs."
      actions={
        canWrite ? (
          <MutationButton onClick={handleRunWorker} disabled={runLoading}>
            {runLoading ? "Running…" : "Run worker now"}
          </MutationButton>
        ) : null
      }
      kpis={
        <>
          <QueueKpiStrip
            items={[
              { label: "Queued jobs", value: meta.total.toLocaleString(), hint: "Current page scope and filters" },
              { label: "Pending / running", value: `${pendingCount} / ${runningCount}`, hint: "Execution backlog and active work" },
              { label: "Failed / dead-letter", value: failedCount.toLocaleString(), hint: "Jobs requiring intervention" },
            ]}
          />
          <SignalQueueSummary items={queueSignals} />
        </>
      }
      filters={
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
      }
      preview={
        selectedJob ? (
          <section className={widgetTokens.widget}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)] mb-3">Job details</p>
            <div className="space-y-2 text-sm">
              <p><strong>ID:</strong> {selectedJob.id}</p>
              <p><strong>Status:</strong> {selectedJob.status}</p>
              <p><strong>Run at:</strong> {new Date(selectedJob.runAt).toLocaleString()}</p>
              <p><strong>Started at:</strong> {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : "—"}</p>
              <p><strong>Completed at:</strong> {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : "—"}</p>
              {selectedJob.errorMessage && (
                <p className="text-[var(--danger)]"><strong>Error:</strong> {selectedJob.errorMessage}</p>
              )}
              <p><strong>Payload (summary):</strong></p>
              <pre className="overflow-auto rounded bg-[var(--surface-2)] p-2 text-xs border border-[var(--border)]">
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>
          </section>
        ) : undefined
      }
      table={
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
                  <TableCell className={tableCellCompact}>{j.queueType}</TableCell>
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
      }
    />
  );
}
