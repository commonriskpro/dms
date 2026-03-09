"use client";

import * as React from "react";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { typography } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { VehicleCostCategory, VehicleCostEntryResponse, VehicleCostDocumentResponse } from "../types";
import { VEHICLE_COST_CATEGORY_LABELS } from "../types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function truncateMemo(memo: string | null, max = 36): string {
  if (!memo) return "—";
  return memo.length <= max ? memo : `${memo.slice(0, max)}…`;
}

function vendorPillClass(category: VehicleCostCategory): string {
  const map: Partial<Record<VehicleCostCategory, string>> = {
    acquisition: "bg-[var(--info-muted)] text-[var(--info-muted-fg)]",
    auction_fee: "bg-[var(--info-muted)] text-[var(--info-muted-fg)]",
    transport: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
    title_fee: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
    recon_parts: "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]",
    recon_labor: "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]",
    detail: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
    inspection: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
  };
  return map[category] ?? "bg-[var(--surface-2)] text-[var(--text-soft)]";
}

const FILTER_SELECT_CLASS =
  "rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] cursor-pointer";

export type CostLedgerCardProps = {
  entries: VehicleCostEntryResponse[];
  docsByEntryId: Map<string, VehicleCostDocumentResponse[]>;
  canWrite: boolean;
  onAddCost: () => void;
  onEditEntry: (entry: VehicleCostEntryResponse) => void;
  onDeleteEntry: (entry: VehicleCostEntryResponse) => void;
};

export function CostLedgerCard({
  entries,
  docsByEntryId,
  canWrite,
  onAddCost,
  onEditEntry,
  onDeleteEntry,
}: CostLedgerCardProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");

  const vendorNames = React.useMemo(
    () => Array.from(new Set(entries.map((e) => e.vendorName).filter(Boolean))) as string[],
    [entries],
  );

  const filtered = React.useMemo(() => {
    let out = entries;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (e) =>
          VEHICLE_COST_CATEGORY_LABELS[e.category].toLowerCase().includes(q) ||
          (e.vendorName ?? "").toLowerCase().includes(q) ||
          (e.memo ?? "").toLowerCase().includes(q),
      );
    }
    if (categoryFilter) out = out.filter((e) => e.category === categoryFilter);
    if (vendorFilter) out = out.filter((e) => e.vendorName === vendorFilter);
    return out;
  }, [entries, search, categoryFilter, vendorFilter]);

  return (
    <DMSCard className="p-0 overflow-hidden">
      {/* Header */}
      <DMSCardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-[var(--border)]">
        <DMSCardTitle className={typography.cardTitle}>Cost Ledger</DMSCardTitle>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button type="button" size="sm" onClick={onAddCost} aria-label="Add cost entry">
              + Add Cost
            </Button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
            aria-label="Filter"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
        </div>
      </DMSCardHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
        <input
          type="search"
          placeholder="Search costs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search cost entries"
          className="flex-1 min-w-[120px] rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className={FILTER_SELECT_CLASS}
        >
          <option value="">All Categories</option>
          {Object.entries(VEHICLE_COST_CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          aria-label="Filter by vendor"
          className={FILTER_SELECT_CLASS}
        >
          <option value="">All Vendors</option>
          {vendorNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <DMSCardContent className="p-0">
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)] px-4 py-5">No cost entries yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)] px-4 py-5">No entries match the current filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border)]">
                  <TableHead className="text-xs px-4 py-2">Date</TableHead>
                  <TableHead className="text-xs py-2">Category</TableHead>
                  <TableHead className="text-xs py-2">Vendor</TableHead>
                  <TableHead className="text-xs py-2 text-right">Amount</TableHead>
                  <TableHead className="text-xs py-2">Memo</TableHead>
                  <TableHead className="text-xs py-2 text-center w-12">Docs</TableHead>
                  <TableHead className="text-xs py-2 w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const docCount = docsByEntryId.get(entry.id)?.length ?? 0;
                  return (
                    <TableRow key={entry.id} className="group border-b border-[var(--border)] last:border-0">
                      <TableCell className="text-sm text-[var(--text)] py-2.5 px-4 whitespace-nowrap">
                        {formatDate(entry.occurredAt)}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--text)] py-2.5 whitespace-nowrap">
                        {VEHICLE_COST_CATEGORY_LABELS[entry.category]}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {entry.vendorName ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                              vendorPillClass(entry.category),
                            )}
                          >
                            {entry.vendorName}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--muted-text)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums text-right py-2.5 whitespace-nowrap">
                        {formatCents(entry.amountCents)}
                      </TableCell>
                      <TableCell
                        className="max-w-[140px] truncate text-sm text-[var(--text-soft)] py-2.5"
                        title={entry.memo ?? undefined}
                      >
                        {truncateMemo(entry.memo)}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--muted-text)] py-2.5 text-center">
                        {docCount > 0 ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] w-5 h-5 text-[10px] font-semibold text-[var(--text)]">
                            {docCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 pr-3">
                        {canWrite && (
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              aria-label={`Edit ${VEHICLE_COST_CATEGORY_LABELS[entry.category]}`}
                              className="rounded px-2 py-1 text-xs text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry)}
                              aria-label={`Remove ${VEHICLE_COST_CATEGORY_LABELS[entry.category]}`}
                              className="rounded px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-muted)] transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] bg-[var(--surface-2)]/30">
            <span className="text-xs text-[var(--muted-text)]">
              Showing {filtered.length} of {entries.length}
            </span>
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
