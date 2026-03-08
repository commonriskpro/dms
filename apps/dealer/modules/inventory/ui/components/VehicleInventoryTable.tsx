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
  tableHeadCellCompact,
  tableCellCompact,
  tableRowHover,
  tableRowCompact,
} from "@/lib/ui/recipes/table";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/modules/inventory/service/inventory-page";

const STATUS_CHIP: Record<string, "success" | "warning" | "info" | "neutral" | "danger"> = {
  AVAILABLE: "success",
  HOLD: "warning",
  SOLD: "info",
  WHOLESALE: "neutral",
  REPAIR: "warning",
  ARCHIVED: "danger",
};

function StatusChip({ status }: { status: string }) {
  return <StatusBadge variant={STATUS_CHIP[status] ?? "neutral"}>{status}</StatusBadge>;
}

function daysInInventory(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

function TurnRiskBadge({ status }: { status: string }) {
  if (status === "na") return <span className="text-[var(--muted-text)]">—</span>;
  const label = status === "good" ? "On track" : status === "warn" ? "Aging" : "At risk";
  const variant = status === "good" ? "success" : status === "warn" ? "warning" : "danger";
  return <StatusBadge variant={variant}>{label}</StatusBadge>;
}

function MarketBadge({ status, sourceLabel }: { status: string; sourceLabel: string }) {
  if (status === "No Market Data") return <span className="text-[var(--muted-text)]">—</span>;
  return (
    <span title={sourceLabel}>
      <StatusBadge variant={status === "Below Market" ? "success" : status === "At Market" ? "info" : "warning"} className="whitespace-nowrap">
        {status.replace(" ", "\u00a0")}
      </StatusBadge>
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
  /** Build URL for pagination (e.g. /inventory?page=2&pageSize=25). */
  buildPaginatedUrl: (params: { page: number; pageSize: number }) => string;
  /** Optional filter bar rendered inside the card, below the title and above the table. */
  filterBar?: React.ReactNode;
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
  filterBar,
  className,
}: VehicleInventoryTableProps) {
  const router = useRouter();
  const { disabled: writeDisabled } = useWriteDisabled();

  if (!canRead) return null;

  const offset = (page - 1) * pageSize;
  const meta = { total, limit: pageSize, offset };
  const state = items.length === 0 ? "empty" : "default";

  return (
    <TableLayout
      className={className}
      state={state}
      emptyTitle="No vehicles"
      emptyDescription="Add your first vehicle to get started."
      toolbar={
        <TableToolbar
          search={<span className="text-sm font-semibold text-[var(--text)]">Vehicle Inventory</span>}
          filters={filterBar}
          actions={
            canWrite && !writeDisabled ? (
              <Button size="sm" onClick={() => router.push("/inventory/new")}>
                Add vehicle
              </Button>
            ) : null
          }
        />
      }
      pagination={
        <Pagination
          meta={meta}
          onPageChange={(newOffset) => {
            const newPage = Math.floor(newOffset / pageSize) + 1;
            router.push(buildPaginatedUrl({ page: newPage, pageSize }));
          }}
        />
      }
    >
      <div className={tableScrollWrapper}>
        <Table>
          <TableHeader>
            <TableRow className={tableHeaderRow}>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Stock #</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Vehicle</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Status</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Feed</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Price</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Cost</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Floor Plan</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Days</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Turn</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Market</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}><ColumnHeader>Source</ColumnHeader></TableHead>
              <TableHead scope="col" className={tableHeadCellCompact}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((v) => {
              const detailHref = `/inventory/${v.id}/edit`;
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
                  <TableCell className={cn(tableCellCompact, "font-medium")}>
                    <Link
                      href={detailHref}
                      className="text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {v.stockNumber}
                    </Link>
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    <StatusChip status={v.status} />
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    {v.status === "AVAILABLE" ? (
                      <StatusBadge variant="info" className="whitespace-nowrap">
                        In feed
                      </StatusBadge>
                    ) : (
                      <span className="text-[var(--text-soft)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    {v.salePriceCents > 0 ? formatCents(String(v.salePriceCents)) : "$0.00"}
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    {v.costCents > 0 ? formatCents(String(v.costCents)) : "$0.00"}
                  </TableCell>
                  <TableCell className={tableCellCompact}>{v.floorPlanLenderName ?? "—"}</TableCell>
                  <TableCell className={tableCellCompact}>
                    {v.daysInStock != null ? v.daysInStock : daysInInventory(v.createdAt)}
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    <TurnRiskBadge status={v.turnRiskStatus ?? "na"} />
                  </TableCell>
                  <TableCell className={tableCellCompact}>
                    {v.priceToMarket ? (
                      <MarketBadge
                        status={v.priceToMarket.marketStatus}
                        sourceLabel={v.priceToMarket.sourceLabel}
                      />
                    ) : (
                      <span className="text-[var(--muted-text)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className={tableCellCompact}>{v.source ?? "—"}</TableCell>
                  <TableCell className={tableCellCompact} onClick={(e) => e.stopPropagation()}>
                    <RowActions>
                      <Link href={detailHref}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          View
                        </Button>
                      </Link>
                      {canWrite ? (
                        <WriteGuard>
                          <Link href={`/inventory/${v.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            >
                              Edit
                            </Button>
                          </Link>
                        </WriteGuard>
                      ) : null}
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
