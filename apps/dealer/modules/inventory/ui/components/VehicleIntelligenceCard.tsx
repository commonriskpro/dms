"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import type { VehicleIntelligence } from "../types";
import { cn } from "@/lib/utils";
import { badgeSuccess, badgeWarning, badgeDanger, badgeInfo, badgeMuted, badgeBase } from "@/lib/ui/recipes/badge";

export type VehicleIntelligenceCardProps = {
  intelligence: VehicleIntelligence | null | undefined;
  className?: string;
};

function TurnRiskBadge({ status }: { status: string }) {
  if (status === "na") return <span className="text-[var(--muted-text)]">—</span>;
  const label = status === "good" ? "On track" : status === "warn" ? "Aging" : "At risk";
  const cls =
    status === "good" ? badgeSuccess : status === "warn" ? badgeWarning : badgeDanger;
  return <span className={cn(badgeBase, cls)}>{label}</span>;
}

function MarketBadge({ status }: { status: string }) {
  if (status === "No Market Data") return <span className="text-[var(--muted-text)]">No data</span>;
  const cls =
    status === "Below Market" ? badgeSuccess : status === "At Market" ? badgeInfo : badgeWarning;
  return <span className={cn(badgeBase, cls)}>{status}</span>;
}

export function VehicleIntelligenceCard({ intelligence, className }: VehicleIntelligenceCardProps) {
  if (!intelligence) return null;

  const { priceToMarket, daysToTurn } = intelligence;

  return (
    <DMSCard className={className}>
      <DMSCardHeader>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Market &amp; turn
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-[var(--muted-text)] mb-1">Market position</p>
            <MarketBadge status={priceToMarket.marketStatus} />
            {priceToMarket.sourceLabel && priceToMarket.sourceLabel !== "No data" && (
              <p className="text-xs text-[var(--muted-text)] mt-1">{priceToMarket.sourceLabel}</p>
            )}
            {priceToMarket.marketDeltaPercent != null && (
              <p className="text-sm text-[var(--text)] mt-1">
                {priceToMarket.marketDeltaPercent > 0 ? "+" : ""}
                {priceToMarket.marketDeltaPercent}% vs baseline
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-[var(--muted-text)] mb-1">Days to turn</p>
            <div className="flex items-center gap-2">
              {daysToTurn.daysInStock != null ? (
                <span className="text-[var(--text)]">{daysToTurn.daysInStock} days</span>
              ) : (
                <span className="text-[var(--muted-text)]">—</span>
              )}
              <TurnRiskBadge status={daysToTurn.turnRiskStatus} />
            </div>
            {daysToTurn.agingBucket && (
              <p className="text-xs text-[var(--muted-text)] mt-1">
                Bucket: {daysToTurn.agingBucket} · Target: {daysToTurn.targetDays} days
              </p>
            )}
          </div>
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
