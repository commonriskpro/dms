"use client";

import * as React from "react";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const profitLabel =
    projectedProfitCents > 0 ? "Good Margin" : projectedProfitCents < 0 ? "Loss" : "Break even";
  const profitVariant = projectedProfitCents > 0 ? "success" : projectedProfitCents < 0 ? "danger" : "secondary";

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Pricing & Costs</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              label="Auction Cost"
              placeholder="0.00"
              value={auctionCostDollars}
              onChange={(e) => onAuctionCostChange(e.target.value)}
              error={errors.auctionCostDollars}
            />
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              label="Transport Cost"
              placeholder="0.00"
              value={transportCostDollars}
              onChange={(e) => onTransportCostChange(e.target.value)}
              error={errors.transportCostDollars}
            />
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              label="Reconditioning Cost"
              placeholder="0.00"
              value={reconCostDollars}
              onChange={(e) => onReconCostChange(e.target.value)}
              error={errors.reconCostDollars}
            />
          </div>
          {reconCostWarning && (
            <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--warning-text)]" role="status">
              <WarningIcon className="h-4 w-4" />
              High recon cost !
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              label="Misc Cost"
              placeholder="0.00"
              value={miscCostDollars}
              onChange={(e) => onMiscCostChange(e.target.value)}
              error={errors.miscCostDollars}
            />
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-sm font-medium text-[var(--text)]">Total Cost</span>
          <span className="text-sm text-[var(--text)]">{formatDollarsFromCents(totalCostCents)}</span>
        </div>
        <Input
          label="Sale Price (First Instance)"
          placeholder="0.00"
          value={salePriceDollars}
          onChange={(e) => onSalePriceChange(e.target.value)}
          error={errors.salePriceDollars}
        />
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-sm font-medium text-[var(--text)]">Projected Profit</span>
          <Badge variant={profitVariant}>
            {formatDollarsFromCents(projectedProfitCents)} {profitLabel}
          </Badge>
        </div>
        {profitPct != null && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text)]">Profit %</span>
            <span className="text-sm text-[var(--text)]">{profitPct}%</span>
          </div>
        )}
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
