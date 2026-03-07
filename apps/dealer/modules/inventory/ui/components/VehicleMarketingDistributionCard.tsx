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

export type VehicleMarketingDistributionCardProps = {
  vehicleId: string;
  className?: string;
};

type ListingRow = {
  id: string;
  vehicleId: string;
  platform: string;
  status: string;
  externalListingId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function VehicleMarketingDistributionCard({
  vehicleId,
  className,
}: VehicleMarketingDistributionCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canPublish = hasPermission("inventory.publish.write");
  const [listings, setListings] = React.useState<ListingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionId, setActionId] = React.useState<string | null>(null);

  const fetchListings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: ListingRow[] }>(
        `/api/inventory/${vehicleId}/listings`
      );
      setListings(res.data ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  React.useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handlePublish = async (platform: string) => {
    setActionId(platform);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/publish`, {
        method: "POST",
        body: JSON.stringify({ platform, requirePhoto: false }),
      });
      addToast("success", "Published to " + platform);
      fetchListings();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setActionId(null);
    }
  };

  const handleUnpublish = async (platform: string) => {
    setActionId(platform);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/unpublish`, {
        method: "POST",
        body: JSON.stringify({ platform }),
      });
      addToast("success", "Unpublished from " + platform);
      fetchListings();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setActionId(null);
    }
  };

  const websiteListing = listings.find((l) => l.platform === "WEBSITE");

  return (
    <DMSCard className={className}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Marketing distribution</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-16 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="space-y-2 text-sm">
            {/* WEBSITE platform only initially */}
            <div className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border)] p-2">
              <div>
                <span className="font-medium text-[var(--text)]">Website</span>
                <span className="ml-2 text-[var(--muted-text)]">
                  {websiteListing ? websiteListing.status : "—"}
                </span>
                {websiteListing?.lastSyncedAt && (
                  <span className="ml-2 text-xs text-[var(--muted-text)]">
                    Synced {new Date(websiteListing.lastSyncedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {canPublish && (
                <div className="flex gap-1">
                  {(!websiteListing || websiteListing.status !== "PUBLISHED") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePublish("WEBSITE")}
                      disabled={actionId !== null}
                    >
                      Publish
                    </Button>
                  )}
                  {websiteListing?.status === "PUBLISHED" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleUnpublish("WEBSITE")}
                      disabled={actionId !== null}
                    >
                      Unpublish
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
