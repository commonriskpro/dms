"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { WriteGuard } from "@/components/write-guard";
import { formatCents } from "@/lib/money";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { AppraisalFilters } from "./AppraisalFilters";
import { AppraisalsTable } from "./AppraisalsTable";
import { AppraisalForm } from "./AppraisalForm";
import type { AppraisalRow } from "./page";

export type AppraisalsPageClientProps = {
  initialData: {
    data: AppraisalRow[];
    total: number;
    limit: number;
    offset: number;
  };
  currentQuery: { search: string; sourceType: string; status: string };
  canWrite: boolean;
};

export function AppraisalsPageClient({
  initialData,
  currentQuery,
  canWrite,
}: AppraisalsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const [createOpen, setCreateOpen] = React.useState(false);
  const refreshTable = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  const handleFilterChange = React.useCallback(
    (params: { search?: string; sourceType?: string; status?: string }) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (params.search !== undefined) nextParams.set("search", params.search);
      else nextParams.delete("search");
      if (params.sourceType !== undefined && params.sourceType)
        nextParams.set("sourceType", params.sourceType);
      else nextParams.delete("sourceType");
      if (params.status !== undefined && params.status)
        nextParams.set("status", params.status);
      else nextParams.delete("status");
      nextParams.delete("offset");
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleCreated = React.useCallback(() => {
    setCreateOpen(false);
    refreshTable();
  }, [refreshTable]);

  const statusCounts = React.useMemo(
    () =>
      initialData.data.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
    [initialData.data]
  );
  const expectedRetailCents = React.useMemo(
    () => initialData.data.reduce((sum, row) => sum + Number(row.expectedRetailCents ?? "0"), 0),
    [initialData.data]
  );
  const expectedProfitCents = React.useMemo(
    () => initialData.data.reduce((sum, row) => sum + Number(row.expectedProfitCents ?? "0"), 0),
    [initialData.data]
  );
  const approvedCount = statusCounts.APPROVED ?? 0;
  const convertibleCount = initialData.data.filter((row) => (row.status === "APPROVED" || row.status === "DRAFT") && !row.vehicleId).length;

  return (
    <div className={sectionStack}>
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Appraisal command board
            </p>
            <h1 className={typography.pageTitle}>Vehicle appraisals</h1>
          </div>
        }
        description="Keep valuation throughput, approval pressure, and conversion readiness visible before you drop into row-by-row appraisal decisions."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/inventory/pricing-rules"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Pricing rules
            </Link>
            {canWrite ? (
              <WriteGuard>
                <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
              >
                Create appraisal
              </Button>
            </WriteGuard>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 min-[1800px]:grid-cols-6">
        <KpiCard label="Total appraisals" value={initialData.total} sub="current query" color="blue" trend={[initialData.total || 1, initialData.total || 1]} />
        <KpiCard label="Approved" value={approvedCount} sub="ready for conversion" color="green" trend={[approvedCount || 1, approvedCount || 1]} />
        <KpiCard label="Convertible" value={convertibleCount} sub="draft or approved" color="amber" accentValue={convertibleCount > 0} trend={[convertibleCount || 1, convertibleCount || 1]} />
        <KpiCard label="Expected retail" value={formatCents(String(expectedRetailCents))} sub="page exposure" color="cyan" trend={[Math.max(expectedRetailCents, 1), Math.max(expectedRetailCents, 1)]} />
        <KpiCard label="Expected profit" value={formatCents(String(expectedProfitCents))} sub="page valuation spread" color="violet" trend={[Math.max(expectedProfitCents, 1), Math.max(expectedProfitCents, 1)]} />
      </div>
      <Widget
        title="Appraisal controls"
        subtitle="Search and filter valuation work without burying the conversion workflow under utility controls."
        compact
      >
        <AppraisalFilters
          currentQuery={currentQuery}
          onFilterChange={handleFilterChange}
        />
      </Widget>
      <AppraisalsTable
        rows={initialData.data}
        total={initialData.total}
        limit={initialData.limit}
        offset={initialData.offset}
        canWrite={canWrite}
        onMutate={refreshTable}
      />
      {createOpen && (
        <AppraisalForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
}
