"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Input } from "@/components/ui/input";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { DMSPage, DMSSection } from "@/components/ui/dms-page";
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
import type {
  VehicleResponse,
  InventoryListResponse,
  LocationOption,
} from "./types";
import { VEHICLE_STATUS_OPTIONS, getSalePriceCents } from "./types";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date added" },
  { value: "salePriceCents", label: "Sale price" },
  { value: "mileage", label: "Mileage" },
  { value: "stockNumber", label: "Stock #" },
  { value: "updatedAt", label: "Last updated" },
];

function daysInStock(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );
}

/** Prefer canonical projectedGrossCents. TODO: remove fallback after Step 4. */
function getProjectedGrossCents(v: VehicleResponse): string {
  if (v.projectedGrossCents != null && v.projectedGrossCents !== "") return v.projectedGrossCents;
  return "";
}

export function InventoryListPage() {
  const router = useRouter();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
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
      <DMSPage>
        <DMSCard className="p-6">
        <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
        </DMSCard>
      </DMSPage>
    );
  }

  return (
    <DMSPage>
      <DMSSection>
        <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Inventory</h1>
        {canWrite && (
          <WriteGuard>
            <Link href="/inventory/new">
              <Button>Add vehicle</Button>
            </Link>
          </WriteGuard>
        )}
      </div>

        <DMSCard>
          <DMSCardHeader>
            <DMSCardTitle>Filters</DMSCardTitle>
          </DMSCardHeader>
          <DMSCardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
            {locationsLoaded && locations.length > 0 && (
              <Select
                label="Location"
                options={locationOptions}
                value={locationId}
                onChange={setLocationId}
              />
            )}
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
              onChange={(v) => setSortOrder(v as "asc" | "desc")}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply</Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset filters
            </Button>
          </div>
          </DMSCardContent>
        </DMSCard>

        <DMSCard>
          <DMSCardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => { setError(null); fetchVehicles(); }} />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No vehicles"
                description="Add your first vehicle to get started."
                actionLabel={canWrite && !writeDisabled ? "Add vehicle" : undefined}
                onAction={canWrite && !writeDisabled ? () => router.push("/inventory/new") : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Stock #</TableHead>
                      <TableHead scope="col">Year / Make / Model</TableHead>
                      <TableHead scope="col">VIN</TableHead>
                      <TableHead scope="col">Mileage</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Sale price</TableHead>
                      <TableHead scope="col">Projected gross</TableHead>
                      <TableHead scope="col">Location</TableHead>
                      <TableHead scope="col">Days in stock</TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => {
                      const saleCents = getSalePriceCents(v);
                      const projectedCents = getProjectedGrossCents(v);
                      return (
                        <TableRow
                          key={v.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/inventory/${v.id}`)}
                        >
                          <TableCell className="font-medium">{v.stockNumber}</TableCell>
                          <TableCell>
                            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {v.vin ?? "—"}
                          </TableCell>
                          <TableCell>
                            {v.mileage != null
                              ? v.mileage.toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>{v.status}</TableCell>
                          <TableCell>
                            {saleCents !== "" ? formatCents(saleCents) : "—"}
                          </TableCell>
                          <TableCell>
                            {projectedCents !== "" ? formatCents(projectedCents) : "—"}
                          </TableCell>
                          <TableCell>{v.location?.name ?? "—"}</TableCell>
                          <TableCell>{daysInStock(v.createdAt)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Link href={`/inventory/${v.id}`}>
                                <Button variant="secondary" size="sm">
                                  View
                                </Button>
                              </Link>
                              {canWrite && (
                                <WriteGuard>
                                  <Link href={`/inventory/${v.id}/edit`}>
                                    <Button variant="ghost" size="sm">
                                      Edit
                                    </Button>
                                  </Link>
                                </WriteGuard>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-[var(--border)] p-4">
                <Pagination
                  meta={meta}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                />
              </div>
            </>
          )}
          </DMSCardContent>
        </DMSCard>

        <div>
          <Link href="/inventory/aging" className="text-sm text-[var(--accent)] hover:underline">
            View aging report
          </Link>
        </div>
      </DMSSection>
    </DMSPage>
  );
}
