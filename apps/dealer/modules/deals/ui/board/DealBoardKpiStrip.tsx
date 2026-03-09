"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, ArrowUpRight } from "lucide-react";
import type { BoardKpi } from "@/modules/deals/service/board";

function MiniSparkline({ color }: { color: string }) {
  return (
    <svg width="56" height="28" viewBox="0 0 56 28" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 22 L8 18 L16 20 L24 14 L32 16 L40 10 L48 12 L56 6 L56 28 L0 28Z"
        fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <path
        d="M0 22 L8 18 L16 20 L24 14 L32 16 L40 10 L48 12 L56 6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type DealBoardKpiStripProps = {
  kpi: BoardKpi;
  canWrite: boolean;
};

export function DealBoardKpiStrip({ kpi, canWrite }: DealBoardKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {/* Active Deals */}
      <Link
        href="/deals?status=DRAFT"
        className="group surface-noise flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
      >
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            Active Deals
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums text-3xl font-bold text-[var(--text)]">
              {kpi.activeDeals}
            </span>
            <TrendingUp className="h-4 w-4 text-[var(--success)]" />
          </div>
        </div>
        <MiniSparkline color="#4ade80" />
      </Link>

      {/* Approved */}
      <Link
        href="/deals?status=APPROVED"
        className="group surface-noise flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
      >
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            Approved
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums text-3xl font-bold text-[var(--text)]">
              {kpi.approved}
            </span>
            <TrendingUp className="h-4 w-4 text-[var(--success)]" />
          </div>
        </div>
        <MiniSparkline color="#60a5fa" />
      </Link>

      {/* Contracts Ready */}
      <Link
        href="/deals?status=CONTRACTED"
        className="group surface-noise flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
      >
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            Contracts Ready
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums text-3xl font-bold text-[var(--text)]">
              {kpi.contractsReady}
            </span>
          </div>
        </div>
        <MiniSparkline color="#a78bfa" />
      </Link>

      {/* Total Front Gross */}
      <div className="surface-noise flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            Front Gross
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums text-3xl font-bold text-[var(--text)]">
              {formatCents(kpi.totalFrontGrossCents)}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--muted-text)]">
            +{kpi.activeDeals} active deals
          </p>
        </div>
        <MiniSparkline color="#fbbf24" />
      </div>

      {/* New Deal CTA */}
      {canWrite ? (
        <Link
          href="/deals/new"
          className={cn(
            "group flex items-center justify-center gap-2 rounded-[var(--radius-card)]",
            "border border-[var(--primary)] bg-[var(--primary)] p-4 shadow-[var(--shadow-card)]",
            "text-white transition-all hover:bg-[var(--primary-hover)] hover:shadow-md"
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-semibold">New Deal</span>
          <ArrowUpRight className="h-4 w-4 opacity-60" />
        </Link>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4" />
      )}
    </div>
  );
}
