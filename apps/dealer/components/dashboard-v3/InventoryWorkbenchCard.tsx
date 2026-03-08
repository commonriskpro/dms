"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { formatCents } from "@/lib/money";
import { WidgetCard } from "./WidgetCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ColumnHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
} from "@/components/ui-system/tables";

type VehicleRow = {
  id: string;
  stockNumber: string;
  year: number | null;
  make: string | null;
  model: string | null;
  salePriceCents: string;
  auctionCostCents: string;
  projectedGrossCents: string;
  status: string;
  createdAt: string;
};

type VehicleResponse = {
  data: VehicleRow[];
};

function toDaysInStock(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "AVAILABLE") return "success";
  if (status === "REPAIR" || status === "HOLD") return "warning";
  if (status === "ARCHIVED") return "danger";
  if (status === "WHOLESALE") return "info";
  return "neutral";
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "AVAILABLE", label: "Available" },
  { value: "REPAIR", label: "Repair" },
  { value: "HOLD", label: "Hold" },
  { value: "WHOLESALE", label: "Wholesale" },
];

export function InventoryWorkbenchCard({
  canReadInventory,
  canAddVehicle,
  canAddLead,
  canStartDeal,
  refreshToken,
}: {
  canReadInventory: boolean;
  canAddVehicle: boolean;
  canAddLead: boolean;
  canStartDeal: boolean;
  refreshToken?: number;
}) {
  const [rows, setRows] = React.useState<VehicleRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");

  const fetchRows = React.useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({
      limit: "8",
      offset: "0",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    if (status) params.set("status", status);
    const res = await apiFetch<VehicleResponse>(`/api/inventory?${params.toString()}`, {
      signal,
    });
    setRows(res.data);
  }, [status]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (!canReadInventory) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    let mounted = true;
    setLoading(true);
    fetchRows(ac.signal)
      .catch(() => {
        if (!mounted) return;
        setRows([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [canReadInventory, fetchRows, refreshToken]);

  const filteredRows = React.useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => {
      const vehicle = [row.year, row.make, row.model].filter(Boolean).join(" ").toLowerCase();
      return (
        row.stockNumber.toLowerCase().includes(q) ||
        vehicle.includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const resultsLabel = `${filteredRows.length} shown`;

  return (
    <WidgetCard
      title="Quick Actions"
      subtitle="Inventory workbench"
      action={<span className="text-xs font-medium text-[var(--muted-text)]">{resultsLabel}</span>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {canAddVehicle ? (
            <Link
              href="/inventory/new"
              className="flex h-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--accent-inventory)] px-3 text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            >
              Add Vehicle
            </Link>
          ) : null}
          {canAddLead ? (
            <Link
              href="/customers/new"
              className="flex h-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--accent-leads)] px-3 text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            >
              Add Lead
            </Link>
          ) : null}
          {canStartDeal ? (
            <Link
              href="/deals/new"
              className="flex h-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--accent-deals)] px-3 text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            >
              Start Deal
            </Link>
          ) : null}
        </div>
        {!canAddVehicle && !canAddLead && !canStartDeal ? (
          <p className="text-sm text-[var(--muted-text)]">No actions available.</p>
        ) : null}

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-card)]">
          <TableToolbar
            className="bg-[var(--surface)]"
            search={
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stock, vehicle, status..."
                aria-label="Search inventory workbench"
                className="h-9 bg-[var(--surface-2)]"
              />
            }
            filters={
              <div className="w-[170px]">
                <Select
                  options={STATUS_FILTER_OPTIONS}
                  value={status}
                  onChange={setStatus}
                  aria-label="Filter inventory status"
                />
              </div>
            }
          />

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHeader>Stock</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Vehicle</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Cost</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Price</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Profit</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Days</ColumnHeader></TableHead>
                  <TableHead><ColumnHeader>Status</ColumnHeader></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface)]">
                    <TableCell className="px-3 py-2 text-[13px] font-semibold">#{row.stockNumber}</TableCell>
                    <TableCell className="px-3 py-2 text-[13px]">
                      <Link href={`/inventory/${row.id}`} className="hover:underline">
                        {[row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle"}
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[13px] tabular-nums">
                      {formatCents(row.auctionCostCents)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[13px] tabular-nums">
                      {formatCents(row.salePriceCents)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[13px] tabular-nums font-semibold">
                      {formatCents(row.projectedGrossCents)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[13px] tabular-nums">{toDaysInStock(row.createdAt)}</TableCell>
                    <TableCell className="px-3 py-2">
                      <StatusBadge variant={statusVariant(row.status)} className="h-6 px-2.5 text-[11px] font-semibold uppercase tracking-wide">
                        {row.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-[var(--muted-text)]">
                      No matching inventory records.
                    </TableCell>
                  </TableRow>
                ) : null}
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-[var(--muted-text)]">
                      Loading inventory workbench...
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted-text)]">
            <span>{resultsLabel}</span>
            <span className="tabular-nums">{rows.length} loaded</span>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
