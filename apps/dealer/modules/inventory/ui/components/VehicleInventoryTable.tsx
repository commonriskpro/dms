"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, ChevronLeft, ChevronRight, ChevronDown } from "@/lib/ui/icons";
import { tableTokens } from "@/lib/ui/tokens";
import {
  tableScrollWrapper,
  tableHeaderRow,
  tableHeadCellCompact,
  tableCellCompact,
  tableRowHover,
  tableRowCompact,
} from "@/lib/ui/recipes/table";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/modules/inventory/service/inventory-page";
import { inventoryDetailPath, inventoryEditPath } from "@/lib/routes/detail-paths";

const STATUS_OPTIONS = [
  { value: "",           label: "All Status" },
  { value: "AVAILABLE",  label: "Available" },
  { value: "REPAIR",     label: "In Recon" },
  { value: "HOLD",       label: "On Hold" },
  { value: "WHOLESALE",  label: "Wholesale" },
  { value: "ARCHIVED",   label: "Archived" },
];

function statusVariant(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "AVAILABLE")                return "success";
  if (s === "REPAIR" || s === "HOLD")   return "warning";
  if (s === "ARCHIVED")                 return "danger";
  if (s === "WHOLESALE")                return "info";
  return "neutral";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    AVAILABLE: "Available",
    REPAIR:    "In Recon",
    HOLD:      "On Hold",
    ARCHIVED:  "Archived",
    WHOLESALE: "Wholesale",
  };
  return map[s] ?? s;
}

function badgeStyle(v: ReturnType<typeof statusVariant>): string {
  switch (v) {
    case "success": return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    case "warning": return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
    case "danger":  return "bg-red-500/15 text-red-400 border border-red-500/30";
    case "info":    return "bg-sky-500/15 text-sky-400 border border-sky-500/30";
    default:        return "bg-[var(--surface-2)] text-[var(--muted-text)] border border-[var(--border)]";
  }
}

function daysColor(days: number): string {
  if (days > 60) return "text-red-400";
  if (days > 30) return "text-amber-400";
  return "text-[var(--text)]";
}

function TurnBadge({ status }: { status: string }) {
  if (status === "na") return <span className="text-[var(--muted-text)]">—</span>;
  const label   = status === "good" ? "On track" : status === "warn" ? "Aging" : "At risk";
  const variant = status === "good" ? "success"  : status === "warn" ? "warning" : "danger";
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(variant)}`}>
      {label}
    </span>
  );
}

function MarketCell({ priceToMarket }: { priceToMarket: VehicleListItem["priceToMarket"] }) {
  if (!priceToMarket || priceToMarket.marketStatus === "No Market Data") {
    return <span className="text-[var(--muted-text)]">—</span>;
  }
  const { marketStatus, sourceLabel } = priceToMarket;
  const variant =
    marketStatus === "Below Market" ? "success" :
    marketStatus === "At Market"    ? "info"    : "warning";
  return (
    <span title={sourceLabel} className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${badgeStyle(variant)}`}>
      {marketStatus.replace(" ", "\u00a0")}
    </span>
  );
}

export type VehicleInventoryTableProps = {
  items: VehicleListItem[];
  page: number;
  pageSize: number;
  total: number;
  canRead: boolean;
  canWrite: boolean;
  buildPaginatedUrl: (params: { page: number; pageSize: number }) => string;
  /** Controlled search text — displayed in the search bar. */
  search?: string;
  onSearchChange?: (v: string) => void;
  /** Called when user presses Enter in search or clicks the status filter. */
  onSearch?: () => void;
  /** Controlled status filter value */
  status?: string;
  /** Called when status is changed — should also trigger a URL push. */
  onStatusChange?: (v: string) => void;
  /** Opens the advanced filters dialog */
  onAdvancedFilters?: () => void;
  floorPlannedCount?: number;
  topControls?: React.ReactNode;
  footerControls?: React.ReactNode;
  className?: string;
};

export function VehicleInventoryTable({
  items,
  page,
  pageSize,
  total,
  canRead,
  canWrite,
  buildPaginatedUrl,
  search = "",
  onSearchChange,
  onSearch,
  status = "",
  onStatusChange,
  onAdvancedFilters,
  floorPlannedCount = 0,
  topControls,
  footerControls,
  className,
}: VehicleInventoryTableProps) {
  const router = useRouter();
  const { disabled: writeDisabled } = useWriteDisabled();
  const [renderedAtMs] = React.useState(() => Date.now());

  if (!canRead) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd   = Math.min(page * pageSize, total);

  const goToPage = (newPage: number) =>
    router.push(buildPaginatedUrl({ page: newPage, pageSize }));

  const changePageSize = (newSize: number) =>
    router.push(buildPaginatedUrl({ page: 1, pageSize: newSize }));

  return (
    <section className={cn(tableTokens.shell, "h-fit", className)}>
      <div className="space-y-2.5 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {onAdvancedFilters ? (
            <Button
              variant="secondary"
              onClick={onAdvancedFilters}
              className="h-6.5 shrink-0 rounded-full px-3 text-[11px]"
            >
              Advanced filters
            </Button>
          ) : null}

          <div className="relative w-[min(560px,100%)] min-w-[240px] flex-1 max-w-[560px]">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch?.(); }}
              placeholder="Search..."
              aria-label="Search inventory"
              className="h-8 w-full bg-[var(--surface-2)] pl-8 pr-7 text-[13px]"
            />
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
              aria-hidden
            />
          </div>

          {topControls ? <div className="flex flex-wrap items-center gap-2.5">{topControls}</div> : null}

          <div className="flex-1" />

          {canWrite && !writeDisabled ? (
            <Link href="/inventory/new" className="shrink-0">
              <Button size="sm">
                <Plus size={14} className="mr-1.5" aria-hidden />
                Add Vehicle
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Table ── */}
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[var(--muted-text)]">
          No vehicles match the current filters.
        </div>
      ) : (
        <div className={cn(tableScrollWrapper, "border-t border-[var(--border)]")}>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRow}>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "pl-4")}>Stock #</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Vehicle</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Status</TableHead>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "text-right")} title="Total invested (ledger)">
                  Cost
                </TableHead>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "text-right")}>Price</TableHead>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "text-right")} title="Projected gross (sale − invested)">
                  Profit
                </TableHead>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "text-right")}>Days</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Turn</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Market</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Source</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => {
                const detailHref = inventoryDetailPath(v.id);
                const profit = v.salePriceCents - v.costCents;
                const days   = v.daysInStock ?? Math.floor((renderedAtMs - new Date(v.createdAt).getTime()) / 86_400_000);
                const variant = statusVariant(v.status);
                return (
                  <TableRow
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    className={cn(tableRowHover, tableRowCompact)}
                    onClick={() => router.push(detailHref)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(detailHref);
                      }
                    }}
                  >
                    <TableCell className={cn(tableCellCompact, "pl-4 font-medium")}>
                      <Link
                        href={detailHref}
                        className="text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{v.stockNumber}
                      </Link>
                    </TableCell>
                    <TableCell className={tableCellCompact}>
                      {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className={tableCellCompact}>
                      <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(variant)}`}>
                        {statusLabel(v.status)}
                      </span>
                    </TableCell>
                    <TableCell className={cn(tableCellCompact, "text-right tabular-nums text-[var(--muted-text)]")}>
                      {v.costCents > 0 ? formatCents(String(v.costCents)) : "$0.00"}
                    </TableCell>
                    <TableCell className={cn(tableCellCompact, "text-right tabular-nums font-semibold")}>
                      {v.salePriceCents > 0 ? formatCents(String(v.salePriceCents)) : "$0.00"}
                    </TableCell>
                    <TableCell className={cn(tableCellCompact, "text-right tabular-nums font-bold", profit > 0 ? "text-emerald-400" : profit < 0 ? "text-red-400" : "text-[var(--muted-text)]")}>
                      {formatCents(String(profit))}
                    </TableCell>
                    <TableCell className={cn(tableCellCompact, "text-right tabular-nums font-medium", daysColor(days))}>
                      {days}
                    </TableCell>
                    <TableCell className={tableCellCompact}>
                      <TurnBadge status={v.turnRiskStatus ?? "na"} />
                    </TableCell>
                    <TableCell className={tableCellCompact}>
                      <MarketCell priceToMarket={v.priceToMarket} />
                    </TableCell>
                    <TableCell className={cn(tableCellCompact, "text-[var(--muted-text)]")}>
                      {v.source ?? "—"}
                    </TableCell>
                    <TableCell className={tableCellCompact} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link href={detailHref}>
                          <Button variant="secondary" size="sm" className="h-8 px-3 focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                            View
                          </Button>
                        </Link>
                        {canWrite ? (
                          <WriteGuard>
                            <Link href={inventoryEditPath(v.id)}>
                              <Button variant="ghost" size="sm" className="h-8 px-2.5 focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                                Edit
                              </Button>
                            </Link>
                          </WriteGuard>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Workbench footer ── */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-1.5 text-[11px] text-[var(--muted-text)]">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-6 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 text-[11px] text-[var(--text)] focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>of {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          {footerControls ? <div className="shrink-0">{footerControls}</div> : null}
          <span>Showing {rangeStart}–{rangeEnd} of {total} results</span>
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
