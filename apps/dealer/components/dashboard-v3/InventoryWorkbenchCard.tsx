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
} from "@/components/ui-system/tables";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus } from "@/lib/ui/icons";

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
    >
      <div className="space-y-2">
        {/* Search + filter row with actions dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)] pointer-events-none" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search inventory workbench"
              className="h-9 pl-8 bg-[var(--surface-2)]"
            />
          </div>
          <div className="w-[150px]">
            <Select
              options={STATUS_FILTER_OPTIONS}
              value={status}
              onChange={setStatus}
              aria-label="Filter inventory status"
            />
          </div>
          {(canAddVehicle || canAddLead || canStartDeal) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Quick actions"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                >
                  <Plus size={15} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {canAddVehicle ? (
                  <DropdownMenuItem asChild>
                    <Link href="/inventory/new">Add Vehicle</Link>
                  </DropdownMenuItem>
                ) : null}
                {canAddLead ? (
                  <DropdownMenuItem asChild>
                    <Link href="/customers/new">Add Lead</Link>
                  </DropdownMenuItem>
                ) : null}
                {canStartDeal ? (
                  <DropdownMenuItem asChild>
                    <Link href="/deals/new">Start Deal</Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Table — no extra container */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border)]">
                <TableHead className="px-2 py-2 text-left text-[12px] font-medium text-[var(--muted-text)]">Stock</TableHead>
                <TableHead className="px-2 py-2 text-left text-[12px] font-medium text-[var(--muted-text)]">Vehicle</TableHead>
                <TableHead className="px-2 py-2 text-right text-[12px] font-medium text-[var(--muted-text)]">Cost</TableHead>
                <TableHead className="px-2 py-2 text-right text-[12px] font-medium text-[var(--muted-text)]">Price</TableHead>
                <TableHead className="px-2 py-2 text-right text-[12px] font-medium text-[var(--muted-text)]">Profit</TableHead>
                <TableHead className="px-2 py-2 text-right text-[12px] font-medium text-[var(--muted-text)]">Days</TableHead>
                <TableHead className="px-2 py-2 text-left text-[12px] font-medium text-[var(--muted-text)]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/60">
                  <TableCell className="px-2 py-2 text-[13px] text-[var(--muted-text)]">#{row.stockNumber}</TableCell>
                  <TableCell className="px-2 py-2 text-[13px] font-semibold text-[var(--text)]">
                    <Link href={`/inventory/${row.id}`} className="hover:underline">
                      {[row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle"}
                    </Link>
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right text-[13px] tabular-nums text-[var(--text)]">
                    {formatCents(row.auctionCostCents)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right text-[13px] tabular-nums text-[var(--text)]">
                    {formatCents(row.salePriceCents)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right text-[13px] tabular-nums font-semibold text-[var(--text)]">
                    {formatCents(row.projectedGrossCents)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right text-[13px] tabular-nums text-[var(--text)]">{toDaysInStock(row.createdAt)}</TableCell>
                  <TableCell className="px-2 py-2">
                    <StatusBadge variant={statusVariant(row.status)} className="h-5 px-2 text-[11px] font-semibold">
                      {row.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center text-sm text-[var(--muted-text)]">
                    No matching inventory records.
                  </TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center text-sm text-[var(--muted-text)]">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted-text)]">
          <span>{resultsLabel}</span>
          <span className="tabular-nums">{rows.length} loaded</span>
        </div>
      </div>
    </WidgetCard>
  );
}
