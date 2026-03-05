"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import type { SessionLifecycleStatus } from "@/lib/types/session";
import { GlobalSearch } from "@/modules/search/ui/GlobalSearch";

function LifecycleBadge({ status }: { status: SessionLifecycleStatus }) {
  const styles: Record<SessionLifecycleStatus, string> = {
    ACTIVE:
      "rounded-full px-2 py-0.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted-text)]",
    SUSPENDED:
      "rounded-full border px-2 py-0.5 text-xs bg-[var(--sev-warning)]/20 text-[var(--sev-warning)] border-[var(--sev-warning)]/40",
    CLOSED:
      "rounded-full border px-2 py-0.5 text-xs bg-[var(--sev-danger)]/20 text-[var(--sev-danger)] border-[var(--sev-danger)]/40",
  };
  return (
    <span
      className={`inline-flex items-center font-medium ${styles[status]}`}
      title={`Dealership status: ${status}`}
    >
      {status}
    </span>
  );
}

export function Topbar() {
  const router = useRouter();
  const { user, activeDealership, lifecycleStatus } = useSession();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const displayInitials = user
    ? (user.fullName ?? "U")
        .trim()
        .slice(0, 2)
        .toUpperCase() || "U"
    : "JD";

  return (
<<<<<<< HEAD
    <header className="h-16 px-6 bg-[var(--topbar-bg)] backdrop-blur-md border-b border-[var(--topbar-border)] shadow-[var(--topbar-shadow)]">
=======
    <header className="h-16 px-6 bg-[var(--surface)] shadow-[var(--shadow-topbar)]">
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
      <div className="h-full grid grid-cols-[560px_1fr] items-center">
        <div className="min-w-0 w-[560px]">
          <GlobalSearch />
        </div>
        <div className="flex w-full items-center justify-end gap-6">
          {/* group A: dealership + active (small, muted) */}
          <div className="hidden md:flex items-center gap-3">
            {activeDealership && (
              <span className="max-w-[180px] truncate text-sm text-[var(--muted-text)]" title="Active dealership">
                {activeDealership.name}
              </span>
            )}
            {lifecycleStatus && <LifecycleBadge status={lifecycleStatus} />}
          </div>

          {/* group B: controls exactly like mock order */}
          <div className="flex items-center gap-3">
            {/* Refresh text control (NOT a circle button) */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--muted-text)] hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Refresh"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            {/* Bell icon button */}
            <button
              type="button"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-transparent bg-transparent hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Notifications"
            >
              <svg className="h-4 w-4 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--sev-danger)]" aria-hidden />
            </button>

            {/* Apps grid icon button */}
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-transparent bg-transparent hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Apps"
            >
              <svg className="h-4 w-4 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>

            {/* Avatar */}
            <div
              className="h-9 w-9 rounded-full bg-[rgba(15,23,42,0.85)] text-white text-sm font-semibold flex items-center justify-center shrink-0"
              title={user?.fullName ?? undefined}
            >
              {displayInitials}
            </div>

            {/* Sign out (plain text link like mock) */}
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-1 text-sm text-[var(--muted-text)] hover:text-[var(--text)] transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
