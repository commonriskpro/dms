"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/client/http";

type SessionItem = {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt?: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SessionsBlock() {
  const [sessions, setSessions] = React.useState<SessionItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [revoking, setRevoking] = React.useState(false);
  const [error, setError] = React.useState("");
  const confirm = useConfirm();
  const { addToast } = useToast();

  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ sessions: SessionItem[] }>("/api/auth/sessions");
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError("Failed to load sessions. Try again later.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeAllOthers = async () => {
    const ok = await confirm({
      title: "Revoke all other sessions",
      description:
        "You will stay signed in on this device. All other devices will be signed out. Continue?",
      confirmText: "Revoke others",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    setRevoking(true);
    try {
      await apiFetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAllOthers: true }),
      });
      addToast("success", "Other sessions have been revoked.");
      await loadSessions();
    } catch {
      addToast("error", "Something went wrong. Try again later.");
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-text)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        Loading sessions…
      </div>
    );
  }

  const onlyCurrent =
    sessions != null && (sessions.length <= 1 || sessions.every((s) => s.current));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[var(--text)] mb-1">Sessions</p>
        <p className="text-xs text-[var(--muted-text)] mb-3">
          Devices where you are signed in. You can revoke all other sessions to sign out everywhere
          except this device.
        </p>
      </div>

      {error && (
        <div
          className="rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]"
          role="alert"
        >
          {error}
        </div>
      )}

      {onlyCurrent && sessions?.length === 1 && (
        <p className="text-sm text-[var(--muted-text)]">
          You&apos;re only signed in on this device.
        </p>
      )}

      {sessions != null && sessions.length > 0 && (
        <ul className="space-y-2" role="list">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-[var(--text)]">
                  {session.current ? "This device" : "Other session"}
                </span>
                {session.current && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Current
                  </Badge>
                )}
                <div className="mt-0.5 text-xs text-[var(--muted-text)]">
                  {session.lastActiveAt
                    ? `Last active ${formatDate(session.lastActiveAt)}`
                    : `Created ${formatDate(session.createdAt)}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleRevokeAllOthers}
        disabled={revoking}
      >
        {revoking ? "Revoking…" : "Revoke all other sessions"}
      </Button>
    </div>
  );
}
