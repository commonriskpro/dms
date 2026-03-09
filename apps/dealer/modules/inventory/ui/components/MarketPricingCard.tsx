"use client";

import * as React from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/money";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { badgeBase, badgeSuccess, badgeMuted } from "@/lib/ui/recipes/badge";
import { cn } from "@/lib/utils";
import type { VehicleIntelligence } from "../types";

type ValuationData = {
  recommendedRetailCents: number;
  recommendedWholesaleCents: number;
  marketDaysSupply: number | null;
  createdAt: string;
};

export type MarketPricingCardProps = {
  vehicleId: string;
  intelligence: VehicleIntelligence | null | undefined;
  className?: string;
};

export function MarketPricingCard({
  vehicleId,
  intelligence,
  className,
}: MarketPricingCardProps) {
  const [data, setData] = React.useState<ValuationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiFetch<{ data: ValuationData | null }>(`/api/inventory/${vehicleId}/valuation`)
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((e) => {
        if (mounted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [vehicleId]);

  const daysInStock = intelligence?.daysToTurn?.daysInStock;
  const marketDays = data?.marketDaysSupply;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>
          Market &amp; Pricing
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-28 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <dl className="space-y-2 text-sm flex-1">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Wholesale guide</dt>
                  <dd className="text-[var(--text)]">
                    {data?.recommendedWholesaleCents
                      ? formatCents(String(data.recommendedWholesaleCents))
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Retail guide</dt>
                  <dd className="text-[var(--text)]">
                    {data?.recommendedRetailCents
                      ? formatCents(String(data.recommendedRetailCents))
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="text-2xl font-semibold text-[var(--text)] tabular-nums">
                {data?.recommendedRetailCents
                  ? formatCents(String(data.recommendedRetailCents))
                  : "$0.00"}
              </p>
            </div>

            {/* Market Days */}
            <div className="border-t border-[var(--border)] pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  Market Days
                </p>
                {!data && !intelligence && (
                  <span className={cn(badgeBase, badgeMuted)}>No data</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={cn(badgeBase, badgeSuccess)}>
                  {daysInStock != null ? `${daysInStock} days` : "0 days"}
                </span>
                {marketDays != null && (
                  <span className="text-sm text-[var(--text)]">
                    {marketDays} days
                  </span>
                )}
              </div>
              {data?.createdAt && (
                <p className="text-xs text-[var(--muted-text)] mt-2">
                  Updated{" "}
                  {new Date(data.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
