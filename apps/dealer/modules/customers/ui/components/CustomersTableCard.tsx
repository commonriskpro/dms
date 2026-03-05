"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
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
import {
  tableScrollWrapper,
  tableHeaderRow,
  tableRowHover,
  tableHeadCell,
  tableCell,
  tablePaginationFooter,
} from "@/lib/ui/recipes/table";
import { getStageLabel } from "@/lib/constants/crm-stages";
import type { CustomerListItem } from "@/lib/types/customers";
import { badgeBase, badgeNeutral, badgeSuccess, badgeInfo } from "@/lib/ui/recipes/badge";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<string, string> = {
  LEAD: badgeInfo,
  ACTIVE: badgeSuccess,
  SOLD: badgeSuccess,
  INACTIVE: badgeNeutral,
};

function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CHIP[status] ?? badgeNeutral;
  return (
    <span className={cn(badgeBase, cls)}>
      {getStageLabel(status)}
    </span>
  );
}

function TypeBadge({ status }: { status: string }) {
  const label = status === "LEAD" ? "Lead" : status === "INACTIVE" ? "Inactive" : "Customer";
  const cls = status === "LEAD" ? badgeInfo : status === "INACTIVE" ? badgeNeutral : badgeSuccess;
  return <span className={cn(badgeBase, cls)}>{label}</span>;
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
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const currentPage = Math.floor(meta.offset / meta.limit) + 1;

  if (!canRead) {
    return null;
  }

  return (
    <DMSCard className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <p className="text-sm text-[var(--text-soft)]">
          {entriesLabel ?? `Showing ${meta.offset + 1} to ${Math.min(meta.offset + meta.limit, meta.total)} of ${meta.total.toLocaleString()} entries`}
        </p>
        {compactPagination && (
          <CompactPagination
            currentPage={compactPagination.currentPage}
            totalPages={compactPagination.totalPages}
            onPageChange={(p) => compactPagination.onPageChange(p)}
          />
        )}
      </div>
      <DMSCardContent className="p-0 flex flex-col flex-1 min-h-0">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={onRetry} />
          </div>
        ) : data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No customers"
              description="Add your first customer to get started."
              actionLabel={canWrite ? "New Customer" : undefined}
              onAction={canWrite ? () => router.push("/customers/new") : undefined}
            />
          </div>
        ) : (
          <>
            <div className={tableScrollWrapper}>
              <Table>
                <TableHeader>
                  <TableRow className={tableHeaderRow}>
                    <TableHead scope="col" className={cn(tableHeadCell, "w-10")}>
                      <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" aria-label="Select all" />
                    </TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Name</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Contact</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Type</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Status</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Vehicles</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Last Visit</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Deals</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Source</TableHead>
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
                        className={cn(tableRowHover, "cursor-pointer")}
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
                          {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell className={tableCell}>—</TableCell>
                        <TableCell className={tableCell}>{c.leadSource ?? "—"}</TableCell>
                        <TableCell className={tableCell}>
                          <span className="text-[var(--text-soft)]" aria-hidden>›</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className={tablePaginationFooter}>
              <Pagination meta={meta} onPageChange={onPageChange} />
            </div>
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
