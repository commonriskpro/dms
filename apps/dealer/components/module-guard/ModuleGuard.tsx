"use client";

import * as React from "react";
import { useSession } from "@/contexts/session-context";
import { canAccessModule } from "@/lib/entitlements-client";
import { ModuleNotIncludedPanel } from "@/components/ui-system/feedback/ModuleNotIncludedPanel";

/**
 * When entitlements are loaded and the module is not in plan, shows ModuleNotIncludedPanel.
 * When entitlements are absent (no platform), renders children (fail open).
 */
export function ModuleGuard({
  moduleKey,
  moduleName,
  children,
}: {
  moduleKey: string;
  /** Human-readable name for the "not included" message. */
  moduleName?: string;
  children: React.ReactNode;
}) {
  const { permissions, entitlements } = useSession();
  const allowed =
    !entitlements || canAccessModule(entitlements, permissions, moduleKey);

  if (allowed) return <>{children}</>;
  return <ModuleNotIncludedPanel moduleName={moduleName} />;
}
