"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WriteGuard } from "@/components/write-guard";
import { Select, type SelectOption } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { dashboardCard, spacingTokens } from "@/lib/ui/tokens";
import { AcquisitionBoard } from "./AcquisitionBoard";
import { AcquisitionLeadForm } from "./AcquisitionLeadForm";
import type { AcquisitionLeadRow } from "./page";

const STAGES = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"] as const;
const SOURCE_OPTIONS: SelectOption[] = [
  { value: "", label: "All sources" },
  { value: "AUCTION", label: "Auction" },
  { value: "TRADE_IN", label: "Trade-in" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "STREET", label: "Street" },
];

export type AcquisitionPageClientProps = {
  initialStages: Record<string, AcquisitionLeadRow[]>;
  currentQuery: { search: string; sourceType: string };
  canWrite: boolean;
};

export function AcquisitionPageClient({
  initialStages,
  currentQuery,
  canWrite,
}: AcquisitionPageClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState(currentQuery.search);
  const [sourceType, setSourceType] = React.useState(currentQuery.sourceType);

  React.useEffect(() => {
    setSearch(currentQuery.search);
    setSourceType(currentQuery.sourceType);
  }, [currentQuery.search, currentQuery.sourceType]);

  const handleFilter = () => {
    const url = new URL(window.location.href);
    if (search.trim()) url.searchParams.set("search", search.trim());
    else url.searchParams.delete("search");
    if (sourceType) url.searchParams.set("sourceType", sourceType);
    else url.searchParams.delete("sourceType");
    router.push(url.pathname + url.search);
  };

  const handleCreated = React.useCallback(() => {
    setCreateOpen(false);
    router.refresh();
  }, [router]);

  return (
    <div className={sectionStack}>
      <PageHeader
        title={<h1 className={typography.pageTitle}>Acquisition</h1>}
        actions={
          canWrite ? (
            <WriteGuard>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              >
                Create lead
              </Button>
            </WriteGuard>
          ) : null
        }
      />
      <div className={`${dashboardCard} ${spacingTokens.cardPad}`}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <Label htmlFor="acq-search" className="text-[var(--muted-text)] text-xs">Search (VIN)</Label>
            <Input
              id="acq-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="VIN"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div className="min-w-[140px]">
            <Label htmlFor="acq-source" className="text-[var(--muted-text)] text-xs">Source</Label>
            <Select
              id="acq-source"
              value={sourceType}
              onChange={setSourceType}
              options={SOURCE_OPTIONS}
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleFilter}
            className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
          >
            Apply
          </Button>
        </div>
      </div>
      <AcquisitionBoard
        stages={initialStages}
        canWrite={canWrite}
        onMutate={() => router.refresh()}
      />
      {createOpen && (
        <AcquisitionLeadForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
}
