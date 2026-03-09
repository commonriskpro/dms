"use client";

import { useEffect, useRef, useState } from "react";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/toast";
import { SignalList, type SignalListItem } from "@/components/ui-system/signals";
import type { DashboardV3FinanceNotice } from "./types";
import { WidgetCard } from "./WidgetCard";
import { fetchDomainSignalItems, shouldToastSignalError } from "./intelligence-signals";

export function FinanceNoticesCard({
  financeNotices,
  refreshToken,
}: {
  financeNotices: DashboardV3FinanceNotice[];
  refreshToken?: number;
}) {
  const [items, setItems] = useState<SignalListItem[]>(
    financeNotices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      description: notice.subtitle ?? "Finance update",
      severity: notice.severity,
      count: null,
    }))
  );
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    setItems(
      financeNotices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        description: notice.subtitle ?? "Finance update",
        severity: notice.severity,
        count: null,
      }))
    );
  }, [financeNotices]);

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetchDomainSignalItems("operations", ac.signal)
      .then((nextItems) => setItems(nextItems))
      .catch((e) => {
        if (!shouldToastSignalError(e)) return;
        addToast("error", "Failed to refresh operations signals");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [addToast, refreshToken]);

  return (
    <WidgetCard title="Operations Queue">
      {loading ? (
        <SkeletonList lines={4} />
      ) : (
        <SignalList
          items={items}
          emptyTitle="No operations signals"
          emptyDescription="Title, funding, and ops workflow signals will appear here."
        />
      )}
    </WidgetCard>
  );
}
