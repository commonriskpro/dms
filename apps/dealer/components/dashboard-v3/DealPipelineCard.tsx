"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import type { SignalListItem } from "@/components/ui-system/signals";
import {
  fetchDomainSignalItems,
  mapWidgetRowsToSignalItems,
  shouldToastSignalError,
} from "./intelligence-signals";

const ROW_HREF_BY_KEY: Record<string, string> = {
  pendingDeals: "/deals",
  submittedDeals: "/deals",
  contractsToReview: "/deals",
  fundingIssues: "/deals",
};

const STAGE_LABELS = ["New", "Contacted", "Negotiating", "Approved", "Won"] as const;

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
        if (!shouldToastSignalError(e)) return;
        addToast("error", "Failed to refresh deal signals");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [addToast, refreshToken]);

  const totalInStages = useMemo(
    () => items.reduce((sum, item) => sum + (item.count ?? 0), 0),
    [items]
  );

  return (
    <WidgetCard
      title={title}
      subtitle="Deal stages this week"
      action={<span className="text-xs font-medium tabular-nums text-[var(--muted-text)]">{totalInStages} active</span>}
    >
      {loading ? (
        <SkeletonList lines={4} />
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-5">
            {STAGE_LABELS.map((label, idx) => {
              const item = items[idx];
              const count = item?.count ?? 0;
              return (
                <section
                  key={label}
                  className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                      {label}
                    </p>
                    <span className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--muted-text)]">
                      {count}
                    </span>
                  </div>
                  {item ? (
                    <div className="mt-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
                      <p className="truncate text-xs font-semibold text-[var(--text)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--text)]">
                        {count}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted-text)]">
                        {item.description ?? "Pipeline signal"}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1.5 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
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
