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

export type VehiclePricingAutomationCardProps = {
  vehicleId: string;
  currentPriceCents: string;
  onPriceUpdated?: () => void;
  className?: string;
};

type PreviewStep = {
  ruleName: string;
  ruleType: string;
  adjustmentCents: number;
  newPriceCents: number;
};

type Preview = {
  vehicleId: string;
  currentPriceCents: number;
  suggestedPriceCents: number;
  steps: PreviewStep[];
};

export function VehiclePricingAutomationCard({
  vehicleId,
  currentPriceCents,
  onPriceUpdated,
  className,
}: VehiclePricingAutomationCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canPreview = hasPermission("inventory.pricing.read");
  const canApply = hasPermission("inventory.pricing.write");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await apiFetch<{ data: Preview }>(
        `/api/inventory/${vehicleId}/pricing/preview`,
        { method: "POST" }
      );
      setPreview(res.data);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/pricing/apply`, { method: "POST" });
      addToast("success", "Price adjustment applied");
      setPreview(null);
      onPriceUpdated?.();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <DMSCard className={className}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Pricing automation</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--muted-text)]">Current price</span>
            <span className="text-[var(--text)] font-medium">{formatCents(currentPriceCents)}</span>
          </div>
          {canPreview && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePreview}
                disabled={loadingPreview}
              >
                {loadingPreview ? "Loading…" : "Preview adjustment"}
              </Button>
              {preview && (
                <>
                  <div className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
                    {preview.steps.length === 0 ? (
                      <p className="text-[var(--muted-text)]">No rules apply.</p>
                    ) : (
                      preview.steps.map((s, i) => (
                        <div key={i} className="flex justify-between gap-2 text-xs">
                          <span className="text-[var(--muted-text)]">{s.ruleName} ({s.ruleType})</span>
                          <span className="text-[var(--text)]">
                            {s.adjustmentCents >= 0 ? "+" : ""}{formatCents(String(s.adjustmentCents))} → {formatCents(String(s.newPriceCents))}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between gap-2 pt-1 border-t border-[var(--border)]">
                      <span className="text-[var(--text)] font-medium">New price</span>
                      <span className="text-[var(--text)] font-medium">
                        {formatCents(String(preview.suggestedPriceCents))}
                      </span>
                    </div>
                  </div>
                  {canApply && preview.suggestedPriceCents !== preview.currentPriceCents && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[var(--accent)] text-white"
                      onClick={handleApply}
                      disabled={applying}
                    >
                      {applying ? "Applying…" : "Apply adjustment"}
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
