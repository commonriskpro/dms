"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow, DealStageCounts } from "./types";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import type { SignalListItem } from "@/components/ui-system/signals";
import {
  fetchDomainSignalItems,
  mapWidgetRowsToSignalItems,
  shouldToastSignalError,
} from "./intelligence-signals";
import { cn } from "@/lib/utils";

const ROW_HREF_BY_KEY: Record<string, string> = {
  pendingDeals: "/deals",
  submittedDeals: "/deals",
  contractsToReview: "/deals",
  fundingIssues: "/deals",
};

type Stage = {
  key: keyof DealStageCounts;
  label: string;
  /** Tailwind bg when this stage has deals */
  activeColor: string;
  /** Tailwind bg when empty */
  inactiveColor: string;
};

const STAGES: Stage[] = [
  { key: "draft",      label: "New",        activeColor: "bg-[#2563eb]",  inactiveColor: "bg-[#1e3a6e]" },
  { key: "structured", label: "Contacted",  activeColor: "bg-[#0d9488]",  inactiveColor: "bg-[#134e4a]" },
  { key: "approved",   label: "Negotiating",activeColor: "bg-[#475569]",  inactiveColor: "bg-[#1e293b]" },
  { key: "contracted", label: "Approved",   activeColor: "bg-[#d97706]",  inactiveColor: "bg-[#451a03]" },
  { key: "funded",     label: "Won",        activeColor: "bg-[#0d9488]",  inactiveColor: "bg-[#134e4a]" },
];

function StageFunnel({ stageCounts }: { stageCounts: DealStageCounts }) {
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, idx) => {
        const count = stageCounts[stage.key];
        const isLast = idx === STAGES.length - 1;
        const hasDeals = count > 0;
        return (
          <div key={stage.key} className="flex flex-1 items-center gap-1.5">
            <Link
              href="/deals"
              className={cn(
                "flex flex-1 items-center justify-between gap-1 rounded-[8px] px-3 py-2 transition-opacity hover:opacity-90",
                hasDeals ? stage.activeColor : stage.inactiveColor,
              )}
            >
              <span className="text-[13px] font-semibold text-white leading-none">
                {stage.label}
              </span>
              {!isLast && (
                <span className="text-white/60 text-sm leading-none">›</span>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

const SEVERITY_DOT: Record<string, string> = {
  danger: "bg-[var(--danger)]",
  warning: "bg-[var(--warning)]",
  success: "bg-[var(--success)]",
  info: "bg-[var(--accent)]",
};

export function DealPipelineCard({
  rows,
  stageCounts,
  refreshToken,
  title = "Deal Pipeline",
}: {
  rows: WidgetRow[];
  stageCounts?: DealStageCounts;
  refreshToken?: number;
  title?: string;
}) {
  const [items, setItems] = useState<SignalListItem[]>(
    mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY)
  );
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const { addToast } = useToast();
  const totalActive = stageCounts
    ? Object.values(stageCounts).reduce((s, v) => s + v, 0)
    : items.reduce((s, item) => s + (item.count ?? 0), 0);

  useEffect(() => {
    setItems(mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY));
  }, [rows]);

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (!didMount.current) { didMount.current = true; return; }
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

  return (
    <WidgetCard
      title={title}
      subtitle="Deal stages this week"
      action={
        <span className="text-xs font-semibold tabular-nums text-[var(--muted-text)]">
          {totalActive} active
        </span>
      }
    >
      {loading ? (
        <SkeletonList lines={4} />
      ) : (
        <div className="space-y-3">
          <StageFunnel stageCounts={stageCounts ?? { draft: 0, structured: 0, approved: 0, contracted: 0, funded: 0 }} />

          {items.length > 0 ? (
            <ul>
              {items.map((item) => {
                const dot = item.severity ? SEVERITY_DOT[item.severity] : "bg-[var(--border)]";
                return (
                  <li key={item.id}>
                    <Link
                      href={item.actionHref ?? "/deals"}
                      className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
                        <span className="truncate text-sm font-medium text-[var(--text)]">
                          {item.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--muted-text)]">
                        {item.count ?? 0}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 text-sm text-[var(--muted-text)]">No pipeline activity.</p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
