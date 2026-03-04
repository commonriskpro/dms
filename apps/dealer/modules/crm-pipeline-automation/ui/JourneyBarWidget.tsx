"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { SegmentedJourneyBar } from "@/components/journey-bar";
import type { JourneyBarStage, JourneyBarSignals } from "@/components/journey-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { useWriteDisabled } from "@/components/write-guard";
import { shouldFetchCrm } from "./crm-guards";

export type JourneyBarApiData = {
  stages: JourneyBarStage[];
  currentStageId: string | null;
  currentIndex: number;
  signals?: JourneyBarSignals;
  nextBestActionKey?: string | null;
};

type JourneyBarWidgetProps =
  | { customerId: string; opportunityId?: never }
  | { opportunityId: string; customerId?: never };

export function JourneyBarWidget(props: JourneyBarWidgetProps & {
  canRead: boolean;
  canWrite: boolean;
  onStageChanged?: () => void;
  className?: string;
}) {
  const { canRead, canWrite, onStageChanged, className } = props;
  const customerId = "customerId" in props ? props.customerId : undefined;
  const opportunityId = "opportunityId" in props ? props.opportunityId : undefined;

  const { addToast } = useToast();
  const { disabled: writeDisabled } = useWriteDisabled();
  const [data, setData] = React.useState<JourneyBarApiData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchJourneyBar = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead) || (!customerId && !opportunityId)) return;
    const params = customerId
      ? `?customerId=${encodeURIComponent(customerId)}`
      : `?opportunityId=${encodeURIComponent(opportunityId!)}`;
    try {
      const res = await apiFetch<{ data: JourneyBarApiData }>(
        `/api/crm/journey-bar${params}`
      );
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canRead, customerId, opportunityId]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchJourneyBar();
  }, [canRead, fetchJourneyBar]);

  const handleStageChange = React.useCallback(
    async (newStageId: string) => {
      try {
        if (customerId) {
          await apiFetch<{ data: { id: string; stageId: string } }>(
            `/api/crm/customers/${customerId}/stage`,
            { method: "PATCH", body: JSON.stringify({ newStageId }) }
          );
        } else if (opportunityId) {
          await apiFetch<{ data: { id: string; stageId: string } }>(
            `/api/crm/opportunities/${opportunityId}/stage`,
            { method: "PATCH", body: JSON.stringify({ newStageId }) }
          );
        }
        addToast("success", "Stage updated");
        await fetchJourneyBar();
        onStageChanged?.();
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
        throw e;
      }
    },
    [customerId, opportunityId, fetchJourneyBar, addToast, onStageChanged]
  );

  if (!canRead) return null;

  if (loading) {
    return (
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-sm ${className ?? ""}`}>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-sm ${className ?? ""}`}>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const canChangeStage = canWrite && !writeDisabled;
  return (
    <SegmentedJourneyBar
      stages={data.stages}
      currentStageId={data.currentStageId}
      currentIndex={data.currentIndex}
      signals={data.signals}
      nextBestActionKey={data.nextBestActionKey}
      canChangeStage={canChangeStage}
      onStageChange={canChangeStage ? handleStageChange : undefined}
      className={className}
    />
  );
}
