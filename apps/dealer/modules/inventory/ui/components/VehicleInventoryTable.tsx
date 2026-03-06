"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import type { VehicleListItem } from "@/modules/inventory/service/inventory-page";
import { badgeBase, badgeNeutral, badgeSuccess, badgeWarning, badgeInfo, badgeMuted, badgeDanger } from "@/lib/ui/recipes/badge";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<string, string> = {
  AVAILABLE: badgeSuccess,
  HOLD: badgeWarning,
  SOLD: badgeInfo,
  WHOLESALE: badgeMuted,
  REPAIR: badgeWarning,
  ARCHIVED: badgeDanger,
};

function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CHIP[status] ?? badgeNeutral;
  return <span className={cn(badgeBase, cls)}>{status}</span>;
}

function daysInInventory(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

function TurnRiskBadge({ status }: { status: string }) {
  if (status === "na") return <span className="text-[var(--muted-text)]">—</span>;
  const label = status === "good" ? "On track" : status === "warn" ? "Aging" : "At risk";
  const cls =
    status === "good"
      ? badgeSuccess
      : status === "warn"
        ? badgeWarning
        : badgeDanger;
  return <span className={cn(badgeBase, cls)}>{label}</span>;
}

function MarketBadge({ status, sourceLabel }: { status: string; sourceLabel: string }) {
  if (status === "No Market Data") return <span className="text-[var(--muted-text)]">—</span>;
  const cls =
    status === "Below Market"
      ? badgeSuccess
      : status === "At Market"
        ? badgeInfo
        : badgeWarning;
  return (
    <span className={cn(badgeBase, cls)} title={sourceLabel}>
      {status.replace(" ", "\u00a0")}
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

  return (
    <DMSCard className={cn("flex flex-col overflow-hidden", className)}>
      <DMSCardHeader
        className={cn(
          "gap-2 mb-0",
          filterBar && "flex flex-row flex-wrap items-center justify-between gap-3"
        )}
      >
        <DMSCardTitle className={filterBar ? "shrink-0" : undefined}>Vehicle Inventory</DMSCardTitle>
        {filterBar ?? null}
      </DMSCardHeader>
      <DMSCardContent className="p-0 flex flex-col flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No vehicles"
              description="Add your first vehicle to get started."
              actionLabel={canWrite && !writeDisabled ? "Add vehicle" : undefined}
              onAction={
                canWrite && !writeDisabled ? () => router.push("/inventory/new") : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] hover:bg-[var(--surface)]">
                    <TableHead scope="col">Stock #</TableHead>
                    <TableHead scope="col">Vehicle</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Price</TableHead>
                    <TableHead scope="col">Cost</TableHead>
                    <TableHead scope="col">Floor Plan</TableHead>
                    <TableHead scope="col">Days</TableHead>
                    <TableHead scope="col">Turn</TableHead>
                    <TableHead scope="col">Market</TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col">
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
                        className="cursor-pointer hover:bg-[var(--surface-2)]/60 transition-colors"
                        onClick={() => router.push(detailHref)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(detailHref);
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          <Link
                            href={detailHref}
                            className="text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {v.stockNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={v.status} />
                        </TableCell>
                        <TableCell>
                          {v.salePriceCents > 0 ? formatCents(String(v.salePriceCents)) : "$0.00"}
                        </TableCell>
                        <TableCell>
                          {v.costCents > 0 ? formatCents(String(v.costCents)) : "$0.00"}
                        </TableCell>
                        <TableCell>{v.floorPlanLenderName ?? "—"}</TableCell>
                        <TableCell>
                          {v.daysInStock != null ? v.daysInStock : daysInInventory(v.createdAt)}
                        </TableCell>
                        <TableCell>
                          <TurnRiskBadge status={v.turnRiskStatus ?? "na"} />
                        </TableCell>
                        <TableCell>
                          {v.priceToMarket ? (
                            <MarketBadge
                              status={v.priceToMarket.marketStatus}
                              sourceLabel={v.priceToMarket.sourceLabel}
                            />
                          ) : (
                            <span className="text-[var(--muted-text)]">—</span>
                          )}
                        </TableCell>
                        <TableCell>{v.source ?? "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Link href={detailHref}>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                              >
                                View
                              </Button>
                            </Link>
                            {canWrite && (
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-[var(--border)] p-4 bg-[var(--surface)]">
              <Pagination
                meta={meta}
                onPageChange={(newOffset) => {
                  const newPage = Math.floor(newOffset / pageSize) + 1;
                  router.push(buildPaginatedUrl({ page: newPage, pageSize }));
                }}
              />
            </div>
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
