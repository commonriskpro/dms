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
import { getSalePriceCents } from "../types";
import { cn } from "@/lib/utils";

function daysInStock(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );
}

function getProjectedGrossCents(v: VehicleResponse): string {
  if (v.projectedGrossCents != null && v.projectedGrossCents !== "") return v.projectedGrossCents;
  return "";
}

const STATUS_CHIP: Record<string, string> = {
  AVAILABLE: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
  HOLD: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
  SOLD: "bg-[var(--info-muted)] text-[var(--info-muted-fg)]",
  WHOLESALE: "bg-[var(--muted)] text-[var(--text-soft)]",
  REPAIR: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
  ARCHIVED: "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]",
};

function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CHIP[status] ?? "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-input)] px-2 py-0.5 text-xs font-medium",
        cls
      )}
    >
      {status}
    </span>
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
                    <TableHead scope="col">VIN</TableHead>
                    <TableHead scope="col">Mileage</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Sale price</TableHead>
                    <TableHead scope="col">Projected gross</TableHead>
                    <TableHead scope="col">Location</TableHead>
                    <TableHead scope="col">Days in stock</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => {
                    const saleCents = getSalePriceCents(v);
                    const projectedCents = getProjectedGrossCents(v);
                    return (
                      <TableRow
                        key={v.id}
                        className="cursor-pointer hover:bg-[var(--surface-2)]/60 transition-colors"
                        onClick={() => router.push(`/inventory/${v.id}`)}
                      >
                        <TableCell className="font-medium">{v.stockNumber}</TableCell>
                        <TableCell>
                          {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{v.vin ?? "—"}</TableCell>
                        <TableCell>
                          {v.mileage != null ? v.mileage.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={v.status} />
                        </TableCell>
                        <TableCell>
                          {saleCents !== "" ? formatCents(saleCents) : "—"}
                        </TableCell>
                        <TableCell>
                          {projectedCents !== "" ? formatCents(projectedCents) : "—"}
                        </TableCell>
                        <TableCell>{v.location?.name ?? "—"}</TableCell>
                        <TableCell>{daysInStock(v.createdAt)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Link href={`/inventory/${v.id}`}>
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
