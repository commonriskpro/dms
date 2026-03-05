"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { parseDollarsToCents } from "@/lib/money";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { ui } from "@/lib/ui/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySummaryCards } from "./components/InventorySummaryCards";
import { InventoryFilterBar } from "./components/InventoryFilterBar";
import { InventoryTableCard } from "./components/InventoryTableCard";
import { InventoryRightRail } from "./components/InventoryRightRail";
import type { VehicleResponse, InventoryListResponse, LocationOption } from "./types";
import { VEHICLE_STATUS_OPTIONS } from "./types";
import { RefreshIcon } from "@/components/dashboard-v3/RefreshIcon";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date added" },
  { value: "salePriceCents", label: "Sale price" },
  { value: "mileage", label: "Mileage" },
  { value: "stockNumber", label: "Stock #" },
  { value: "updatedAt", label: "Last updated" },
];

function lastUpdatedLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Last updated just now";
  if (diffMins === 1) return "Last updated 1 minute ago";
  if (diffMins < 60) return `Last updated ${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "Last updated 1 hour ago";
  return `Last updated ${diffHours} hours ago`;
}

export function InventoryPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [vehicles, setVehicles] = React.useState<VehicleResponse[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string>(() => new Date().toISOString());

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
    setLastUpdated(new Date().toISOString());
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

  const inRecon = 0;
  const salePending = 0;

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title={<h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">Inventory</h1>}
        actions={
          <>
            <span className="text-sm leading-[1.3] text-[var(--muted-text)]" title={lastUpdated}>
              {lastUpdatedLabel(lastUpdated)}
            </span>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.location.reload()}
              aria-label="Refresh inventory"
              className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface-2)] ${ui.ring}`}
            >
              <RefreshIcon className="h-4 w-4 shrink-0" />
              Refresh
            </button>
          </>
        }
      />

      <InventorySummaryCards
        total={meta.total}
        inRecon={inRecon}
        salePending={salePending}
        inventoryValueLabel="—"
        canWrite={canWrite}
      />

      <InventoryFilterBar
        floorPlannedCount={0}
        previouslySoldCount={0}
        onAdvancedFilters={() => setFilterOpen(true)}
      />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-left text-[var(--text)]">Advanced Filters</DialogTitle>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
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
        <InventoryRightRail canWrite={canWrite} />
      </div>

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
