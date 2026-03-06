"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { CustomerActivityItem, ActivityListResponse } from "@/lib/types/customers";

const ACTIVITY_PAGE_SIZE = 20;

function getActivityIcon(type: string): string {
  if (type.includes("note")) return "📝";
  if (type.includes("task")) return "✓";
  if (type.includes("created")) return "➕";
  if (type.includes("updated")) return "✏️";
  if (type.includes("deleted")) return "🗑️";
  return "•";
}

function getActivityMessage(item: CustomerActivityItem): string {
  const t = item.activityType;
  if (t === "note_added") return "Note added";
  if (t === "task_created") return "Task created";
  if (t === "task_completed") return "Task completed";
  if (t === "customer_created") return "Customer created";
  if (t === "customer_updated") return "Customer updated";
  if (t === "customer_deleted") return "Customer deleted";
  return t.replace(/_/g, " ");
}

/** Map activityType to filter pill category (DealerCenter-style). */
function getActivityFilterCategory(type: string): string {
  if (type === "note_added") return "Notes";
  if (type === "task_created" || type === "task_completed") return "Tasks";
  if (type.includes("appt") || type === "appointment") return "Appt";
  if (type.includes("phone") || type === "phone_call") return "Phone";
  if (type.includes("sms")) return "SMS";
  if (type.includes("email")) return "Email";
  if (type.includes("chat")) return "Chat";
  return "Other";
}

const ACTIVITY_FILTER_OPTIONS = ["All", "Notes", "Appt", "Phone", "SMS", "Email", "Tasks", "Chat", "Other"] as const;

export interface ActivityTimelineProps {
  customerId: string;
  canRead: boolean;
  className?: string;
  /** When true, load more on scroll (infinite scroll). */
  infiniteScroll?: boolean;
  /** "cards" = DealerCenter-style card per entry; "list" = compact list (default). */
  variant?: "list" | "cards";
}

export function ActivityTimeline({
  customerId,
  canRead,
  className = "",
  infiniteScroll = false,
  variant = "list",
}: ActivityTimelineProps) {
  const [items, setItems] = React.useState<CustomerActivityItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: ACTIVITY_PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filterPill, setFilterPill] = React.useState<string>("All");

  const fetchPage = React.useCallback(
    async (offset: number, append: boolean) => {
      if (!canRead) return;
      const url = `/api/customers/${customerId}/activity?limit=${ACTIVITY_PAGE_SIZE}&offset=${offset}`;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<ActivityListResponse>(url);
        setMeta(res.meta);
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [customerId, canRead]
  );

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchPage(0, false);
  }, [canRead, customerId, fetchPage]);

  const loadMore = () => {
    if (loadingMore || items.length >= meta.total) return;
    fetchPage(meta.offset + meta.limit, true);
  };

  const hasMore = items.length < meta.total;

  const filteredItems =
    filterPill === "All"
      ? items
      : items.filter((item) => getActivityFilterCategory(item.activityType) === filterPill);

  if (!canRead) return null;

  if (loading && items.length === 0) {
    return (
      <div className={`space-y-3 ${className}`} role="status" aria-label="Loading activity">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 ${className}`}>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center text-sm text-[var(--text-soft)] ${className}`}
        role="status"
      >
        No activity yet.
      </div>
    );
  }

  return (
    <div className={className} role="list" aria-label="Activity timeline">
      <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Filter activity by type">
        {ACTIVITY_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setFilterPill(opt)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterPill === opt
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--muted)] text-[var(--text-soft)] hover:bg-[var(--border)]"
            }`}
            aria-pressed={filterPill === opt}
            aria-label={`Filter: ${opt}`}
          >
            {opt}
          </button>
        ))}
      </div>
      <ul className={`list-none p-0 m-0 ${variant === "cards" ? "space-y-3" : "space-y-0"}`}>
        {filteredItems.map((item) => (
          <li
            key={item.id}
            className={
              variant === "cards"
                ? "flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 shadow-sm"
                : "flex gap-3 py-3 border-b border-[var(--border)] last:border-b-0"
            }
            role="listitem"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-sm"
              aria-hidden
            >
              {getActivityIcon(item.activityType)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text)]">
                {getActivityMessage(item)}
              </p>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">
                {item.actor?.fullName || item.actor?.email
                  ? `By: ${item.actor.fullName ?? item.actor.email}`
                  : ""}
                {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {filteredItems.length === 0 && filterPill !== "All" && (
        <p className="text-sm text-[var(--text-soft)] py-4">No {filterPill.toLowerCase()} activity.</p>
      )}
      {hasMore && filterPill === "All" && (
        <div className="pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            aria-label="Load more activity"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
