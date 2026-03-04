"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
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
import { Select, type SelectOption } from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import type { DealListItem, DealStatus } from "./types";
import { DEAL_STATUS_OPTIONS } from "./types";

type DealsListResponse = {
  data: DealListItem[];
  meta: { total: number; limit: number; offset: number };
};

function vehicleDisplay(v: DealListItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || v.id.slice(0, 8);
}

function customerDisplay(d: DealListItem): string {
  if (d.customer?.name) return d.customer.name;
  return d.customerId.slice(0, 8);
}

function statusBadgeClass(status: DealStatus): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ";
  switch (status) {
    case "DRAFT":
      return base + "bg-[var(--muted)] text-[var(--text-soft)]";
    case "STRUCTURED":
      return base + "bg-blue-100 text-blue-800";
    case "APPROVED":
      return base + "bg-amber-100 text-amber-800";
    case "CONTRACTED":
      return base + "bg-green-100 text-green-800";
    case "CANCELED":
      return base + "bg-red-100 text-red-800";
    default:
      return base + "bg-[var(--muted)]";
  }
}

export function DealsListPage() {
  const router = useRouter();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("deals.read");
  const canWrite = hasPermission("deals.write");

  const [deals, setDeals] = React.useState<DealListItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [appliedStatus, setAppliedStatus] = React.useState<string>("");

  const fetchDeals = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
    });
    if (appliedStatus) params.set("status", appliedStatus);
    const res = await apiFetch<DealsListResponse>(`/api/deals?${params.toString()}`);
    setDeals(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, appliedStatus]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDeals().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    }).finally(() => setLoading(false));
  }, [canRead, meta.offset, appliedStatus, fetchDeals]);

  const handleApplyFilters = () => {
    setAppliedStatus(status);
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...DEAL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Deals</h1>
        {canWrite && (
          <WriteGuard>
            <Link href="/deals/new">
              <Button>New Deal</Button>
            </Link>
          </WriteGuard>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <Button variant="secondary" onClick={handleApplyFilters}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {error && !loading && (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => fetchDeals()} />
            </div>
          )}
          {!loading && !error && deals.length === 0 && (
            <div className="p-6">
              <EmptyState
                title="No deals yet"
                description="Create your first deal to get started."
                actionLabel={canWrite && !writeDisabled ? "New Deal" : undefined}
                onAction={canWrite && !writeDisabled ? () => router.push("/deals/new") : undefined}
              />
            </div>
          )}
          {!loading && !error && deals.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Front Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-[var(--muted)]/50"
                      onClick={() => router.push(`/deals/${d.id}`)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/deals/${d.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{customerDisplay(d)}</TableCell>
                      <TableCell>{vehicleDisplay(d.vehicle)}</TableCell>
                      <TableCell>
                        <span className={statusBadgeClass(d.status)}>
                          {d.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCents(d.salePriceCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCents(d.frontGrossCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-[var(--border)] p-4">
                <Pagination
                  meta={meta}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
