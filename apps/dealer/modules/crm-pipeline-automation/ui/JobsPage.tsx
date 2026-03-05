"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/pagination";
import type { Job, ApiListResponse } from "./types";
import { shouldFetchCrm } from "./crm-guards";

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
  const [appliedStatus, setAppliedStatus] = React.useState("");
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [runLoading, setRunLoading] = React.useState(false);

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
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => { setError(null); setLoading(true); fetchJobs().finally(() => setLoading(false)); }}
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

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text)]">Jobs</h1>
        <div className="flex items-center gap-2">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button variant="secondary" onClick={() => setAppliedStatus(statusFilter)}>Apply</Button>
          {canWrite && (
            <MutationButton onClick={handleRunWorker} disabled={runLoading}>
              {runLoading ? "Running…" : "Run worker now"}
            </MutationButton>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="rounded-md border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run at</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Retries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedJob(selectedJob?.id === j.id ? null : j)}
                  >
                    <TableCell>{j.queueType}</TableCell>
                    <TableCell>
                    <StatusBadge variant={jobStatusToVariant(j.status)}>{j.status}</StatusBadge>
                  </TableCell>
                    <TableCell>{new Date(j.runAt).toLocaleString()}</TableCell>
                    <TableCell>{new Date(j.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{j.retryCount} / {j.maxRetries}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedJob && (
            <Card>
              <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>ID:</strong> {selectedJob.id}</p>
                <p><strong>Status:</strong> {selectedJob.status}</p>
                <p><strong>Run at:</strong> {new Date(selectedJob.runAt).toLocaleString()}</p>
                <p><strong>Started at:</strong> {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : "—"}</p>
                <p><strong>Completed at:</strong> {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : "—"}</p>
                {selectedJob.errorMessage && (
                  <p className="text-[var(--danger)]"><strong>Error:</strong> {selectedJob.errorMessage}</p>
                )}
                <p><strong>Payload (summary):</strong></p>
                <pre className="overflow-auto rounded bg-[var(--muted)] p-2 text-xs">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {jobs.length === 0 && <EmptyState title="No jobs" description="Jobs will appear when automations or sequences run." />}
          <Pagination meta={meta} onPageChange={(o) => setMeta((m) => ({ ...m, offset: o }))} />
        </>
      )}
    </div>
  );
}
