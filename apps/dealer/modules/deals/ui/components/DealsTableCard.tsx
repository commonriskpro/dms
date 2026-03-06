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
import {
  tableScrollWrapper,
  tableHeaderRow,
  tableRowHover,
  tableHeadCell,
  tableCell,
  tablePaginationFooter,
} from "@/lib/ui/recipes/table";
import type { DealListItem, DealStatus } from "../types";
import { badgeBase, badgeNeutral, badgeSuccess, badgeWarning, badgeDanger, badgeInfo } from "@/lib/ui/recipes/badge";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<DealStatus, string> = {
  DRAFT: badgeNeutral,
  STRUCTURED: badgeInfo,
  APPROVED: badgeWarning,
  CONTRACTED: badgeSuccess,
  CANCELED: badgeDanger,
};

function StatusChip({ status }: { status: DealStatus }) {
  const cls = STATUS_CHIP[status] ?? badgeNeutral;
  return (
    <span className={cn(badgeBase, cls)}>
      {status}
    </span>
  );
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

  return (
    <DMSCard className={cn("flex flex-col overflow-hidden", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Deals</DMSCardTitle>
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
        ) : deals.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No deals yet"
              description="Create your first deal to get started."
              actionLabel={canWrite && !writeDisabled ? "New Deal" : undefined}
              onAction={canWrite && !writeDisabled ? () => router.push("/deals/new") : undefined}
            />
          </div>
        ) : (
          <>
            <div className={tableScrollWrapper}>
              <Table>
                <TableHeader>
                  <TableRow className={tableHeaderRow}>
                    <TableHead scope="col" className={tableHeadCell}>Deal #</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Customer</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Vehicle</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Status</TableHead>
                    <TableHead scope="col" className={cn(tableHeadCell, "text-right")}>Amount</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Lender</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Created</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => (
                    <TableRow
                      key={d.id}
                      className={tableRowHover}
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
                        <div className="flex gap-2">
                          <Link href={`/deals/${d.id}`}>
                            <Button variant="secondary" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                              View
                            </Button>
                          </Link>
                          {canWrite && (
                            <WriteGuard>
                              <Link href={`/deals/${d.id}/edit`}>
                                <Button variant="ghost" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                                  Edit
                                </Button>
                              </Link>
                            </WriteGuard>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
