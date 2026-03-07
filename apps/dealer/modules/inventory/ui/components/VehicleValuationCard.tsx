"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";

export type VehicleValuationCardProps = {
  vehicleId: string;
  className?: string;
};

type ValuationData = {
  id: string;
  vehicleId: string;
  marketAverageCents: number;
  marketLowestCents: number;
  marketHighestCents: number;
  recommendedRetailCents: number;
  recommendedWholesaleCents: number;
  priceToMarketPercent: number | null;
  marketDaysSupply: number | null;
  createdAt: string;
};

export function VehicleValuationCard({ vehicleId, className }: VehicleValuationCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRecalc = hasPermission("inventory.pricing.write");
  const [data, setData] = React.useState<ValuationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [recalculating, setRecalculating] = React.useState(false);

  const fetchValuation = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: ValuationData | null }>(
        `/api/inventory/${vehicleId}/valuation`
      );
      setData(res.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  React.useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/valuation/recalculate`, {
        method: "POST",
      });
      addToast("success", "Valuation recalculated");
      fetchValuation();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <DMSCard className={className}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DMSCardTitle className={typography.cardTitle}>Market valuation</DMSCardTitle>
          {canRecalc && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? "Recalculating…" : "Recalculate"}
            </Button>
          )}
        </div>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-20 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : !data ? (
          <p className="text-sm text-[var(--muted-text)]">
            No valuation snapshot yet. Recalculate to generate one.
          </p>
        ) : (
          <ul className="space-y-2 text-sm" role="list">
            <li className="flex justify-between gap-2">
              <span className="text-[var(--muted-text)]">Recommended retail</span>
              <span className="text-[var(--text)] font-medium">
                {formatCents(String(data.recommendedRetailCents))}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-[var(--muted-text)]">Recommended wholesale</span>
              <span className="text-[var(--text)]">
                {formatCents(String(data.recommendedWholesaleCents))}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-[var(--muted-text)]">Market range</span>
              <span className="text-[var(--text)]">
                {formatCents(String(data.marketLowestCents))} – {formatCents(String(data.marketHighestCents))}
              </span>
            </li>
            {data.priceToMarketPercent != null && (
              <li className="flex justify-between gap-2">
                <span className="text-[var(--muted-text)]">Price to market</span>
                <span className="text-[var(--text)]">{data.priceToMarketPercent.toFixed(1)}%</span>
              </li>
            )}
            {data.marketDaysSupply != null && (
              <li className="flex justify-between gap-2">
                <span className="text-[var(--muted-text)]">Days supply</span>
                <span className="text-[var(--text)]">{data.marketDaysSupply}</span>
              </li>
            )}
            <li className="text-[var(--muted-text)] text-xs pt-1">
              Last updated {new Date(data.createdAt).toLocaleString()}
            </li>
          </ul>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
