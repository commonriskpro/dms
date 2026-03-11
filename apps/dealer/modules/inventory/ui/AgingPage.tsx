"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { AgingListResponse, AgingRow } from "./types";
import { VEHICLE_STATUS_OPTIONS } from "./types";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

/** Prefer salePriceCents. TODO: remove fallback after Step 4. */
function getAgingSalePriceCents(row: AgingRow): string {
  if (row.salePriceCents != null && row.salePriceCents !== "") return row.salePriceCents;
  if (row.listPriceCents != null && row.listPriceCents !== "") return row.listPriceCents;
  return "";
}

export function InventoryAgingPage() {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");

  const [rows, setRows] = React.useState<AgingRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<string>("daysInStock");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  const fetchAging = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
      sortBy,
      sortOrder,
    });
    if (status) params.set("status", status);
    const data = await apiFetch<AgingListResponse>(
      `/api/inventory/aging?${params.toString()}`
    );
    setRows(data.data);
    setMeta(data.meta);
  }, [canRead, meta.limit, meta.offset, status, sortBy, sortOrder]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAging().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load aging report");
    }).finally(() => setLoading(false));
  }, [canRead, meta.offset, status, sortBy, sortOrder, fetchAging]);

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to inventory
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Inventory aging</h1>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <Select
              label="Sort by"
              options={[{ value: "daysInStock", label: "Days in stock" }]}
              value={sortBy}
              onChange={setSortBy}
            />
            <Select
              label="Order"
              options={[
                { value: "asc", label: "Ascending" },
                { value: "desc", label: "Descending" },
              ]}
              value={sortOrder}
              onChange={(v) => setSortOrder(v as "asc" | "desc")}
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => { setError(null); fetchAging(); }} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No vehicles"
              description="No aging data for the current filters."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Stock #</TableHead>
                      <TableHead scope="col">Year / Make / Model</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Sale price</TableHead>
                      <TableHead scope="col">Days in stock</TableHead>
                      <TableHead scope="col">Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.vehicleId}
                        className="cursor-pointer"
                        onClick={() => router.push(inventoryDetailPath(row.vehicleId))}
                      >
                        <TableCell className="font-medium">{row.stockNumber}</TableCell>
                        <TableCell>
                          {[row.year, row.make, row.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          {getAgingSalePriceCents(row) !== ""
                            ? formatCents(getAgingSalePriceCents(row))
                            : "—"}
                        </TableCell>
                        <TableCell>{row.daysInStock}</TableCell>
                        <TableCell>
                          {new Date(row.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-[var(--border)] pt-4 mt-4">
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
