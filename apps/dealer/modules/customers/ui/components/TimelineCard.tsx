"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
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
  TimelineEvent,
  TimelineEventType,
  TimelineListResponse,
} from "@/lib/types/customers";
import { cn } from "@/lib/utils";

const TIMELINE_PAGE_SIZE = 25;
const EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  NOTE: "Note",
  CALL: "Call",
  CALLBACK: "Callback",
  APPOINTMENT: "Appointment",
  SYSTEM: "Activity",
};

export type TimelineCardProps = {
  customerId: string;
  canRead: boolean;
  canWrite: boolean;
  initialData?: TimelineListResponse | null;
};

function formatEventSummary(event: TimelineEvent): string {
  switch (event.type) {
    case "NOTE":
      return (event.payloadJson?.body as string) ?? "";
    case "CALL":
      return (event.payloadJson?.summary as string) ?? "Call logged";
    case "CALLBACK":
      return (event.payloadJson?.reason as string) ?? "Callback";
    case "APPOINTMENT":
      return "Appointment";
    case "SYSTEM": {
      const channel = event.payloadJson?.channel as string | undefined;
      const direction = (event.payloadJson?.direction as string) ?? "outbound";
      const preview = (event.payloadJson?.contentPreview as string) ?? "";
      if (channel === "sms") {
        return preview ? `SMS (${direction}): ${preview}` : `SMS (${direction})`;
      }
      if (channel === "email") {
        return preview ? `Email (${direction}): ${preview}` : `Email (${direction})`;
      }
      return (event.payloadJson?.activityType as string) ?? "Activity";
    }
    default:
      return "";
  }
}

function getMessageEventLabel(event: TimelineEvent): string {
  if (event.type !== "SYSTEM") return EVENT_TYPE_LABEL[event.type];
  const channel = event.payloadJson?.channel as string | undefined;
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  return EVENT_TYPE_LABEL.SYSTEM;
}

export function TimelineCard({
  customerId,
  canRead,
  canWrite,
  initialData,
}: TimelineCardProps) {
  const { addToast } = useToast();
  const [items, setItems] = React.useState<TimelineEvent[]>(initialData?.data ?? []);
  const [meta, setMeta] = React.useState(
    initialData?.meta ?? { total: 0, limit: TIMELINE_PAGE_SIZE, offset: 0 }
  );
  const [loading, setLoading] = React.useState(!initialData);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteSubmitting, setNoteSubmitting] = React.useState(false);
  const [logCallOpen, setLogCallOpen] = React.useState(false);
  const [callSummary, setCallSummary] = React.useState("");
  const [callDuration, setCallDuration] = React.useState("");
  const [callDirection, setCallDirection] = React.useState("");
  const [callSubmitting, setCallSubmitting] = React.useState(false);

  const fetchPage = React.useCallback(
    async (offset: number, append: boolean) => {
      if (!canRead) return;
      const params = new URLSearchParams({
        limit: String(TIMELINE_PAGE_SIZE),
        offset: String(offset),
      });
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<TimelineListResponse>(
          `/api/customers/${customerId}/timeline?${params}`
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

  const loadMore = () => {
    if (loadingMore || items.length >= meta.total) return;
    fetchPage(meta.offset + meta.limit, true);
  };

  const handleAddNote = async () => {
    const body = noteBody.trim();
    if (!body || !canWrite) return;
    setNoteSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      addToast("success", "Note added");
      setNoteBody("");
      await fetchPage(0, false);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleLogCall = async () => {
    if (!canWrite) return;
    setCallSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/calls`, {
        method: "POST",
        body: JSON.stringify({
          summary: callSummary.trim() || undefined,
          durationSeconds: callDuration ? parseInt(callDuration, 10) : undefined,
          direction: callDirection.trim() || undefined,
        }),
      });
      addToast("success", "Call logged");
      setLogCallOpen(false);
      setCallSummary("");
      setCallDuration("");
      setCallDirection("");
      await fetchPage(0, false);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setCallSubmitting(false);
    }
  };

  const hasMore = items.length < meta.total;

  if (!canRead) return null;

  return (
    <DMSCard>
      <DMSCardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
        <DMSCardTitle>Timeline</DMSCardTitle>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLogCallOpen(true)}
              aria-label="Log call"
            >
              Log call
            </Button>
          </div>
        )}
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        {canWrite && (
          <div className="space-y-2">
            <label htmlFor="timeline-note-body" className="sr-only">
              Add a note
            </label>
            <textarea
              id="timeline-note-body"
              className="min-h-[80px] w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="Add a note…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              aria-label="Note text"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!noteBody.trim() || noteSubmitting}
              aria-label="Submit note"
            >
              {noteSubmitting ? "Adding…" : "Add note"}
            </Button>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="space-y-2" role="status" aria-label="Loading timeline">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={() => fetchPage(0, false)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Add a note or log a call to get started."
          />
        ) : (
          <>
            <ul className="list-none p-0 m-0 space-y-3" role="list" aria-label="Timeline">
              {items.map((event) => (
                <li
                  key={`${event.type}-${event.sourceId}-${event.createdAt}`}
                  className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"
                  role="listitem"
                >
                  <span
                    className={cn(
                      "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                      event.type === "NOTE" && "bg-[var(--muted)] text-[var(--text)]",
                      event.type === "CALL" && "bg-[var(--info-muted)] text-[var(--info-muted-fg)]",
                      event.type === "CALLBACK" && "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
                      event.type === "APPOINTMENT" && "bg-[var(--accent)]/15 text-[var(--accent)]",
                      event.type === "SYSTEM" && "bg-[var(--muted)] text-[var(--text-soft)]"
                    )}
                    aria-hidden
                  >
                    {getMessageEventLabel(event)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">
                      {formatEventSummary(event) || "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                aria-label="Load more"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </DMSCardContent>

      <Dialog open={logCallOpen} onOpenChange={setLogCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log call</DialogTitle>
            <DialogDescription>
              Record a call with this customer. Summary is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <label htmlFor="call-summary" className="block text-sm font-medium text-[var(--text)] mb-1">
                Summary
              </label>
              <Input
                id="call-summary"
                value={callSummary}
                onChange={(e) => setCallSummary(e.target.value)}
                placeholder="Brief summary"
                className="bg-[var(--surface)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="call-duration" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Duration (seconds)
                </label>
                <Input
                  id="call-duration"
                  type="number"
                  min={0}
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="Optional"
                  className="bg-[var(--surface)]"
                />
              </div>
              <div>
                <label htmlFor="call-direction" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Direction
                </label>
                <Input
                  id="call-direction"
                  value={callDirection}
                  onChange={(e) => setCallDirection(e.target.value)}
                  placeholder="Inbound / Outbound"
                  className="bg-[var(--surface)]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLogCallOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogCall} disabled={callSubmitting}>
              {callSubmitting ? "Logging…" : "Log call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DMSCard>
  );
}
