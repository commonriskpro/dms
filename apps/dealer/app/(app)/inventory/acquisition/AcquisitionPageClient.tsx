"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { WriteGuard } from "@/components/write-guard";
import { Select, type SelectOption } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState(currentQuery.search);
  const [sourceType, setSourceType] = React.useState(currentQuery.sourceType);

  React.useEffect(() => {
    setSearch(currentQuery.search);
    setSourceType(currentQuery.sourceType);
  }, [currentQuery.search, currentQuery.sourceType]);

  const refreshBoard = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  const handleFilter = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    if (sourceType) params.set("sourceType", sourceType);
    else params.delete("sourceType");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, search, searchParams, sourceType]);

  const handleCreated = React.useCallback(() => {
    setCreateOpen(false);
    refreshBoard();
  }, [refreshBoard]);

  const allLeads = React.useMemo(() => STAGES.flatMap((stage) => initialStages[stage] ?? []), [initialStages]);
  const stageCounts = React.useMemo(
    () =>
      STAGES.reduce<Record<string, number>>((acc, stage) => {
        acc[stage] = initialStages[stage]?.length ?? 0;
        return acc;
      }, {}),
    [initialStages]
  );
  const linkedAppraisals = React.useMemo(
    () => allLeads.filter((lead) => Boolean(lead.appraisalId)).length,
    [allLeads]
  );
  const negotiatingCount = stageCounts.NEGOTIATING ?? 0;
  const activePipeline = (stageCounts.NEW ?? 0) + (stageCounts.CONTACTED ?? 0) + negotiatingCount;
  const wonCount = stageCounts.WON ?? 0;
  const lostCount = stageCounts.LOST ?? 0;
  const askingValueCents = React.useMemo(
    () =>
      allLeads.reduce((sum, lead) => sum + Number(lead.askingPriceCents ?? "0"), 0),
    [allLeads]
  );
  const negotiatedValueCents = React.useMemo(
    () =>
      allLeads.reduce((sum, lead) => sum + Number(lead.negotiatedPriceCents ?? "0"), 0),
    [allLeads]
  );

  return (
    <div className={sectionStack}>
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Acquisition command board
            </p>
            <h1 className={typography.pageTitle}>Inventory acquisition</h1>
          </div>
        }
        description="Track sourcing pressure, linked appraisals, and pipeline progression before you work lead-by-lead through the board."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {allLeads.length.toLocaleString()} leads
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {linkedAppraisals.toLocaleString()} linked appraisals
            </span>
            {canWrite ? (
              <WriteGuard>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                >
                  Create lead
                </Button>
              </WriteGuard>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 min-[1800px]:grid-cols-6">
        <KpiCard label="Active pipeline" value={activePipeline} sub="new, contacted, negotiating" color="blue" trend={[activePipeline || 1, activePipeline || 1]} />
        <KpiCard label="Negotiating" value={negotiatingCount} sub="price movement" color="amber" accentValue={negotiatingCount > 0} trend={[negotiatingCount || 1, negotiatingCount || 1]} />
        <KpiCard label="Linked appraisals" value={linkedAppraisals} sub="valuation in progress" color="violet" trend={[linkedAppraisals || 1, linkedAppraisals || 1]} />
        <KpiCard label="Won" value={wonCount} sub="ready to convert" color="green" trend={[wonCount || 1, wonCount || 1]} />
        <KpiCard label="Ask exposure" value={formatCents(String(askingValueCents))} sub="open source value" color="cyan" trend={[Math.max(askingValueCents, 1), Math.max(askingValueCents, 1)]} />
        <KpiCard
          label="Negotiated value"
          value={formatCents(String(negotiatedValueCents))}
          sub={lostCount > 0 ? `${lostCount} lost` : "current negotiated total"}
          color="amber"
          trend={[Math.max(negotiatedValueCents, 1), Math.max(negotiatedValueCents, 1)]}
          className="min-[1800px]:block hidden"
        />
      </div>
      <Widget
        title="Acquisition controls"
        subtitle="Filter source leads and keep board context visible without burying the sourcing workflow."
        compact
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="acq-search" className="text-[var(--muted-text)] text-xs">Search (VIN)</Label>
            <Input
              id="acq-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search VIN"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="acq-source" className="text-[var(--muted-text)] text-xs">Source</Label>
            <Select
              id="acq-source"
              value={sourceType}
              onChange={setSourceType}
              options={SOURCE_OPTIONS}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleFilter}
              className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
            >
              Apply
            </Button>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-text)]">
              {STAGES.map((stage) => (
                <span key={stage} className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1">
                  {stage.toLowerCase()} {stageCounts[stage] ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Widget>
      <AcquisitionBoard
        stages={initialStages}
        canWrite={canWrite}
        onMutate={refreshBoard}
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
