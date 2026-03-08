"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import { sevBadgeClasses } from "@/lib/ui/tokens";
import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";
import { EmptyStatePanel } from "@/components/ui-system/feedback";

const SEVERITY_BADGE: Record<string, string> = {
  info: sevBadgeClasses.info,
  success: sevBadgeClasses.success,
  warning: sevBadgeClasses.warning,
  danger: sevBadgeClasses.danger,
};

const ROW_HREF: Record<string, string> = {
  carsInRecon: "/inventory",
  pendingTasks: "/inventory",
  notPostedOnline: "/inventory",
  missingDocs: "/inventory",
  lowStock: "/inventory",
};

function getHref(row: WidgetRow): string | undefined {
  return row.href ?? ROW_HREF[row.key];
}

function RowBadge({ row }: { row: WidgetRow }) {
  const cls = row.severity ? SEVERITY_BADGE[row.severity] : sevBadgeClasses.warning;
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold tabular-nums text-white ${cls}`}>
      {row.count}
    </span>
  );
}

function RowLeft({ row }: { row: WidgetRow }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <RowBadge row={row} />
      <span className="text-sm font-medium text-[var(--text)] truncate">{row.label}</span>
    </div>
  );
}

function RowRight({ row }: { row: WidgetRow }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted-text)]">
      <span>{row.count}</span>
      <span>•</span>
      <span>{row.count} Total</span>
    </div>
  );
}

export function InventoryAlertsCard({
  rows,
  refreshToken,
}: {
  rows: WidgetRow[];
  refreshToken?: number;
}) {
  const [items, setItems] = useState<WidgetRow[]>(rows);
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    apiFetch<{ data: WidgetRow[] }>("/api/dashboard/v3/inventory-alerts", {
      signal: ac.signal,
    })
      .then((res) => {
        setItems(res.data);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        addToast("error", "Failed to refresh Inventory Alerts");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ac.abort();
  }, [refreshToken, addToast]);

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  return (
    <WidgetCard title="Inventory Alerts">
      {loading ? (
        <SkeletonList lines={5} />
      ) : items.length === 0 ? (
        <EmptyStatePanel
          title="No inventory alerts"
          description="Aging, recon, pricing, and title signals will appear here."
        />
      ) : (
        <ul className="space-y-0.5">
          {items.map((row) => {
            const href = getHref(row);
            return (
              <li key={row.key}>
                {href ? (
                  <WidgetRowLink href={href} left={<RowLeft row={row} />} right={<RowRight row={row} />} />
                ) : (
                  <div className="flex items-center justify-between py-3">
                    <RowLeft row={row} />
                    <RowRight row={row} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
