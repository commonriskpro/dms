"use client";

import * as React from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, CircleAlert } from "@/lib/ui/icons";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { badgeBase, badgeSuccess } from "@/lib/ui/recipes/badge";
import { cn } from "@/lib/utils";
import type { ReconGetResponse, ReconStatus } from "../types";
import type { VehicleDetailResponse } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RECON_STATUS_LABEL: Record<ReconStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Ready for SALE",
};

export type ReconReadinessCardProps = {
  vehicleId: string;
  vehicle: VehicleDetailResponse;
  className?: string;
};

export function ReconReadinessCard({
  vehicleId,
  vehicle,
  className,
}: ReconReadinessCardProps) {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("inventory.write");
  const [recon, setRecon] = React.useState<ReconGetResponse["data"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    if (!hasPermission("inventory.read")) return;
    let mounted = true;
    apiFetch<ReconGetResponse>(`/api/inventory/${vehicleId}/recon`)
      .then((res) => {
        if (mounted) setRecon(res.data);
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
  }, [vehicleId, hasPermission]);

  const handleStartRecon = async () => {
    if (!canWrite) return;
    setUpdating(true);
    try {
      const res = await apiFetch<ReconGetResponse>(
        `/api/inventory/${vehicleId}/recon`,
        { method: "PATCH", body: JSON.stringify({ status: "NOT_STARTED" }) }
      );
      setRecon(res.data);
    } catch {
      // silent
    } finally {
      setUpdating(false);
    }
  };

  const hasPhotos = (vehicle.photos?.length ?? 0) > 0;
  const reconStatus: ReconStatus = recon?.status ?? "NOT_STARTED";
  const isComplete = reconStatus === "COMPLETE";

  const photoDate = vehicle.photos?.length
    ? vehicle.photos.reduce((latest, p) => {
        const d = new Date(p.createdAt).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>
          Recon &amp; Readiness
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-28 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="space-y-3">
            {/* Status row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-[var(--success)]" />
                ) : (
                  <CircleAlert className="h-5 w-5 text-[var(--warning)]" />
                )}
                <span className="text-sm font-medium text-[var(--text)]">
                  {RECON_STATUS_LABEL[reconStatus]}
                </span>
              </div>
              {isComplete && (
                <span className={cn(badgeBase, badgeSuccess)}>
                  READY TO SALE
                </span>
              )}
            </div>

            {/* Checkpoints */}
            <ul className="space-y-2 text-sm" role="list">
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-soft)]">Completed</span>
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  ) : (
                    <CircleAlert className="h-4 w-4 text-[var(--muted-text)]" />
                  )}
                  <span className="text-[var(--text)] tabular-nums">
                    {recon?.dueDate
                      ? formatDate(recon.dueDate)
                      : vehicle.updatedAt
                        ? formatDate(vehicle.updatedAt)
                        : "—"}
                  </span>
                </div>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-soft)]">Photos</span>
                <div className="flex items-center gap-2">
                  {hasPhotos ? (
                    <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  ) : (
                    <CircleAlert className="h-4 w-4 text-[var(--danger)]" />
                  )}
                  <span className="text-[var(--text)] tabular-nums">
                    {photoDate
                      ? formatDate(new Date(photoDate).toISOString())
                      : "—"}
                  </span>
                </div>
              </li>
            </ul>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleStartRecon}
                disabled={updating}
              >
                Start Recon
              </Button>
              {canWrite && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartRecon}
                  disabled={updating}
                >
                  Start Recon
                </Button>
              )}
            </div>
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
