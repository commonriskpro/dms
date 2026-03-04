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
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4">
      <Link href="/" className="text-lg font-semibold text-[var(--text)]">
        DMS
      </Link>
      <div className="flex flex-1 items-center justify-center px-4">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-4">
        {activeDealership && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-soft)]" title="Active dealership">
              {activeDealership.name}
            </span>
            {lifecycleStatus && <LifecycleBadge status={lifecycleStatus} />}
          </div>
        )}
        {user && (
          <span className="text-sm text-[var(--text-soft)]">
            {user.fullName ?? user.email}
          </span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
