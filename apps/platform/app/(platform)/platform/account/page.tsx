"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

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

export default function PlatformAccountPage() {
  const [sessions, setSessions] = React.useState<SessionItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [revoking, setRevoking] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const toast = useToast();

  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/auth/sessions");
      if (!res.ok) {
        setError("Failed to load sessions. Try again later.");
        setSessions([]);
        return;
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
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
    setConfirmOpen(false);
    setRevoking(true);
    try {
      const res = await fetch("/api/platform/auth/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAllOthers: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data?.error?.message ?? "Something went wrong. Try again later.", "error");
        return;
      }
      toast("Other sessions have been revoked.", "success");
      await loadSessions();
    } catch {
      toast("Something went wrong. Try again later.", "error");
    } finally {
      setRevoking(false);
    }
  };

  const onlyCurrent =
    sessions != null && (sessions.length <= 1 || sessions.every((s) => s.current));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Account</h1>
        <p className="text-sm text-[var(--text-soft)] mt-1">
          Manage your platform account and sessions.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium text-[var(--text)] mb-2">Sessions</h2>
        <p className="text-sm text-[var(--text-soft)] mb-4">
          Devices where you are signed in. You can revoke all other sessions to sign out everywhere
          except this device.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Loading sessions…
          </div>
        )}

        {error && (
          <div
            className="rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]"
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && onlyCurrent && sessions?.length === 1 && (
          <p className="text-sm text-[var(--text-soft)] mb-4">
            You&apos;re only signed in on this device.
          </p>
        )}

        {!loading && sessions != null && sessions.length > 0 && (
          <ul className="space-y-2 mb-4" role="list">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--text)]">
                    {session.current ? "This device" : "Other session"}
                  </span>
                  {session.current && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--text-soft)]">
                      Current
                    </span>
                  )}
                  <div className="mt-0.5 text-xs text-[var(--text-soft)]">
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
          onClick={() => setConfirmOpen(true)}
          disabled={revoking}
        >
          {revoking ? "Revoking…" : "Revoke all other sessions"}
        </Button>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTitle>Revoke all other sessions</DialogTitle>
        <DialogDescription>
          You will stay signed in on this device. All other devices will be signed out. Continue?
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRevokeAllOthers}>
            Revoke others
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
