"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { InventoryKpis } from "./components/InventoryKpis";
import { InventoryFilterBar } from "./components/InventoryFilterBar";
import { VehicleInventoryTable } from "./components/VehicleInventoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryPageOverview } from "@/modules/inventory/service/inventory-page";
import { VEHICLE_STATUS_OPTIONS } from "./types";
import { apiFetch } from "@/lib/client/http";

export type InventoryPageContentV2Props = {
  initialData: InventoryPageOverview;
  /** Current query used for pagination/filter URLs. */
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
};

type BulkImportJobItem = {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number | null;
  createdAt: string;
  completedAt: string | null;
};

function ImportHistoryDialog({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [jobs, setJobs] = React.useState<BulkImportJobItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ data: BulkImportJobItem[]; meta: { total: number } }>(
      "/api/inventory/bulk/import?limit=10&offset=0"
    )
      .then((res) => {
        if (!cancelled) setJobs(res.data ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      contentClassName="relative z-50 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4 flex flex-col"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">Import history</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 min-h-0 border border-[var(--border)] rounded-md">
          {loading && (
            <p className="p-4 text-sm text-[var(--muted-text)]">Loading…</p>
          )}
          {error && (
            <p className="p-4 text-sm text-[var(--danger)]">{error}</p>
          )}
          {!loading && !error && jobs.length === 0 && (
            <p className="p-4 text-sm text-[var(--muted-text)]">No import jobs yet.</p>
          )}
          {!loading && !error && jobs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--surface-2)]">
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Rows</TableHead>
                  <TableHead scope="col">Created</TableHead>
                  <TableHead scope="col">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.status}</TableCell>
                    <TableCell>
                      {j.processedRows != null ? `${j.processedRows} / ${j.totalRows}` : j.totalRows}
                    </TableCell>
                    <TableCell className="text-[var(--muted-text)]">
                      {new Date(j.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-[var(--muted-text)]">
                      {j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "" && String(v).trim() !== ""
  );
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export function InventoryPageContentV2({
  initialData,
  currentQuery,
  canWrite,
}: InventoryPageContentV2Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = React.useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = React.useState(false);

  const [status, setStatus] = React.useState(String(currentQuery.status ?? ""));
  const [search, setSearch] = React.useState(String(currentQuery.search ?? ""));
  const [minPriceDollars, setMinPriceDollars] = React.useState(
    currentQuery.minPrice != null ? String(Math.round(Number(currentQuery.minPrice) / 100)) : ""
  );
  const [maxPriceDollars, setMaxPriceDollars] = React.useState(
    currentQuery.maxPrice != null ? String(Math.round(Number(currentQuery.maxPrice) / 100)) : ""
  );
  const [sortBy, setSortBy] = React.useState(String(currentQuery.sortBy ?? "createdAt"));
  const [sortOrder, setSortOrder] = React.useState(String(currentQuery.sortOrder ?? "desc"));

  const buildPaginatedUrl = React.useCallback(
    (params: { page: number; pageSize: number }) => {
      const q = { ...currentQuery, page: params.page, pageSize: params.pageSize };
      const qs = buildQueryString(q);
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, currentQuery]
  );

  const applyFilters = () => {
    const minCents = minPriceDollars.trim() ? Math.round(parseFloat(minPriceDollars) * 100) : undefined;
    const maxCents = maxPriceDollars.trim() ? Math.round(parseFloat(maxPriceDollars) * 100) : undefined;
    const q: Record<string, string | number | undefined> = {
      page: 1,
      pageSize: initialData.list.pageSize,
      sortBy,
      sortOrder: sortOrder as "asc" | "desc",
    };
    if (status) q.status = status;
    if (search.trim()) q.search = search.trim();
    if (minCents != null && !Number.isNaN(minCents)) q.minPrice = minCents;
    if (maxCents != null && !Number.isNaN(maxCents)) q.maxPrice = maxCents;
    const qs = buildQueryString(q);
    router.push(`${pathname}?${qs}`);
    setFilterOpen(false);
  };

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const sortOptions: SelectOption[] = [
    { value: "createdAt", label: "Date added" },
    { value: "salePriceCents", label: "Sale price" },
    { value: "mileage", label: "Mileage" },
    { value: "stockNumber", label: "Stock #" },
    { value: "updatedAt", label: "Last updated" },
  ];

  return (
    <PageShell className="flex flex-col gap-3">
      <InventoryKpis
        kpis={initialData.kpis}
        alerts={initialData.alerts}
        health={initialData.health}
        canWrite={canWrite}
      />

      <VehicleInventoryTable
        items={initialData.list.items}
        page={initialData.list.page}
        pageSize={initialData.list.pageSize}
        total={initialData.list.total}
        canRead={true}
        canWrite={canWrite}
        buildPaginatedUrl={buildPaginatedUrl}
        filterBar={
          <InventoryFilterBar
            floorPlannedCount={initialData.filterChips.floorPlannedCount}
            onAdvancedFilters={() => setFilterOpen(true)}
            onSaveSearch={() => setSaveSearchOpen(true)}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <a
          href="/inventory/aging"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View aging report
        </a>
        {canWrite && (
          <button
            type="button"
            onClick={() => setImportHistoryOpen(true)}
            className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Import history
          </button>
        )}
      </div>

      {importHistoryOpen && (
        <ImportHistoryDialog onOpenChange={setImportHistoryOpen} />
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Status" options={statusOptions} value={status} onChange={setStatus} />
              <Input
                label="Search (VIN / make / model)"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                label="Min price ($)"
                placeholder="e.g. 5000"
                value={minPriceDollars}
                onChange={(e) => setMinPriceDollars(e.target.value)}
              />
              <Input
                label="Max price ($)"
                placeholder="e.g. 25000"
                value={maxPriceDollars}
                onChange={(e) => setMaxPriceDollars(e.target.value)}
              />
              <Select label="Sort by" options={sortOptions} value={sortBy} onChange={setSortBy} />
              <Select
                label="Order"
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
                value={sortOrder}
                onChange={(v) => setSortOrder(v)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button variant="secondary" onClick={() => setFilterOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-text)]">Save current search — coming soon.</p>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
