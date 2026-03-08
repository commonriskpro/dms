"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TableLayout, TableToolbar, ColumnHeader, RowActions, StatusBadge } from "@/components/ui-system/tables";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import {
  tableScrollWrapper,
  tableHeaderRow,
  tableHeadCell,
  tableCell,
} from "@/lib/ui/recipes/table";
import { getStageLabel } from "@/lib/constants/crm-stages";
import type { CustomerListItem } from "@/lib/types/customers";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

function LastVisitCell({ lastVisitAt }: { lastVisitAt: string | null }) {
  if (!lastVisitAt) {
    return <span className="text-[var(--text-soft)]">Never</span>;
  }
  const exact = new Date(lastVisitAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Tooltip content={exact} side="top">
      <span className="text-[var(--text)] cursor-default">{formatRelativeTime(lastVisitAt)}</span>
    </Tooltip>
  );
}

const STATUS_CHIP: Record<string, "info" | "success" | "neutral"> = {
  LEAD: "info",
  ACTIVE: "success",
  SOLD: "success",
  INACTIVE: "neutral",
};

function StatusChip({ status }: { status: string }) {
  return <StatusBadge variant={STATUS_CHIP[status] ?? "neutral"}>{getStageLabel(status)}</StatusBadge>;
}

function TypeBadge({ status }: { status: string }) {
  const label = status === "LEAD" ? "Lead" : status === "INACTIVE" ? "Inactive" : "Customer";
  const variant = status === "LEAD" ? "info" : status === "INACTIVE" ? "neutral" : "success";
  return <StatusBadge variant={variant}>{label}</StatusBadge>;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type CompactPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function CompactPagination({ currentPage, totalPages, onPageChange }: CompactPaginationProps) {
  const pages: number[] = [];
  const show = 5;
  let start = Math.max(1, currentPage - Math.floor(show / 2));
  let end = Math.min(totalPages, start + show - 1);
  if (end - start + 1 < show) start = Math.max(1, end - show + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-8 min-w-8 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-50 hover:bg-[var(--surface-2)]"
        aria-label="Previous"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={cn(
            "h-8 min-w-8 rounded-[var(--radius-button)] text-sm font-medium",
            p === currentPage
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-8 min-w-8 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-50 hover:bg-[var(--surface-2)]"
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
}

export type CustomersTableCardProps = {
  data: CustomerListItem[];
  meta: { total: number; limit: number; offset: number };
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (offset: number) => void;
  canRead: boolean;
  canWrite: boolean;
  entriesLabel?: string;
  compactPagination?: CompactPaginationProps;
  className?: string;
};

export function CustomersTableCard({
  data,
  meta,
  loading,
  error,
  onRetry,
  onPageChange,
  canRead,
  canWrite,
  entriesLabel,
  compactPagination,
  className,
}: CustomersTableCardProps) {
  const router = useRouter();

  if (!canRead) {
    return null;
  }

  const state = loading ? "loading" : error ? "error" : data.length === 0 ? "empty" : "default";

  return (
    <TableLayout
      state={state}
      className={className}
      errorMessage={error ?? undefined}
      onRetry={onRetry}
      emptyTitle="No customers"
      emptyDescription="Add your first customer to get started."
      toolbar={
        <TableToolbar
          search={
            <p className="text-sm text-[var(--text-soft)]">
              {entriesLabel ?? `Showing ${meta.offset + 1} to ${Math.min(meta.offset + meta.limit, meta.total)} of ${meta.total.toLocaleString()} entries`}
            </p>
          }
          actions={
            <div className="flex items-center gap-2">
              {canWrite ? (
                <Button size="sm" onClick={() => router.push("/customers/new")}>
                  Add Customer
                </Button>
              ) : null}
              {compactPagination ? (
                <CompactPagination
                  currentPage={compactPagination.currentPage}
                  totalPages={compactPagination.totalPages}
                  onPageChange={(p) => compactPagination.onPageChange(p)}
                />
              ) : null}
            </div>
          }
        />
      }
      pagination={<Pagination meta={meta} onPageChange={onPageChange} />}
    >
      <div className={tableScrollWrapper}>
        <Table>
          <TableHeader>
            <TableRow className={tableHeaderRow}>
              <TableHead scope="col" className={cn(tableHeadCell, "w-10")}>
                <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" aria-label="Select all" />
              </TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Name</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Contact</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Type</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Status</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Vehicles</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Last Visit</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Deals</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Source</ColumnHeader></TableHead>
              <TableHead scope="col" className={cn(tableHeadCell, "w-10")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => {
              const detailHref = `/customers/${c.id}`;
              return (
                <TableRow
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/60"
                  onClick={() => router.push(detailHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(detailHref);
                    }
                  }}
                >
                  <TableCell className={tableCell} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" aria-label={`Select ${c.name}`} />
                  </TableCell>
                  <TableCell className={tableCell}>
                    <Link
                      href={detailHref}
                      className="flex items-center gap-3 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-medium text-[var(--text)]"
                        aria-hidden
                      >
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-[var(--text)] block truncate">{c.name}</span>
                        <span className="text-sm text-[var(--text-soft)] block truncate">{c.primaryEmail ?? "—"}</span>
                      </div>
                      <span className="shrink-0 text-[var(--text-soft)]" aria-hidden>›</span>
                    </Link>
                  </TableCell>
                  <TableCell className={tableCell}>
                    <span className="block text-[var(--text)]">{c.primaryPhone ?? "—"}</span>
                    <span className="block text-sm text-[var(--text-soft)]">{c.primaryEmail ?? "—"}</span>
                  </TableCell>
                  <TableCell className={tableCell}>
                    <TypeBadge status={c.status} />
                  </TableCell>
                  <TableCell className={tableCell}>
                    <StatusChip status={c.status} />
                  </TableCell>
                  <TableCell className={tableCell}>—</TableCell>
                  <TableCell className={tableCell}>
                    <LastVisitCell lastVisitAt={c.lastVisitAt ?? null} />
                  </TableCell>
                  <TableCell className={tableCell}>—</TableCell>
                  <TableCell className={tableCell}>{c.leadSource ?? "—"}</TableCell>
                  <TableCell className={tableCell}>
                    <RowActions>
                      <span className="text-[var(--text-soft)]" aria-hidden>›</span>
                    </RowActions>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TableLayout>
  );
}
