"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { Tooltip } from "@/components/ui/tooltip";
import type { CustomerListItem } from "@/lib/types/customers";
import { customerDetailPath, customerDraftPath } from "@/lib/routes/detail-paths";

const STATUS_OPTIONS = [
  { value: "",         label: "All Statuses" },
  { value: "LEAD",     label: "Prospect" },
  { value: "ACTIVE",   label: "Active" },
  { value: "SOLD",     label: "Sold" },
  { value: "INACTIVE", label: "Archived" },
];

function statusVariant(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "ACTIVE") return "success";
  if (s === "LEAD")   return "info";
  if (s === "SOLD")   return "warning";
  return "neutral";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    LEAD: "Prospect",
    ACTIVE: "Active",
    SOLD: "Sold",
    INACTIVE: "Archived",
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

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay === 1) return "1 day ago";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? "s" : ""} ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type CustomersTableCardProps = {
  data: CustomerListItem[];
  canRead: boolean;
  canWrite: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSearch: () => void;
  status: string;
  onStatusChange: (v: string) => void;
  total?: number;
  page?: number;
  pageSize?: number;
  meta?: { total: number; limit: number; offset: number };
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPageChange?: (offset: number) => void;
  buildPaginatedUrl?: (params: { page: number; pageSize: number }) => string;
  className?: string;
};

export function CustomersTableCard({
  data,
  canRead,
  canWrite,
  search,
  onSearchChange,
  onSearch,
  status,
  onStatusChange,
  total,
  page,
  pageSize,
  meta,
  loading = false,
  error = null,
  onRetry,
  onPageChange,
  buildPaginatedUrl,
  className,
}: CustomersTableCardProps) {
  const router = useRouter();

  if (!canRead) return null;

  const resolvedTotal = total ?? meta?.total ?? data.length;
  const resolvedPageSize = pageSize ?? meta?.limit ?? 25;
  const resolvedPage =
    page ?? (meta ? Math.floor(meta.offset / Math.max(1, meta.limit)) + 1 : 1);
  const totalPages = Math.max(1, Math.ceil(resolvedTotal / resolvedPageSize));
  const rangeStart = resolvedTotal === 0 ? 0 : (resolvedPage - 1) * resolvedPageSize + 1;
  const rangeEnd = Math.min(resolvedPage * resolvedPageSize, resolvedTotal);

  const goToPage = (newPage: number) => {
    if (buildPaginatedUrl) {
      router.push(buildPaginatedUrl({ page: newPage, pageSize: resolvedPageSize }));
      return;
    }
    onPageChange?.((newPage - 1) * resolvedPageSize);
  };

  const changePageSize = (newSize: number) => {
    if (buildPaginatedUrl) {
      router.push(buildPaginatedUrl({ page: 1, pageSize: newSize }));
      return;
    }
    onPageChange?.(0);
  };

  return (
    <section className={cn(tableTokens.shell, className)}>
      {/* ── Workbench header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <span className="shrink-0 text-base font-semibold text-[var(--text)]">Customers</span>

        {/* Search bar */}
        <div className="relative w-64 min-w-[180px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
            placeholder="Search..."
            aria-label="Search customers"
            className="h-8 w-full bg-[var(--surface-2)] pl-8 pr-7 text-sm"
          />
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
            aria-hidden
          />
        </div>

        {/* Status filter */}
        <div className="shrink-0">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={onStatusChange}
            aria-label="Filter by status"
          />
        </div>

        <div className="flex-1" />

        {/* New Customer */}
        {canWrite && (
          <Link href="/customers/new" className="shrink-0">
            <Button size="sm">
              <Plus size={14} className="mr-1.5" aria-hidden />
              New Customer
            </Button>
          </Link>
        )}
      </div>

      {/* ── Table ── */}
      {error ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--danger)]">
          <p>{error}</p>
          {onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mt-3">
              Retry
            </Button>
          ) : null}
        </div>
      ) : loading && data.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--muted-text)]">
          Loading customers…
        </div>
      ) : data.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--muted-text)]">
          No customers match the current filters.
        </div>
      ) : (
        <div className={tableScrollWrapper}>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRow}>
                <TableHead scope="col" className={cn(tableHeadCellCompact, "pl-4")}>Name</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Status</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Salesperson</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Last Contacted</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Follow-Up / Task</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>Source</TableHead>
                <TableHead scope="col" className={tableHeadCellCompact}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const detailHref = c.isDraft ? customerDraftPath(c.id) : customerDetailPath(c.id);
                const variant = statusVariant(c.status);
                return (
                  <TableRow
                    key={c.id}
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
                    {/* Name: avatar + name + email + phone */}
                    <TableCell className={cn(tableCellCompact, "pl-4")}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs font-semibold text-[var(--text)]"
                          aria-hidden
                        >
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-[var(--text)] block truncate leading-tight">{c.name}</span>
                          {c.isDraft && (
                            <span className="mt-1 inline-flex items-center rounded-[var(--radius-pill)] border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                              Draft
                            </span>
                          )}
                          {c.primaryEmail && (
                            <span className="text-xs text-[var(--muted-text)] block truncate leading-tight">{c.primaryEmail}</span>
                          )}
                          {c.primaryPhone && (
                            <span className="text-xs text-[var(--muted-text)] block truncate leading-tight">{c.primaryPhone}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Status badge */}
                    <TableCell className={tableCellCompact}>
                      <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(variant)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </TableCell>

                    {/* Salesperson */}
                    <TableCell className={tableCellCompact}>
                      <span className="text-[var(--text)]">
                        {c.assignedToProfile?.fullName ?? "—"}
                      </span>
                    </TableCell>

                    {/* Last Contacted */}
                    <TableCell className={tableCellCompact}>
                      {c.lastVisitAt ? (
                        <Tooltip content={new Date(c.lastVisitAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} side="top">
                          <span className="text-[var(--text)] cursor-default">{formatRelativeTime(c.lastVisitAt)}</span>
                        </Tooltip>
                      ) : (
                        <span className="text-[var(--muted-text)]">—</span>
                      )}
                    </TableCell>

                    {/* Follow-Up / Task */}
                    <TableCell className={tableCellCompact}>
                      <span className="text-[var(--muted-text)]">—</span>
                    </TableCell>

                    {/* Source */}
                    <TableCell className={cn(tableCellCompact, "text-[var(--muted-text)]")}>
                      {c.leadSource ?? "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className={tableCellCompact} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Link href={detailHref}>
                          <Button variant="secondary" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                            {c.isDraft ? "Resume" : "View"}
                          </Button>
                        </Link>
                        {canWrite && (
                          <Link href={detailHref}>
                            <Button variant="ghost" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                              {c.isDraft ? "Edit Draft" : "Edit"}
                            </Button>
                          </Link>
                        )}
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
      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-text)]">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={resolvedPageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-6 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 text-xs text-[var(--text)] focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>of {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, resolvedPage + 1))}
            disabled={resolvedPage >= totalPages}
            aria-label="Next page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span>Showing {rangeStart}–{rangeEnd} of {resolvedTotal} results</span>
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, resolvedPage - 1))}
            disabled={resolvedPage <= 1}
            aria-label="Previous page"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-text)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, resolvedPage + 1))}
            disabled={resolvedPage >= totalPages}
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
