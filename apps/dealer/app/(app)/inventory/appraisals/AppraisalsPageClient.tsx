"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { WriteGuard } from "@/components/write-guard";
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
  const [createOpen, setCreateOpen] = React.useState(false);

  const handleFilterChange = React.useCallback(
    (params: { search?: string; sourceType?: string; status?: string }) => {
      const url = new URL(window.location.href);
      if (params.search !== undefined) url.searchParams.set("search", params.search);
      else url.searchParams.delete("search");
      if (params.sourceType !== undefined && params.sourceType)
        url.searchParams.set("sourceType", params.sourceType);
      else url.searchParams.delete("sourceType");
      if (params.status !== undefined && params.status)
        url.searchParams.set("status", params.status);
      else url.searchParams.delete("status");
      url.searchParams.delete("offset");
      router.push(url.pathname + url.search);
    },
    [router]
  );

  const handleCreated = React.useCallback(() => {
    setCreateOpen(false);
    router.refresh();
  }, [router]);

  return (
    <div className={sectionStack}>
      <PageHeader
        title={<h1 className={typography.pageTitle}>Appraisals</h1>}
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
                className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              >
                Create appraisal
              </Button>
            </WriteGuard>
            ) : null}
          </div>
        }
      />
      <AppraisalFilters
        currentQuery={currentQuery}
        onFilterChange={handleFilterChange}
      />
      <AppraisalsTable
        rows={initialData.data}
        total={initialData.total}
        limit={initialData.limit}
        offset={initialData.offset}
        canWrite={canWrite}
        onMutate={() => router.refresh()}
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
