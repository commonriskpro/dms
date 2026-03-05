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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import type { VehicleResponse } from "../types";
import { getSalePriceCents, getAuctionCostCents } from "../types";
import { badgeBase, badgeNeutral, badgeSuccess, badgeWarning, badgeDanger, badgeInfo, badgeMuted } from "@/lib/ui/recipes/badge";
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
  return (
    <span className={cn(badgeBase, cls)}>
      {status}
    </span>
  );
}

function daysInStock(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );
}

export type InventoryTableCardProps = {
  vehicles: VehicleResponse[];
  meta: { total: number; limit: number; offset: number };
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (offset: number) => void;
  canRead: boolean;
  canWrite: boolean;
  className?: string;
};

export function InventoryTableCard({
  vehicles,
  meta,
  loading,
  error,
  onRetry,
  onPageChange,
  canRead,
  canWrite,
  className,
}: InventoryTableCardProps) {
  const router = useRouter();
  const { disabled: writeDisabled } = useWriteDisabled();

  if (!canRead) {
    return null;
  }

  return (
    <DMSCard className={cn("flex flex-col overflow-hidden", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Inventory List</DMSCardTitle>
      </DMSCardHeader>
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
        ) : vehicles.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No vehicles"
              description="Add your first vehicle to get started."
              actionLabel={canWrite && !writeDisabled ? "Add vehicle" : undefined}
              onAction={canWrite && !writeDisabled ? () => router.push("/inventory/new") : undefined}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] hover:bg-[var(--surface)]">
                    <TableHead scope="col">Stock #</TableHead>
                    <TableHead scope="col">Year / Make / Model</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Price</TableHead>
                    <TableHead scope="col">Cost</TableHead>
                    <TableHead scope="col">Floor Plan</TableHead>
                    <TableHead scope="col">Days</TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => {
                    const saleCents = getSalePriceCents(v);
                    const costCents = getAuctionCostCents(v);
                    const detailHref = `/inventory/${v.id}`;
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
                          {saleCents !== "" ? formatCents(saleCents) : "—"}
                        </TableCell>
                        <TableCell>
                          {costCents !== "" ? formatCents(costCents) : "—"}
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>{daysInStock(v.createdAt)}</TableCell>
                        <TableCell>—</TableCell>
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
              <Pagination meta={meta} onPageChange={onPageChange} />
            </div>
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
