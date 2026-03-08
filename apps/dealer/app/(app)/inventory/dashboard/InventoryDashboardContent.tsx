"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { InventoryDashboardHeader } from "@/components/inventory/dashboard/InventoryDashboardHeader";
import { InventoryDashboardKpis } from "@/components/inventory/dashboard/InventoryDashboardKpis";
import { InventoryIntelligencePanel } from "@/components/inventory/dashboard/InventoryIntelligencePanel";
import { InventoryFilterBar } from "@/modules/inventory/ui/components/InventoryFilterBar";
import { VehicleInventoryTable } from "@/modules/inventory/ui/components/VehicleInventoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import type { InventoryIntelligenceDashboardResult } from "@/modules/inventory/service/inventory-intelligence-dashboard";
import { buildQueryString } from "@/lib/url/buildQueryString";
import { VEHICLE_STATUS_OPTIONS } from "@/modules/inventory/ui/types";

export type InventoryDashboardContentProps = {
  data: InventoryIntelligenceDashboardResult;
  currentQuery: Record<string, string | number | undefined>;
  canWrite: boolean;
  lastUpdatedMs: number;
};

export function InventoryDashboardContent({
  data,
  currentQuery,
  canWrite,
  lastUpdatedMs,
}: InventoryDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = React.useState(false);

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
    const minCents = minPriceDollars.trim()
      ? Math.round(parseFloat(minPriceDollars) * 100)
      : undefined;
    const maxCents = maxPriceDollars.trim()
      ? Math.round(parseFloat(maxPriceDollars) * 100)
      : undefined;
    const q: Record<string, string | number | undefined> = {
      page: 1,
      pageSize: data.list.pageSize,
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
      <InventoryDashboardHeader lastUpdatedMs={lastUpdatedMs} />
      <InventoryDashboardKpis
        totalUnits={data.kpis.totalUnits}
        inventoryValueCents={data.kpis.inventoryValueCents}
        avgValuePerVehicleCents={data.kpis.avgValuePerVehicleCents}
        daysToTurn={data.kpis.daysToTurn}
        demandScore={data.kpis.demandScore}
      />

      <InventoryIntelligencePanel
        priceToMarket={data.intelligence.priceToMarket}
        daysToTurn={data.kpis.daysToTurn}
        turnPerformance={data.intelligence.turnPerformance}
        alertCenter={data.intelligence.alertCenter}
      />

      <InventoryFilterBar
        floorPlannedCount={0}
        onAdvancedFilters={() => setFilterOpen(true)}
      />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Status"
                options={statusOptions}
                value={status}
                onChange={setStatus}
              />
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
              <Select
                label="Sort by"
                options={sortOptions}
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

      <VehicleInventoryTable
        items={data.list.items}
        page={data.list.page}
        pageSize={data.list.pageSize}
        total={data.list.total}
        canRead={true}
        canWrite={canWrite}
        buildPaginatedUrl={buildPaginatedUrl}
      />

      <div>
        <Link
          href="/inventory"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View full inventory
        </Link>
      </div>
    </PageShell>
  );
}
