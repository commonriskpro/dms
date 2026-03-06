"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import { sevBadgeClasses } from "@/lib/ui/tokens";
import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";

const SEVERITY_BADGE: Record<string, string> = {
  info: sevBadgeClasses.info,
  success: sevBadgeClasses.success,
  warning: sevBadgeClasses.warning,
  danger: sevBadgeClasses.danger,
};

const ROW_HREF: Record<string, string> = {
  appointments: "/customers",
  newProspects: "/crm/opportunities",
  inbox: "/customers",
  followUps: "/customers",
  creditApps: "/lenders",
};

function getHref(row: WidgetRow): string | undefined {
  return row.href ?? ROW_HREF[row.key];
}

function RowBadge({ row }: { row: WidgetRow }) {
  const cls = row.severity ? SEVERITY_BADGE[row.severity] : sevBadgeClasses.info;
  return (
    <span className={`h-7 min-w-[36px] px-2 rounded-[8px] flex items-center justify-center text-sm font-semibold text-white ${cls}`}>
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
    <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
      <span>{row.count}</span>
      <span>•</span>
      <span>{row.count} Total</span>
    </div>
  );
}

export function CustomerTasksCard({
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
    apiFetch<{ data: WidgetRow[] }>("/api/dashboard/v3/customer-tasks", {
      signal: ac.signal,
    })
      .then((res) => {
        setItems(res.data);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        addToast("error", "Failed to refresh Customer Tasks");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ac.abort();
  }, [refreshToken, addToast]);

  // Sync initial/server data into state when rows prop changes (e.g. navigation)
  useEffect(() => {
    setItems(rows);
  }, [rows]);

  return (
    <WidgetCard title="Customer Tasks">
      {loading ? (
        <SkeletonList lines={5} />
      ) : (
        <ul className="space-y-0.5">
          {items.map((row) => {
            const href = getHref(row);
            return (
              <li key={row.key}>
                {href ? (
                  <WidgetRowLink variant="compact" href={href} left={<RowLeft row={row} />} right={<RowRight row={row} />} />
                ) : (
                  <div className="flex items-center justify-between gap-3 py-2 px-0">
                    <RowLeft row={row} />
                    <span className="text-[var(--text-soft)] shrink-0"><RowRight row={row} /></span>
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
