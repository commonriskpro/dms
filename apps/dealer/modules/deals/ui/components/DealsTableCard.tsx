"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
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
import type { DealListItem, DealStatus } from "../types";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<DealStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  STRUCTURED: "info",
  APPROVED: "warning",
  CONTRACTED: "success",
  CANCELED: "danger",
};

function StatusChip({ status }: { status: DealStatus }) {
  return <StatusBadge variant={STATUS_CHIP[status] ?? "neutral"}>{status}</StatusBadge>;
}

function vehicleDisplay(v: DealListItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || "—";
}

function customerDisplay(d: DealListItem): string {
  if (d.customer?.name) return d.customer.name;
  return d.customerId.slice(0, 8);
}

export type DealsTableCardProps = {
  deals: DealListItem[];
  meta: { total: number; limit: number; offset: number };
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (offset: number) => void;
  canRead: boolean;
  canWrite: boolean;
  className?: string;
};

export function DealsTableCard({
  deals,
  meta,
  loading,
  error,
  onRetry,
  onPageChange,
  canRead,
  canWrite,
  className,
}: DealsTableCardProps) {
  const router = useRouter();
  const { disabled: writeDisabled } = useWriteDisabled();

  if (!canRead) {
    return null;
  }

  const state = loading ? "loading" : error ? "error" : deals.length === 0 ? "empty" : "default";

  return (
    <TableLayout
      className={className}
      state={state}
      errorMessage={error ?? undefined}
      onRetry={onRetry}
      emptyTitle="No deals yet"
      emptyDescription="Create your first deal to get started."
      toolbar={
        <TableToolbar
          search={<span className="text-sm font-semibold text-[var(--text)]">Deals</span>}
          actions={
            canWrite && !writeDisabled ? (
              <Button size="sm" onClick={() => router.push("/deals/new")}>
                New Deal
              </Button>
            ) : null
          }
        />
      }
      pagination={<Pagination meta={meta} onPageChange={onPageChange} />}
    >
      <div className={tableScrollWrapper}>
        <Table>
          <TableHeader>
            <TableRow className={tableHeaderRow}>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Deal #</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Customer</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Vehicle</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Status</ColumnHeader></TableHead>
              <TableHead scope="col" className={cn(tableHeadCell, "text-right")}><ColumnHeader>Amount</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Lender</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}><ColumnHeader>Created</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCell}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/60"
                onClick={() => router.push(`/deals/${d.id}`)}
              >
                <TableCell className={cn(tableCell, "font-medium")}>{d.id.slice(0, 8)}</TableCell>
                <TableCell className={tableCell}>{customerDisplay(d)}</TableCell>
                <TableCell className={tableCell}>{vehicleDisplay(d.vehicle)}</TableCell>
                <TableCell className={tableCell}>
                  <StatusChip status={d.status} />
                </TableCell>
                <TableCell className={cn(tableCell, "text-right")}>
                  {formatCents(d.salePriceCents)}
                </TableCell>
                <TableCell className={tableCell}>—</TableCell>
                <TableCell className={tableCell}>
                  {new Date(d.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className={tableCell} onClick={(e) => e.stopPropagation()}>
                  <RowActions>
                    <Link href={`/deals/${d.id}`}>
                      <Button variant="secondary" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                        View
                      </Button>
                    </Link>
                    {canWrite ? (
                      <WriteGuard>
                        <Link href={`/deals/${d.id}/edit`}>
                          <Button variant="ghost" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                            Edit
                          </Button>
                        </Link>
                      </WriteGuard>
                    ) : null}
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableLayout>
  );
}
