"use client";

import * as React from "react";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

export interface PricingProfitCardProps {
  auctionCostDollars: string;
  onAuctionCostChange: (v: string) => void;
  transportCostDollars: string;
  onTransportCostChange: (v: string) => void;
  reconCostDollars: string;
  onReconCostChange: (v: string) => void;
  miscCostDollars: string;
  onMiscCostChange: (v: string) => void;
  salePriceDollars: string;
  onSalePriceChange: (v: string) => void;
  totalCostCents: number;
  projectedProfitCents: number;
  profitPct: number | null;
  reconCostWarning?: boolean;
  errors?: Partial<Record<string, string>>;
}

function formatDollarsFromCents(cents: number): string {
  return formatCents(String(cents));
}

const PRICING_INPUT_WIDTH = "w-32";

function PricingRow({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-sm font-medium text-[var(--text)]">{label}</span>
      <div className={PRICING_INPUT_WIDTH + " shrink-0"}>
        <Input
          label=""
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          className="w-32 text-right tabular-nums"
        />
      </div>
    </div>
  );
}

export function PricingProfitCard({
  auctionCostDollars,
  onAuctionCostChange,
  transportCostDollars,
  onTransportCostChange,
  reconCostDollars,
  onReconCostChange,
  miscCostDollars,
  onMiscCostChange,
  salePriceDollars,
  onSalePriceChange,
  totalCostCents,
  projectedProfitCents,
  profitPct,
  reconCostWarning = false,
  errors = {},
}: PricingProfitCardProps) {
  const profitSummary =
    projectedProfitCents > 0
      ? "Good margin"
      : projectedProfitCents < 0
        ? "Loss"
        : "break-even";

  return (
    <DMSCard className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <DMSCardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)] px-6 pt-4 pb-3">
        <DMSCardTitle className="text-[15px] font-semibold text-[var(--text)]">Pricing & Costs</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="px-5 pt-6 pb-5 space-y-3">
        <PricingRow
          label="Auction Cost"
          value={auctionCostDollars}
          onChange={onAuctionCostChange}
          error={errors.auctionCostDollars}
        />
        <PricingRow
          label="Transport Cost"
          value={transportCostDollars}
          onChange={onTransportCostChange}
          error={errors.transportCostDollars}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-medium text-[var(--text)]">Reconditioning Cost</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className={PRICING_INPUT_WIDTH + " shrink-0"}>
              <Input
                label=""
                placeholder="0.00"
                value={reconCostDollars}
                onChange={(e) => onReconCostChange(e.target.value)}
                error={errors.reconCostDollars}
                className="w-32 text-right tabular-nums"
              />
            </div>
            {reconCostWarning && (
              <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--warning)]" role="status">
                <WarningIcon className="h-4 w-4" />
                High recon cost !
              </span>
            )}
          </div>
        </div>
        <PricingRow
          label="Misc Cost"
          value={miscCostDollars}
          onChange={onMiscCostChange}
          error={errors.miscCostDollars}
        />
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-sm font-semibold text-[var(--text)]">Total Cost</span>
          <span className="text-sm font-semibold text-[var(--text)]">{formatDollarsFromCents(totalCostCents)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-medium text-[var(--text)]">Sale Price (First Instance)</span>
          <div className={PRICING_INPUT_WIDTH + " shrink-0"}>
            <Input
              label=""
              placeholder="0.00"
              value={salePriceDollars}
              onChange={(e) => onSalePriceChange(e.target.value)}
              error={errors.salePriceDollars}
              className="w-32 text-right tabular-nums"
            />
          </div>
        </div>
        <div className="rounded-md bg-[var(--panel)] p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">Projected Profit</span>
            <div className="flex shrink-0 items-center gap-2 tabular-nums text-sm text-[var(--text)]">
              <span className="font-semibold">{formatDollarsFromCents(projectedProfitCents)}</span>
              {profitPct != null && <span>{profitPct}%</span>}
            </div>
          </div>
          <p className="text-xs text-[var(--text-soft)]">
            • {formatDollarsFromCents(projectedProfitCents)} {profitSummary}
          </p>
          <p className="text-xs text-[var(--text-soft)]">• Target ≥ 15% profit margin</p>
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 9 2 6" />
      <path d="M12 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2" />
      <path d="M3 21h18" />
      <path d="M4 21V7l8-4 8 4v14" />
    </svg>
  );
}
