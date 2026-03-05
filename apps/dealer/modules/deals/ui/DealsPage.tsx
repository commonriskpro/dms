"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { ui } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DealsSummaryCards } from "./components/DealsSummaryCards";
import { DealsFilterBar } from "./components/DealsFilterBar";
import { DealsTableCard } from "./components/DealsTableCard";
import type { DealListItem } from "./types";
import { DEAL_STATUS_OPTIONS } from "./types";

type DealsListResponse = {
  data: DealListItem[];
  meta: { total: number; limit: number; offset: number };
};

function getValidStatusFromParams(searchParams: ReturnType<typeof useSearchParams>): string {
  const s = searchParams.get("status") ?? "";
  return s && DEAL_STATUS_OPTIONS.some((o) => o.value === s) ? s : "";
}

export function DealsPage() {
  const searchParams = useSearchParams();
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const canWrite = hasPermission("deals.write");

  const initialStatus = React.useMemo(() => getValidStatusFromParams(searchParams), [searchParams]);

  const [deals, setDeals] = React.useState<DealListItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>(initialStatus);
  const [appliedStatus, setAppliedStatus] = React.useState<string>(initialStatus);
  const [lender, setLender] = React.useState<string>("");
  const [filterOpen, setFilterOpen] = React.useState(false);

  // Sync status from URL only when the URL param changes (e.g. pipeline link or back/forward)
  const prevUrlStatusRef = React.useRef<string | null>(searchParams.get("status"));
  React.useEffect(() => {
    const urlStatus = searchParams.get("status") ?? null;
    if (urlStatus !== prevUrlStatusRef.current) {
      prevUrlStatusRef.current = urlStatus;
      const next = getValidStatusFromParams(searchParams);
      setStatus(next);
      setAppliedStatus(next);
    }
  }, [searchParams]);

  const fetchDeals = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
    });
    if (appliedStatus) params.set("status", appliedStatus);

    const res = await apiFetch<DealsListResponse>(`/api/deals?${params.toString()}`);
    setDeals(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, appliedStatus]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDeals().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    }).finally(() => setLoading(false));
  }, [canRead, meta.offset, appliedStatus, fetchDeals]);

  const handleApplyFilters = () => {
    setAppliedStatus(status);
    setMeta((m) => ({ ...m, offset: 0 }));
    setFilterOpen(false);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setAppliedStatus(value);
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const handleResetFilters = () => {
    setStatus("");
    setAppliedStatus("");
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...DEAL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const lenderOptions: SelectOption[] = [
    { value: "", label: "All lenders" },
  ];

  const openDeals = meta.total;
  const submitted = deals.filter((d) => d.status === "STRUCTURED").length;
  const funded = deals.filter((d) => d.status === "CONTRACTED").length;
  const contractsPending = deals.filter((d) => d.status === "APPROVED").length;

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className={sectionStack}>
      <PageHeader
        actions={
          canWrite ? (
            <Link href="/deals/new">
              <Button className={ui.ring}>New Deal</Button>
            </Link>
          ) : null
        }
      />

      <DealsSummaryCards
        openDeals={openDeals}
        submitted={submitted}
        funded={funded}
        contractsPending={contractsPending}
      />

      <DealsFilterBar
        lenderOptions={lenderOptions}
        statusOptions={statusOptions}
        lenderValue={lender}
        statusValue={status}
        onLenderChange={setLender}
        onStatusChange={handleStatusChange}
        onAdvancedFilters={() => setFilterOpen(true)}
      />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select
              label="Deal Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>Apply</Button>
              <Button variant="secondary" onClick={handleResetFilters}>
                Reset filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DealsTableCard
        deals={deals}
        meta={meta}
        loading={loading}
        error={error}
        onRetry={() => { setError(null); fetchDeals(); }}
        onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
        canRead={canRead}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
