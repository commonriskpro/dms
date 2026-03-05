"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { parseDollarsToCents } from "@/lib/money";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { sectionStack } from "@/lib/ui/recipes/layout";
import type { InventoryKpis, InventoryAgingBuckets } from "@/modules/inventory/service/dashboard";
import type { DealPipelineStages } from "@/modules/deals/service/deal-pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySummaryCards } from "./components/InventorySummaryCards";
import { InventoryFilterBar } from "./components/InventoryFilterBar";
import { InventoryTableCard } from "./components/InventoryTableCard";
import { InventoryHealthCard } from "./components/InventoryHealthCard";
import { InventoryAlertsCard } from "./components/InventoryAlertsCard";
import { InventoryQuickActionsCard } from "./components/InventoryQuickActionsCard";
import { DealPipelineBar } from "./components/DealPipelineBar";
import type { AlertRow } from "./components/InventoryAlertsCard";
import type { VehicleResponse, InventoryListResponse, LocationOption } from "./types";
import { VEHICLE_STATUS_OPTIONS } from "./types";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date added" },
  { value: "salePriceCents", label: "Sale price" },
  { value: "mileage", label: "Mileage" },
  { value: "stockNumber", label: "Stock #" },
  { value: "updatedAt", label: "Last updated" },
];

const DEFAULT_KPIS: InventoryKpis = {
  totalUnits: 0,
  delta7d: null,
  inReconUnits: 0,
  inReconPercent: 0,
  salePendingUnits: 0,
  salePendingValueCents: null,
  inventoryValueCents: 0,
  avgValueCents: 0,
};

const DEFAULT_AGING: InventoryAgingBuckets = {
  lt30: 0,
  d30to60: 0,
  d60to90: 0,
  gt90: 0,
};

const DEFAULT_PIPELINE: DealPipelineStages = {
  leads: 0,
  appointments: 0,
  workingDeals: 0,
  pendingFunding: 0,
  soldToday: 0,
};

const DEFAULT_ALERTS: AlertRow[] = [
  { id: "missing-photos", label: "Missing Photos", count: 0, href: "/inventory" },
  { id: "units-90", label: "Units > 90 days", count: 0, href: "/inventory/aging" },
  { id: "units-recon", label: "Units Need Recon", count: 0, href: "/inventory" },
];

export type InventoryPageProps = {
  initialKpis?: InventoryKpis;
  initialAging?: InventoryAgingBuckets;
  initialAlerts?: AlertRow[];
  initialPipeline?: DealPipelineStages;
};

export function InventoryPage({
  initialKpis = DEFAULT_KPIS,
  initialAging = DEFAULT_AGING,
  initialAlerts = DEFAULT_ALERTS,
  initialPipeline = DEFAULT_PIPELINE,
}: InventoryPageProps = {}) {
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [vehicles, setVehicles] = React.useState<VehicleResponse[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");
  const [minPriceDollars, setMinPriceDollars] = React.useState<string>("");
  const [maxPriceDollars, setMaxPriceDollars] = React.useState<string>("");
  const [locationId, setLocationId] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<string>("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [locations, setLocations] = React.useState<LocationOption[]>([]);
  const [locationsLoaded, setLocationsLoaded] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const [appliedFilters, setAppliedFilters] = React.useState({
    status: "",
    search: "",
    minPriceDollars: "",
    maxPriceDollars: "",
    locationId: "",
    sortBy: "createdAt",
    sortOrder: "desc" as "asc" | "desc",
  });

  const fetchLocations = React.useCallback(async () => {
    if (!hasPermission("admin.dealership.read")) {
      setLocationsLoaded(true);
      return;
    }
    try {
      const res = await apiFetch<{ data: LocationOption[] }>(
        "/api/admin/dealership/locations?limit=100"
      );
      setLocations(res.data ?? []);
    } catch {
      setLocations([]);
    } finally {
      setLocationsLoaded(true);
    }
  }, [hasPermission]);

  const fetchVehicles = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
      sortBy: appliedFilters.sortBy,
      sortOrder: appliedFilters.sortOrder,
    });
    if (appliedFilters.status) params.set("status", appliedFilters.status);
    if (appliedFilters.search.trim()) params.set("search", appliedFilters.search.trim());
    const minCents = appliedFilters.minPriceDollars.trim()
      ? parseDollarsToCents(appliedFilters.minPriceDollars)
      : "";
    if (minCents !== "") params.set("minPrice", minCents);
    const maxCents = appliedFilters.maxPriceDollars.trim()
      ? parseDollarsToCents(appliedFilters.maxPriceDollars)
      : "";
    if (maxCents !== "") params.set("maxPrice", maxCents);
    if (appliedFilters.locationId) params.set("locationId", appliedFilters.locationId);

    const data = await apiFetch<InventoryListResponse>(
      `/api/inventory?${params.toString()}`
    );
    setVehicles(data.data);
    setMeta(data.meta);
  }, [canRead, meta.limit, meta.offset, appliedFilters]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchLocations();
  }, [canRead, fetchLocations]);

  React.useEffect(() => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    fetchVehicles().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    }).finally(() => setLoading(false));
  }, [canRead, meta.offset, appliedFilters, fetchVehicles]);

  const handleApplyFilters = () => {
    setMeta((m) => ({ ...m, offset: 0 }));
    setAppliedFilters({
      status,
      search: search.trim(),
      minPriceDollars: minPriceDollars.trim(),
      maxPriceDollars: maxPriceDollars.trim(),
      locationId,
      sortBy,
      sortOrder,
    });
    setFilterOpen(false);
  };

  const handleResetFilters = () => {
    setStatus("");
    setSearch("");
    setMinPriceDollars("");
    setMaxPriceDollars("");
    setLocationId("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setAppliedFilters({
      status: "",
      search: "",
      minPriceDollars: "",
      maxPriceDollars: "",
      locationId: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const locationOptions: SelectOption[] = [
    { value: "", label: "All locations" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];
  const sortOptions: SelectOption[] = SORT_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className={sectionStack}>
      <PageHeader
        title={
          <h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">
            Inventory
          </h1>
        }
      />

      {/* Row 1: KPI cards with trend chips */}
      <InventorySummaryCards kpis={initialKpis} canWrite={canWrite} />

      {/* Row 2: Inventory Health, Alerts, Quick Actions (only one Quick Actions on page) */}
      <div className="grid grid-cols-1 gap-[var(--space-grid)] md:grid-cols-2 lg:grid-cols-3 items-stretch">
        <InventoryHealthCard aging={initialAging} />
        <InventoryAlertsCard alerts={initialAlerts} />
        <InventoryQuickActionsCard canWrite={canWrite} />
      </div>

      {/* Row 3: Deal Pipeline bar */}
      <DealPipelineBar pipeline={initialPipeline} />

      <InventoryFilterBar
        floorPlannedCount={0}
        previouslySoldCount={0}
        onAdvancedFilters={() => setFilterOpen(true)}
      />

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
              {locationsLoaded && locations.length > 0 && (
                <Select
                  label="Location"
                  options={locationOptions}
                  value={locationId}
                  onChange={setLocationId}
                />
              )}
              <Select label="Sort by" options={sortOptions} value={sortBy} onChange={setSortBy} />
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
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>Apply</Button>
              <Button variant="secondary" onClick={handleResetFilters}>
                Reset filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Row 5: Inventory list (full width, no right rail) */}
      <InventoryTableCard
        vehicles={vehicles}
        meta={meta}
        loading={loading}
        error={error}
        onRetry={() => { setError(null); fetchVehicles(); }}
        onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
        canRead={canRead}
        canWrite={canWrite}
      />

      <div>
        <a
          href="/inventory/aging"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View aging report
        </a>
      </div>
    </PageShell>
  );
}
