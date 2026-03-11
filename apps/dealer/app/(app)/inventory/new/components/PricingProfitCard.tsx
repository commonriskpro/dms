"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

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
  const profitSummary =
    projectedProfitCents > 0
      ? "Good margin"
      : projectedProfitCents < 0
        ? "Loss"
        : "break-even";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_160px]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
            Ledger invested
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--text)]">
            {formatDollarsFromCents(ledgerTotals?.totalInvestedCents ?? totalCostCents)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">
            Acq {formatDollarsFromCents(ledgerTotals?.acquisitionSubtotalCents ?? 0)} · Transport{" "}
            {formatDollarsFromCents(ledgerTotals?.transportCents ?? 0)} · Recon{" "}
            {formatDollarsFromCents(ledgerTotals?.reconSubtotalCents ?? 0)} · Fees/misc{" "}
            {formatDollarsFromCents((ledgerTotals?.feesSubtotalCents ?? 0) + (ledgerTotals?.miscCents ?? 0))}
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
            Sale price
          </p>
          <div className="mt-1">
            <Input
              label=""
              placeholder="0.00"
              value={salePriceDollars}
              onChange={(e) => onSalePriceChange(e.target.value)}
              error={errors.salePriceDollars}
              className="text-right tabular-nums"
            />
          </div>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
            Projected gross
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--text)]">
            {formatDollarsFromCents(projectedProfitCents)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">{profitSummary}</p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
            Margin
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--text)]">{profitPct != null ? `${profitPct}%` : "n/a"}</p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">Target 15%+</p>
        </div>
      </div>
    </div>
  );
}
