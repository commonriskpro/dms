"use client";

import { useEffect, useRef, useState } from "react";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import type { SignalListItem } from "@/components/ui-system/signals";
import {
  fetchDomainSignalItems,
  mapWidgetRowsToSignalItems,
} from "./intelligence-signals";

const ROW_HREF_BY_KEY: Record<string, string> = {
  pendingDeals: "/deals",
  submittedDeals: "/deals",
  contractsToReview: "/deals",
  fundingIssues: "/deals",
};

export function DealPipelineCard({
  rows,
  refreshToken,
  title = "Deal Pipeline",
}: {
  rows: WidgetRow[];
  refreshToken?: number;
  title?: string;
}) {
  const [items, setItems] = useState<SignalListItem[]>(
    mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY)
  );
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    setItems(mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY));
  }, [rows]);

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetchDomainSignalItems("deals", ac.signal)
      .then((nextItems) => setItems(nextItems))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        addToast("error", "Failed to refresh deal signals");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [addToast, refreshToken]);

  const stageLabels = ["New", "Contacted", "Negotiating", "Approved", "Won"];

  return (
    <WidgetCard title={title}>
      {loading ? (
        <SkeletonList lines={4} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
            {stageLabels.map((label, idx) => {
              const item = items[idx];
              return (
                <section
                  key={label}
                  className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                    {label}
                  </p>
                  {item ? (
                    <div className="mt-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-2">
                      <p className="truncate text-xs font-medium text-[var(--text)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">
                        {item.count ?? 0}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-2">
                      <p className="text-xs text-[var(--muted-text)]">No deals</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted-text)]">
              No pipeline activity.
            </p>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
