"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import type {
  CustomerCallbackItem,
  CustomerCallbackStatus,
  CallbacksListResponse,
} from "@/lib/types/customers";
import { cn } from "@/lib/utils";

const CALLBACKS_PAGE_SIZE = 25;

export type CallbacksCardProps = {
  customerId: string;
  canRead: boolean;
  canWrite: boolean;
  initialData?: CallbacksListResponse | null;
};

function isOverdue(cb: CustomerCallbackItem): boolean {
  if (cb.status !== "SCHEDULED") return false;
  const now = new Date().toISOString();
  if (cb.callbackAt >= now) return false;
  if (cb.snoozedUntil && cb.snoozedUntil >= now) return false;
  return true;
}

export function CallbacksCard({
  customerId,
  canRead,
  canWrite,
  initialData,
}: CallbacksCardProps) {
  const { addToast } = useToast();
  const [items, setItems] = React.useState<CustomerCallbackItem[]>(initialData?.data ?? []);
  const [meta, setMeta] = React.useState(
    initialData?.meta ?? { total: 0, limit: CALLBACKS_PAGE_SIZE, offset: 0 }
  );
  const [loading, setLoading] = React.useState(!initialData);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState("");
  const [scheduleReason, setScheduleReason] = React.useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = React.useState(false);
  const [snoozeOpen, setSnoozeOpen] = React.useState<string | null>(null);
  const [snoozeUntil, setSnoozeUntil] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(
    async (offset: number, append: boolean) => {
      if (!canRead) return;
      const params = new URLSearchParams({
        limit: String(CALLBACKS_PAGE_SIZE),
        offset: String(offset),
      });
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<CallbacksListResponse>(
          `/api/customers/${customerId}/callbacks?${params}`
        );
        setMeta(res.meta);
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      } catch (e) {
        setError(getApiErrorMessage(e));
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
    if (initialData) {
      setItems(initialData.data);
      setMeta(initialData.meta);
      setLoading(false);
      return;
    }
    fetchPage(0, false);
  }, [canRead, customerId, initialData, fetchPage]);

  const refetch = () => fetchPage(0, false);

  const handleSchedule = async () => {
    if (!canWrite || !scheduleAt.trim()) return;
    const callbackAt = new Date(scheduleAt.trim()).toISOString();
    setScheduleSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/callbacks`, {
        method: "POST",
        body: JSON.stringify({
          callbackAt,
          reason: scheduleReason.trim() || undefined,
        }),
      });
      addToast("success", "Callback scheduled");
      setScheduleOpen(false);
      setScheduleAt("");
      setScheduleReason("");
      refetch();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const patchCallback = async (
    callbackId: string,
    body: { status?: CustomerCallbackStatus; snoozedUntil?: string | null }
  ) => {
    try {
      await apiFetch(`/api/customers/${customerId}/callbacks/${callbackId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      refetch();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setActionLoading(null);
      setSnoozeOpen(null);
      setSnoozeUntil("");
    }
  };

  const handleMarkDone = async (cb: CustomerCallbackItem) => {
    if (!canWrite) return;
    setActionLoading(cb.id);
    try {
      await patchCallback(cb.id, { status: "DONE" });
      addToast("success", "Callback marked done");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async (callbackId: string) => {
    if (!canWrite || !snoozeUntil.trim()) return;
    const snoozedUntil = new Date(snoozeUntil.trim()).toISOString();
    setActionLoading(callbackId);
    await patchCallback(callbackId, { snoozedUntil });
    addToast("success", "Callback snoozed");
  };

  const handleCancel = async (cb: CustomerCallbackItem) => {
    if (!canWrite) return;
    const ok = await confirm({
      title: "Cancel callback",
      description: "This callback will be marked as cancelled. You can schedule a new one later.",
      confirmText: "Cancel callback",
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading(cb.id);
    try {
      await patchCallback(cb.id, { status: "CANCELLED" });
      addToast("success", "Callback cancelled");
    } finally {
      setActionLoading(null);
    }
  };

  const hasMore = items.length < meta.total;

  if (!canRead) return null;

  return (
    <DMSCard>
      <DMSCardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
        <DMSCardTitle>Callbacks</DMSCardTitle>
        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setScheduleOpen(true)}
            aria-label="Schedule callback"
          >
            Schedule
          </Button>
        )}
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        {loading && items.length === 0 ? (
          <div className="space-y-2" role="status" aria-label="Loading callbacks">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={() => fetchPage(0, false)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No callbacks"
            description="Schedule a callback to follow up with this customer."
          />
        ) : (
          <>
            <ul className="list-none p-0 m-0 space-y-2" role="list" aria-label="Callbacks">
              {items.map((cb) => {
                const overdue = isOverdue(cb);
                const loadingThis = actionLoading === cb.id;
                return (
                  <li
                    key={cb.id}
                    className={cn(
                      "rounded-lg border p-3",
                      overdue
                        ? "border-[var(--danger)] bg-[var(--danger)]/5"
                        : "border-[var(--border)] bg-[var(--panel)]"
                    )}
                    role="listitem"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded",
                              cb.status === "SCHEDULED" && "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
                              cb.status === "DONE" && "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
                              cb.status === "CANCELLED" && "bg-[var(--muted)] text-[var(--text-soft)]"
                            )}
                          >
                            {cb.status}
                          </span>
                          {overdue && (
                            <span className="text-xs font-medium text-[var(--danger)]">Overdue</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text)] mt-1">
                          {new Date(cb.callbackAt).toLocaleString()}
                          {cb.snoozedUntil && (
                            <span className="text-[var(--text-soft)] ml-1">
                              (snoozed until {new Date(cb.snoozedUntil).toLocaleString()})
                            </span>
                          )}
                        </p>
                        {cb.reason && (
                          <p className="text-sm text-[var(--text-soft)] mt-0.5">{cb.reason}</p>
                        )}
                      </div>
                      {canWrite && cb.status === "SCHEDULED" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleMarkDone(cb)}
                            disabled={loadingThis}
                            aria-label={`Mark callback ${cb.id} done`}
                          >
                            Done
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSnoozeOpen(cb.id)}
                            disabled={loadingThis}
                            aria-label={`Snooze callback ${cb.id}`}
                          >
                            Snooze
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCancel(cb)}
                            disabled={loadingThis}
                            className="text-[var(--danger)]"
                            aria-label={`Cancel callback ${cb.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchPage(meta.offset + meta.limit, true)}
                disabled={loadingMore}
                aria-label="Load more callbacks"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </DMSCardContent>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule callback</DialogTitle>
            <DialogDescription>
              Set when to follow up with this customer. Date and time required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <label htmlFor="callback-at" className="block text-sm font-medium text-[var(--text)] mb-1">
                Date & time
              </label>
              <Input
                id="callback-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="bg-[var(--surface)]"
              />
            </div>
            <div>
              <label htmlFor="callback-reason" className="block text-sm font-medium text-[var(--text)] mb-1">
                Reason (optional)
              </label>
              <Input
                id="callback-reason"
                value={scheduleReason}
                onChange={(e) => setScheduleReason(e.target.value)}
                placeholder="e.g. Follow up on quote"
                className="bg-[var(--surface)]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!scheduleAt.trim() || scheduleSubmitting}
            >
              {scheduleSubmitting ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snoozeOpen !== null} onOpenChange={(open) => !open && setSnoozeOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze callback</DialogTitle>
            <DialogDescription>
              Set when to be reminded again. The callback will stay scheduled until then.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="snooze-until" className="block text-sm font-medium text-[var(--text)] mb-1">
              Snooze until
            </label>
            <Input
              id="snooze-until"
              type="datetime-local"
              value={snoozeUntil}
              onChange={(e) => setSnoozeUntil(e.target.value)}
              className="bg-[var(--surface)]"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSnoozeOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => snoozeOpen && handleSnooze(snoozeOpen)}
              disabled={!snoozeUntil.trim() || !!actionLoading}
            >
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DMSCard>
  );
}
