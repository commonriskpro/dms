"use client";

import * as React from "react";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { modalDepthChip, modalDepthSurfaceStrong, modalFieldTone } from "@/lib/ui/modal-depth";
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

function vendorDotColor(category: VehicleCostCategory): string {
  const map: Partial<Record<VehicleCostCategory, string>> = {
    acquisition: "bg-sky-400",
    auction_fee: "bg-sky-400",
    transport: "bg-rose-400",
    title_fee: "bg-amber-400",
    recon_parts: "bg-blue-400",
    recon_labor: "bg-blue-400",
    detail: "bg-violet-400",
    inspection: "bg-emerald-400",
  };
  return map[category] ?? "bg-[var(--muted-text)]";
}

function DocViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted-text)]" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function DocFileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted-text)]" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DocCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted-text)]" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="9 15 11 17 15 13" />
    </svg>
  );
}

const FILTER_SELECT_CLASS =
  `rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] cursor-pointer ${modalFieldTone}`;

export type CostLedgerCardProps = {
  entries: VehicleCostEntryResponse[];
  docsByEntryId: Map<string, VehicleCostDocumentResponse[]>;
  canWrite: boolean;
  onAddCost: () => void;
  onQuickAddCategory?: (category: VehicleCostCategory) => void;
  onUploadDocument?: () => void;
  onEditEntry: (entry: VehicleCostEntryResponse) => void;
  onDeleteEntry: (entry: VehicleCostEntryResponse) => void;
};

export function CostLedgerCard({
  entries,
  docsByEntryId,
  canWrite,
  onAddCost,
  onQuickAddCategory,
  onUploadDocument,
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
    <DMSCard className={`${modalDepthSurfaceStrong} p-0 overflow-hidden`}>
      {/* Toolbar: search + filters + actions */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)]">
        {/* Search */}
        <div className="relative flex-1 min-w-[120px] max-w-[220px]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Search costs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cost entries"
            className={`h-8 w-full rounded-[var(--radius-input)] pl-8 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] ${modalFieldTone}`}
          />
        </div>

        {/* Category filter */}
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

        {/* Vendor filter */}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export */}
        <button
          type="button"
          onClick={() => {
            const sanitizeCsvField = (val: string) => {
              let s = val.replace(/"/g, '""');
              if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
              return s;
            };
            const header = "Date,Category,Vendor,Amount,Memo";
            const csvRows = filtered.map((e) => {
              const date = sanitizeCsvField(formatDate(e.occurredAt));
              const cat = sanitizeCsvField(VEHICLE_COST_CATEGORY_LABELS[e.category]);
              const vendor = sanitizeCsvField(e.vendorName ?? "");
              const amount = sanitizeCsvField(formatCents(e.amountCents));
              const memo = sanitizeCsvField(e.memo ?? "");
              return `"${date}","${cat}","${vendor}","${amount}","${memo}"`;
            });
            const csv = [header, ...csvRows].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "cost-ledger.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={filtered.length === 0}
          className={`flex h-8 w-8 shrink-0 items-center justify-center ${modalDepthChip} text-[var(--muted-text)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30 disabled:cursor-not-allowed`}
          aria-label="Export cost ledger as CSV"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        {/* Add cost */}
        {canWrite && (
          <button
            type="button"
            onClick={onAddCost}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-input)] bg-[var(--primary)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Add cost entry"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Cost
          </button>
        )}
      </div>

      <DMSCardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border)]">
                <TableHead className="h-10 px-4 text-left text-xs font-medium text-[var(--text-soft)]">Memo</TableHead>
                <TableHead className="h-10 px-4 text-left text-xs font-medium text-[var(--text-soft)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    Date
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-text)]" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </TableHead>
                <TableHead className="h-10 px-4 text-left text-xs font-medium text-[var(--text-soft)]">Category</TableHead>
                <TableHead className="h-10 px-4 text-left text-xs font-medium text-[var(--text-soft)]">Vendor</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-medium text-[var(--text-soft)]">Amount</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-medium text-[var(--text-soft)]">Docs</TableHead>
                {canWrite ? (
                  <TableHead className="h-10 px-4 text-right text-xs font-medium text-[var(--text-soft)]">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 7 : 6} className="px-4 py-8">
                    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--text)]">No cost entries yet</p>
                        <p className="text-sm text-[var(--text-soft)]">
                          Start the ledger with the first real cost that puts this unit into inventory motion.
                        </p>
                      </div>
                      {canWrite ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {([
                            ["acquisition", "Add acquisition"],
                            ["transport", "Add transport"],
                            ["recon_labor", "Add recon"],
                            ["auction_fee", "Add fee"],
                          ] as const).map(([category, label]) => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => (onQuickAddCategory ? onQuickAddCategory(category) : onAddCost())}
                              className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
                            >
                              {label}
                            </button>
                          ))}
                          {onUploadDocument ? (
                            <button
                              type="button"
                              onClick={onUploadDocument}
                              className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
                            >
                              Upload invoice
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-sm text-[var(--text-soft)]">
                    No entries match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                {filtered.map((entry) => {
                  const docCount = docsByEntryId.get(entry.id)?.length ?? 0;
                  return (
                    <TableRow key={entry.id} className="group border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-2)]/40">
                      <TableCell
                        className="px-4 py-3.5 min-w-[280px] max-w-[360px] truncate text-sm text-[var(--text-soft)]"
                        title={entry.memo ?? undefined}
                      >
                        {truncateMemo(entry.memo, 48)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-[var(--text)] whitespace-nowrap">
                        {formatDate(entry.occurredAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-[var(--text)] whitespace-nowrap">
                        {VEHICLE_COST_CATEGORY_LABELS[entry.category]}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        {entry.vendorName ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-1 text-sm font-medium text-[var(--text)] whitespace-nowrap">
                            <span className={cn("h-3 w-3 shrink-0 rounded", vendorDotColor(entry.category))} aria-hidden />
                            {entry.vendorName}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--muted-text)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm font-medium tabular-nums text-right whitespace-nowrap">
                        {formatCents(entry.amountCents)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {docCount > 0 ? (
                            <>
                              {(docsByEntryId.get(entry.id) ?? []).slice(0, 2).map((doc, i) => (
                                <span key={doc.id ?? i} className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)]/50">
                                  {doc.kind === "receipt" ? <DocCheckIcon /> : doc.kind === "invoice" ? <DocFileIcon /> : <DocViewIcon />}
                                </span>
                              ))}
                              {docCount > 2 && (
                                <span className="text-xs font-semibold text-[var(--text-soft)] whitespace-nowrap">
                                  +{docCount - 2}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)]/50 opacity-30">
                                <DocViewIcon />
                              </span>
                              <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)]/50 opacity-30">
                                <DocFileIcon />
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      {canWrite ? (
                        <TableCell className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry)}
                              className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                              aria-label={`Delete ${VEHICLE_COST_CATEGORY_LABELS[entry.category]}`}
                            >
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </>
              )}
            </TableBody>
          </Table>
        </div>

        {entries.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-text)] tabular-nums">
              Showing {filtered.length} of {entries.length} entries
            </span>
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
