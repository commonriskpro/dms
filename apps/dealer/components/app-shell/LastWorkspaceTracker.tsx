"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { workspaceKeyForPath, setLastWorkspace } from "@/lib/last-workspace";

/**
 * Tracks the current pathname and persists the last workspace when the user
 * is on a top-level workspace. Runs inside AppShell (authenticated app only).
 * No UI; only updates localStorage for landing logic on "/".
 */
export function LastWorkspaceTracker() {
  const pathname = usePathname();
  const { state, activeDealership } = useSession();

  React.useEffect(() => {
    if (state.status !== "authenticated" || !activeDealership?.id) return;
    const key = workspaceKeyForPath(pathname ?? null);
    if (key) setLastWorkspace(activeDealership.id, key);
  }, [pathname, state.status, activeDealership?.id]);

  return null;
}
