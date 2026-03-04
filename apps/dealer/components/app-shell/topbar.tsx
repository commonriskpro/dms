"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import type { SessionLifecycleStatus } from "@/lib/types/session";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/modules/search/ui/GlobalSearch";

function LifecycleBadge({ status }: { status: SessionLifecycleStatus }) {
  const styles: Record<SessionLifecycleStatus, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    SUSPENDED: "bg-amber-100 text-amber-800 border-amber-200",
    CLOSED: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
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

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 gap-4">
      <Link href="/dashboard" className="text-lg font-semibold text-[var(--text)] shrink-0">
        DMS
      </Link>
      <div className="flex flex-1 max-w-xl items-center justify-center min-w-0">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {activeDealership && (
          <div className="flex items-center gap-2 hidden sm:flex">
            <span className="text-sm text-[var(--text-soft)] truncate max-w-[120px]" title="Active dealership">
              {activeDealership.name}
            </span>
            {lifecycleStatus && <LifecycleBadge status={lifecycleStatus} />}
          </div>
        )}
        <div className="flex items-center gap-2" aria-hidden>
          <span className="h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--text-soft)] text-xs" title="Notifications" />
          <span className="h-9 w-9 rounded-md bg-[var(--muted)] flex items-center justify-center text-[var(--text-soft)] text-xs" title="Apps" />
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {user.fullName && (
              <span className="text-sm text-[var(--text-soft)] hidden sm:inline truncate max-w-[140px]" title="Signed in user">
                {user.fullName}
              </span>
            )}
            <span className="h-9 w-9 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-sm font-medium shrink-0" title={user.fullName ?? undefined}>
              {(user.fullName ?? "U").slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
