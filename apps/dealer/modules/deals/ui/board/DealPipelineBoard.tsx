"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell } from "@/components/ui/page-shell";
import { DealBoardKpiStrip } from "./DealBoardKpiStrip";
import { DealBoardFilterBar } from "./DealBoardFilterBar";
import { DealBoardColumn } from "./DealBoardColumn";
import type { DealBoardData } from "@/modules/deals/service/board";

function BoardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[100px] animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
          />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[400px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--panel)]"
          />
        ))}
      </div>
    </div>
  );
}

export function DealPipelineBoard() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const canWrite = hasPermission("deals.write");

  const [board, setBoard] = React.useState<DealBoardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  const fetchBoard = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: DealBoardData }>("/api/deals/board");
      setBoard(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  React.useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell className="space-y-3">
        <BoardSkeleton />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-6">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchBoard(); }}
            className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  if (!board) return null;

  const totalDeals = board.columns.reduce((sum, col) => sum + col.count, 0);

  const filteredColumns = board.columns.map((col) => {
    let deals = col.deals;
    if (search.trim()) {
      const q = search.toLowerCase();
      deals = deals.filter(
        (d) =>
          d.customerName.toLowerCase().includes(q) ||
          d.stockNumber.toLowerCase().includes(q) ||
          (d.vehicleMake ?? "").toLowerCase().includes(q) ||
          (d.vehicleModel ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      deals = deals.filter((d) => d.status === statusFilter);
    }
    return { ...col, deals, count: deals.length };
  });

  return (
    <PageShell className="flex flex-col space-y-3">
      <DealBoardKpiStrip kpi={board.kpi} canWrite={canWrite} />

      <DealBoardFilterBar
        totalDeals={totalDeals}
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        canWrite={canWrite}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
        {filteredColumns.map((col) => (
          <DealBoardColumn key={col.id} column={col} />
        ))}
      </div>
    </PageShell>
  );
}
