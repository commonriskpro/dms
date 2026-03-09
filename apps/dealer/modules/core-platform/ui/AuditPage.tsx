"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import type { AuditListResponse, AuditLogResponse } from "@/lib/types/audit";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

function toISOStart(date: string): string {
  return new Date(date + "T00:00:00.000Z").toISOString();
}

function toISOEnd(date: string): string {
  return new Date(date + "T23:59:59.999Z").toISOString();
}

function MetadataCell({ metadata }: { metadata: unknown }) {
  const [expanded, setExpanded] = React.useState(false);
  const str = metadata == null ? "" : JSON.stringify(metadata, null, 2);
  if (!str) return <span className="text-[var(--text-soft)]">—</span>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-sm text-[var(--accent)] hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
      {expanded && (
        <pre className="mt-1 text-xs bg-[var(--muted)] p-2 rounded overflow-x-auto max-w-md">
          {str}
        </pre>
      )}
    </div>
  );
}

export function AuditPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("admin.audit.read");

  const [data, setData] = React.useState<AuditLogResponse[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionFilter, setActionFilter] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [applied, setApplied] = React.useState({
    action: "",
    entity: "",
    from: "",
    to: "",
  });

  const fetchAudit = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
    });
    if (applied.action) params.set("action", applied.action);
    if (applied.entity) params.set("entity", applied.entity);
    if (applied.from) params.set("from", toISOStart(applied.from));
    if (applied.to) params.set("to", toISOEnd(applied.to));
    const res = await apiFetch<AuditListResponse>(`/api/audit?${params}`);
    setData(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, applied.action, applied.entity, applied.from, applied.to]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAudit().catch((e) => setError(e instanceof Error ? e.message : "Failed to load")).finally(() => setLoading(false));
  }, [canRead, fetchAudit]);

  const applyFilters = () => {
    setApplied({
      action: actionFilter,
      entity: entityFilter,
      from: fromDate,
      to: toDate,
    });
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Audit Log" description="View activity and changes." />
        <p className="mt-2 text-[var(--text-soft)]">You don’t have permission to view this page.</p>
      </PageShell>
    );
  }

  if (loading && data.length === 0) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (error && data.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Audit Log" description="View activity and changes." />
        <ErrorState message={error} onRetry={fetchAudit} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Audit Log" description="View activity and changes." />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Input
              label="Action"
              placeholder="e.g. membership.role_changed"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="max-w-xs"
            />
            <Input
              label="Entity"
              placeholder="e.g. Membership"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="max-w-xs"
            />
            <div>
              <label className="block text-sm font-medium mb-1">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={applyFilters}>
                Apply
              </Button>
            </div>
          </div>

          {data.length === 0 ? (
            <EmptyState title="No audit entries" description="No entries match your filters." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.entity}</TableCell>
                      <TableCell className="font-mono text-xs">{row.entityId ?? "—"}</TableCell>
                      <TableCell>
                        <MetadataCell metadata={row.metadata} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta.total > meta.limit && (
                <Pagination
                  meta={meta}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                  className="mt-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
