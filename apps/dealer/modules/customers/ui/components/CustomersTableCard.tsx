"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export type CustomersTableCardProps = {
  data: CustomerListItem[];
  meta: { total: number; limit: number; offset: number };
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (offset: number) => void;
  canRead: boolean;
  canWrite: boolean;
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
  className,
}: CustomersTableCardProps) {
  const router = useRouter();
  const { disabled: writeDisabled } = useWriteDisabled();

  if (!canRead) {
    return null;
  }

  return (
    <DMSCard className={cn("flex flex-col overflow-hidden", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Customers</DMSCardTitle>
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
        ) : data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No customers"
              description="Add your first customer to get started."
              actionLabel={canWrite && !writeDisabled ? "New Customer" : undefined}
              onAction={canWrite && !writeDisabled ? () => router.push("/customers/new") : undefined}
            />
          </div>
        ) : (
          <>
            <div className={tableScrollWrapper}>
              <Table>
                <TableHeader>
                  <TableRow className={tableHeaderRow}>
                    <TableHead scope="col" className={tableHeadCell}>Customer</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Phone</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Email</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Lead Source</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Status</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>Last Activity</TableHead>
                    <TableHead scope="col" className={tableHeadCell}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow
                      key={c.id}
                      className={tableRowHover}
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      <TableCell className={cn(tableCell, "font-medium")}>{c.name}</TableCell>
                      <TableCell className={tableCell}>{c.primaryPhone ?? "—"}</TableCell>
                      <TableCell className={tableCell}>{c.primaryEmail ?? "—"}</TableCell>
                      <TableCell className={tableCell}>{c.leadSource ?? "—"}</TableCell>
                      <TableCell className={tableCell}>
                        <StatusChip status={c.status} />
                      </TableCell>
                      <TableCell className={tableCell}>
                        {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className={tableCell} onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Link href={`/customers/${c.id}`}>
                            <Button variant="secondary" size="sm" className="focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                              View
                            </Button>
                          </Link>
                          {canWrite && (
                            <WriteGuard>
                              <Link href={`/customers/${c.id}/edit`}>
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
