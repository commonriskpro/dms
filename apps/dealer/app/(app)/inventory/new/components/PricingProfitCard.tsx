"use client";

import * as React from "react";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { modalDepthSurface, modalDepthSurfaceStrong } from "@/lib/ui/modal-depth";
import { cn } from "@/lib/utils";

export interface PricingProfitCardProps {
  salePriceDollars: string;
  onSalePriceChange: (v: string) => void;
  totalCostCents: number;
  projectedProfitCents: number;
  profitPct: number | null;
  highlightSalePrice?: boolean;
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

function formatInlineDollars(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: trimmed.includes(".") ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function PricingProfitCard({
  salePriceDollars,
  onSalePriceChange,
  totalCostCents,
  projectedProfitCents,
  profitPct,
  highlightSalePrice = false,
  errors = {},
  ledgerTotals = null,
}: PricingProfitCardProps) {
  const [isEditingSalePrice, setIsEditingSalePrice] = React.useState(false);
  const [salePriceDraft, setSalePriceDraft] = React.useState(salePriceDollars);

  React.useEffect(() => {
    if (!isEditingSalePrice) {
      setSalePriceDraft(salePriceDollars);
    }
  }, [isEditingSalePrice, salePriceDollars]);

  const profitSummary =
    projectedProfitCents > 0
      ? "Good margin"
      : projectedProfitCents < 0
        ? "Loss"
        : "break-even";
  const salePriceDisplay = React.useMemo(
    () => formatInlineDollars(salePriceDollars) || "0.00",
    [salePriceDollars]
  );

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
        <div
          className={cn(
            modalDepthSurfaceStrong,
            "p-2.5 transition-shadow",
            highlightSalePrice
              ? "border border-emerald-400/18 bg-[radial-gradient(circle_at_50%_42%,rgba(96,165,250,0.14),transparent_68%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_0_0_1px_rgba(96,165,250,0.14),0_0_34px_rgba(96,165,250,0.18)]"
              : undefined
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">
            Sale price
          </p>
          <div className="mt-1">
            <input
              aria-label="Sale price"
              inputMode="decimal"
              placeholder="0.00"
              value={isEditingSalePrice ? salePriceDraft : salePriceDisplay}
              onFocus={() => setIsEditingSalePrice(true)}
              onBlur={() => setIsEditingSalePrice(false)}
              onChange={(e) => {
                setSalePriceDraft(e.target.value);
                onSalePriceChange(e.target.value);
              }}
              className={cn(
                "block w-full rounded-lg border border-transparent bg-transparent px-0 py-1 text-right text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)] tabular-nums outline-none transition-colors placeholder:text-[var(--text)] focus:border-[var(--accent)]/35 focus:bg-[color:rgba(255,255,255,0.03)] focus:px-3",
                errors.salePriceDollars ? "border-[var(--danger)]/40" : undefined
              )}
            />
          </div>
          {errors.salePriceDollars ? (
            <p className="mt-1 text-xs text-[var(--danger)]">{errors.salePriceDollars}</p>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-soft)]">Click the value to update it inline.</p>
          )}
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
