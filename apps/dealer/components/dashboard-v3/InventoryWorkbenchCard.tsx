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
import { Search, Plus, ChevronLeft, ChevronRight, ChevronDown } from "@/lib/ui/icons";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

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
  meta?: { total: number };
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

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    AVAILABLE: "Available",
    REPAIR: "In Recon",
    HOLD: "On Hold",
    ARCHIVED: "Archived",
    WHOLESALE: "Wholesale",
  };
  return map[status] ?? status;
}

/** Badge extra classes per variant (token-based). */
function badgeStyle(variant: ReturnType<typeof statusVariant>): string {
  switch (variant) {
    case "success":  return "bg-[var(--success-muted)] text-[var(--success-muted-fg)] border border-[var(--success)]";
    case "warning":  return "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)] border border-[var(--warning)]";
    case "danger":   return "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)] border border-[var(--danger)]";
    case "info":     return "bg-[var(--info-muted)] text-[var(--info-muted-fg)] border border-[var(--accent)]";
    default:         return "bg-[var(--surface-2)] text-[var(--muted-text)] border border-[var(--border)]";
  }
}

/** Days-in-stock color coding: green <30, amber 30–60, red >60 (token-based). */
function daysColor(days: number): string {
  if (days > 60) return "text-[var(--danger)]";
  if (days > 30) return "text-[var(--warning)]";
  return "text-[var(--text)]";
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "AVAILABLE", label: "Available" },
  { value: "REPAIR", label: "Repair" },
  { value: "HOLD", label: "Hold" },
  { value: "WHOLESALE", label: "Wholesale" },
];

const SEARCH_HISTORY_KEY = "dms:inventory-workbench-search-history";
const SEARCH_HISTORY_MAX = 10;

function getStoredSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, SEARCH_HISTORY_MAX)
      : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

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
  const [perPage, setPerPage] = React.useState(5);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState<string[]>(getStoredSearchHistory);

  const addToHistory = React.useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, SEARCH_HISTORY_MAX);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  const fetchRows = React.useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({
      limit: String(perPage),
      offset: String((page - 1) * perPage),
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    if (status) params.set("status", status);
    const res = await apiFetch<VehicleResponse>(`/api/inventory?${params.toString()}`, {
      signal,
    });
    setRows(res.data);
    setTotal(res.meta?.total ?? res.data.length);
  }, [status, perPage, page]);

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

  // Reset to page 1 when filters change
  React.useEffect(() => { setPage(1); }, [status, perPage]);

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

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <WidgetCard title="" className="!p-0 [&>div:first-child]:hidden">
      {/* Header: title left, search + filters right — matches mock layout */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <span className="shrink-0 text-base font-semibold text-[var(--text)]">Inventory</span>

        {/* Search — flex-1, chevron opens recent searches (client-side history) */}
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)] pointer-events-none" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => addToHistory(query)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addToHistory(query);
            }}
            placeholder="Search..."
            aria-label="Search inventory"
            className="h-8 w-full pl-8 pr-8 text-sm bg-[var(--surface-2)]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Recent searches"
                className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center text-[var(--muted-text)] hover:text-[var(--text)] rounded-r-[var(--radius-input)]"
              >
                <ChevronDown size={12} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px] max-h-[240px] overflow-y-auto">
              {recentSearches.length === 0 ? (
                <div className="px-2 py-3 text-sm text-[var(--muted-text)]">No recent searches</div>
              ) : (
                recentSearches.map((term) => (
                  <DropdownMenuItem
                    key={term}
                    onSelect={() => setQuery(term)}
                    className="cursor-pointer"
                  >
                    {term}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status filter */}
        <div className="shrink-0">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={status}
            onChange={setStatus}
            aria-label="Filter by status"
          />
        </div>

        {/* Actions dropdown */}
        {(canAddVehicle || canAddLead || canStartDeal) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Quick actions"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <Plus size={14} aria-hidden />
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

      {/* Table — full bleed, no extra horizontal padding */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-y border-[var(--border)]">
              <TableHead className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Stock</TableHead>
              <TableHead className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Vehicle</TableHead>
              <TableHead className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Cost</TableHead>
              <TableHead className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Price</TableHead>
              <TableHead className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Profit</TableHead>
              <TableHead className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Days</TableHead>
              <TableHead className="px-3 py-1.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const days = toDaysInStock(row.createdAt);
              const variant = statusVariant(row.status);
              return (
                <TableRow key={row.id} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/50">
                  <TableCell className="px-4 py-2 text-sm text-[var(--muted-text)]">#{row.stockNumber}</TableCell>
                  <TableCell className="px-3 py-2 text-sm font-semibold text-[var(--text)]">
                    <Link href={inventoryDetailPath(row.id)} className="hover:underline">
                      {[row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle"}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-sm tabular-nums text-[var(--muted-text)]">
                    {formatCents(row.auctionCostCents)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-[var(--text)]">
                    {formatCents(row.salePriceCents)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-sm tabular-nums font-bold text-[var(--success)]">
                    {formatCents(row.projectedGrossCents)}
                  </TableCell>
                  <TableCell className={`px-3 py-2 text-right text-sm tabular-nums font-medium ${daysColor(days)}`}>
                    {days}
                  </TableCell>
                  <TableCell className="px-3 py-2 pr-4">
                    <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(variant)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-5 text-center text-sm text-[var(--muted-text)]">
                  No matching inventory records.
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-5 text-center text-sm text-[var(--muted-text)]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer — border-top separator, full bleed like mock */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-text)]">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-6 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 text-xs text-[var(--text)] focus:outline-none"
          >
            {[5, 10, 25].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span>Showing {rangeStart}–{rangeEnd} of {total} results</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
