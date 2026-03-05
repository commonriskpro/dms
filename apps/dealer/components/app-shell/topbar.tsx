"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import type { SessionLifecycleStatus } from "@/lib/types/session";
import { GlobalSearch } from "@/modules/search/ui/GlobalSearch";
import { RefreshCw, Bell, LayoutGrid } from "@/lib/ui/icons";

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
    <header className="h-16 px-6 bg-[var(--topbar-bg)] backdrop-blur-md border-b border-[var(--topbar-border)] shadow-[var(--topbar-shadow)]">
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
            {/* Refresh: re-fetch current route data (RSC) without full page reload */}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--muted-text)] hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className="shrink-0" aria-hidden />
              Refresh
            </button>

            {/* Bell icon button */}
            <button
              type="button"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-transparent bg-transparent hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Notifications"
            >
              <Bell size={16} className="text-[var(--muted-text)]" aria-hidden />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--sev-danger)]" aria-hidden />
            </button>

            {/* Apps grid icon button */}
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-transparent bg-transparent hover:bg-[var(--surface-2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Apps"
            >
              <LayoutGrid size={16} className="text-[var(--muted-text)]" aria-hidden />
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
