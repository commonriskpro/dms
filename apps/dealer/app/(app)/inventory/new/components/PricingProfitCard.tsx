"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import { modalDepthSurface, modalDepthSurfaceStrong, modalFieldTone } from "@/lib/ui/modal-depth";

export interface PricingProfitCardProps {
  salePriceDollars: string;
  onSalePriceChange: (v: string) => void;
  totalCostCents: number;
  projectedProfitCents: number;
  profitPct: number | null;
  errors?: Partial<Record<string, string>>;
  ledgerTotals?: {
    acquisitionSubtotalCents: number;
    transportCents: number;
    reconSubtotalCents: number;
    feesSubtotalCents: number;
    miscCents: number;
    totalInvestedCents: number;
  } | null;
}

function formatDollarsFromCents(cents: number): string {
  return formatCents(String(cents));
}

export function PricingProfitCard({
  salePriceDollars,
  onSalePriceChange,
  totalCostCents,
  projectedProfitCents,
  profitPct,
  errors = {},
  ledgerTotals = null,
}: PricingProfitCardProps) {
  const modalControlClass = `${modalFieldTone} h-10`;
  const profitSummary =
    projectedProfitCents > 0
      ? "Good margin"
      : projectedProfitCents < 0
        ? "Loss"
        : "break-even";

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_200px_170px_150px]">
        <div className={`${modalDepthSurfaceStrong} p-2.5`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">
            Ledger invested
          </p>
          <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
            {formatDollarsFromCents(ledgerTotals?.totalInvestedCents ?? totalCostCents)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">
            Acq {formatDollarsFromCents(ledgerTotals?.acquisitionSubtotalCents ?? 0)} · Transport{" "}
            {formatDollarsFromCents(ledgerTotals?.transportCents ?? 0)} · Recon{" "}
            {formatDollarsFromCents(ledgerTotals?.reconSubtotalCents ?? 0)} · Fees/misc{" "}
            {formatDollarsFromCents((ledgerTotals?.feesSubtotalCents ?? 0) + (ledgerTotals?.miscCents ?? 0))}
          </p>
        </div>
        <div className={`${modalDepthSurfaceStrong} p-2.5`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">
            Sale price
          </p>
          <div className="mt-1">
            <Input
              label=""
              placeholder="0.00"
              value={salePriceDollars}
              onChange={(e) => onSalePriceChange(e.target.value)}
              error={errors.salePriceDollars}
              className={`${modalControlClass} text-right tabular-nums`}
            />
          </div>
        </div>
        <div className={`${modalDepthSurface} p-2.5`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">
            Projected gross
          </p>
          <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
            {formatDollarsFromCents(projectedProfitCents)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">{profitSummary}</p>
        </div>
        <div className={`${modalDepthSurface} p-2.5`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">
            Margin
          </p>
          <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)]">{profitPct != null ? `${profitPct}%` : "n/a"}</p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">Target 15%+</p>
        </div>
      </div>
    </div>
  );
}
