"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { InventoryKpis } from "./components/InventoryKpis";
import { DealPipelineBar } from "./components/DealPipelineBar";
import { InventoryFilterBar } from "./components/InventoryFilterBar";
import { VehicleInventoryTable } from "./components/VehicleInventoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import type { InventoryPageOverview } from "@/modules/inventory/service/inventory-page";
import { VEHICLE_STATUS_OPTIONS } from "./types";

export type InventoryPageContentV2Props = {
  initialData: InventoryPageOverview;
  /** Current query used for pagination/filter URLs. */
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
};

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
    <PageShell className={sectionStack}>
      <InventoryKpis
        kpis={initialData.kpis}
        alerts={initialData.alerts}
        health={initialData.health}
      />

      <DealPipelineBar pipeline={initialData.pipeline} />

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
            previouslySoldCount={initialData.filterChips.previouslySoldCount}
            onAdvancedFilters={() => setFilterOpen(true)}
            onSaveSearch={() => setSaveSearchOpen(true)}
          />
        }
      />

      <div>
        <a
          href="/inventory/aging"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View aging report
        </a>
      </div>

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
