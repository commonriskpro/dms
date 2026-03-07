"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
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

type FundingDealItem = {
  id: string;
  customerId: string;
  createdAt: string;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    stockNumber: string;
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  };
  dealFundings?: Array<{
    id: string;
    fundingStatus: string;
    fundingAmountCents: string;
    fundingDate: string | null;
    lenderName?: string;
  }>;
};

type Response = { data: FundingDealItem[]; meta: { total: number; limit: number; offset: number } };

function vehicleDisplay(v: FundingDealItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || "—";
}

function primaryFunding(f: FundingDealItem) {
  const list = f.dealFundings ?? [];
  return list[0];
}

export function FundingQueuePage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const [data, setData] = React.useState<FundingDealItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ limit: "25", offset: String(meta.offset) });
    const res = await apiFetch<Response>(`/api/deals/funding?${params.toString()}`);
    setData(res.data);
    setMeta(res.meta);
  }, [canRead, meta.offset]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchData().catch((e) => setError(e instanceof Error ? e.message : "Failed to load")).finally(() => setLoading(false));
  }, [canRead, meta.offset, fetchData]);

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Funding queue"
        description="Deals awaiting funding"
      />
      <DMSCard>
        <DMSCardHeader>
          <DMSCardTitle>Awaiting funding</DMSCardTitle>
        </DMSCardHeader>
        <DMSCardContent>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {error && (
            <ErrorState message={error} onRetry={fetchData} />
          )}
          {!loading && !error && data.length === 0 && (
            <EmptyState
              title="No deals awaiting funding"
              description="Deals will appear here when they have a funding record in Pending or Approved."
            />
          )}
          {!loading && !error && data.length > 0 && (
            <>
              <div className={tableScrollWrapper}>
                <Table>
                  <TableHeader>
                    <TableRow className={tableHeaderRow}>
                      <TableHead className={tableHeadCell}>Customer</TableHead>
                      <TableHead className={tableHeadCell}>Vehicle</TableHead>
                      <TableHead className={tableHeadCell}>Lender</TableHead>
                      <TableHead className={tableHeadCell}>Funding status</TableHead>
                      <TableHead className={tableHeadCell}>Amount</TableHead>
                      <TableHead className={tableHeadCell}>Contract date</TableHead>
                      <TableHead className={tableHeadCell}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => {
                      const fund = primaryFunding(row);
                      return (
                        <TableRow key={row.id} className={tableRowHover}>
                          <TableCell className={tableCell}>{row.customer?.name ?? row.customerId.slice(0, 8)}</TableCell>
                          <TableCell className={tableCell}>{vehicleDisplay(row.vehicle)}</TableCell>
                          <TableCell className={tableCell}>{fund?.lenderName ?? "—"}</TableCell>
                          <TableCell className={tableCell}>{fund?.fundingStatus ?? "—"}</TableCell>
                          <TableCell className={tableCell}>{fund ? formatCents(fund.fundingAmountCents) : "—"}</TableCell>
                          <TableCell className={tableCell}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className={tableCell}>
                            <Link href={`/deals/${row.id}`}>
                              <Button variant="secondary" size="sm">View</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className={tablePaginationFooter}>
                <Pagination
                  total={meta.total}
                  limit={meta.limit}
                  offset={meta.offset}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                />
              </div>
            </>
          )}
        </DMSCardContent>
      </DMSCard>
    </PageShell>
  );
}
