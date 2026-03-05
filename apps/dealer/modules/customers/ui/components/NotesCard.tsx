"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { Button } from "@/components/ui/button";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import type { CustomerNote, NotesListResponse } from "@/lib/types/customers";

const NOTES_LIMIT = 10;

export type NotesCardProps = {
  customerId: string;
  canRead: boolean;
  canWrite: boolean;
  onAddNote?: () => void;
};

export function NotesCard({ customerId, canRead, canWrite, onAddNote }: NotesCardProps) {
  const [data, setData] = React.useState<CustomerNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchNotes = React.useCallback(async () => {
    const params = new URLSearchParams({ limit: String(NOTES_LIMIT), offset: "0" });
    const res = await apiFetch<NotesListResponse>(`/api/customers/${customerId}/notes?${params}`);
    setData(res.data);
  }, [customerId]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchNotes().catch((e) => setError(e instanceof Error ? e.message : "Failed to load notes")).finally(() => setLoading(false));
  }, [canRead, fetchNotes]);

  if (!canRead) return null;

  return (
    <DMSCard>
      <DMSCardHeader className="flex-row items-center justify-between gap-2">
        <DMSCardTitle>Notes</DMSCardTitle>
        {canWrite && onAddNote && (
          <Button variant="secondary" size="sm" onClick={onAddNote} aria-label="Add note">
            Add note
          </Button>
        )}
      </DMSCardHeader>
      <DMSCardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchNotes} />
        ) : data.length === 0 ? (
          <EmptyState title="No notes" description="Add a note to get started." />
        ) : (
          <ul className="space-y-3">
            {data.map((note) => (
              <li key={note.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap line-clamp-3">{note.body}</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  {note.createdByProfile?.fullName ?? note.createdByProfile?.email ?? "Unknown"} ·{" "}
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
