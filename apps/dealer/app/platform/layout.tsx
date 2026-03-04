"use client";

import * as React from "react";
import { useSession } from "@/contexts/session-context";
import { AppShell } from "@/components/app-shell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { state, platformAdmin } = useSession();
  const isAdmin = platformAdmin?.isAdmin === true;

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (state.status !== "authenticated" || !isAdmin) {
    return (
      <AppShell>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to platform admin.</p>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
