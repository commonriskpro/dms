"use client";

import { InventoryQuickActionsCard } from "./InventoryQuickActionsCard";
import { InventoryAlertsCard } from "./InventoryAlertsCard";
import type { AlertRow } from "./InventoryAlertsCard";
import { cardStack } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";

export type InventoryRightRailProps = {
  canWrite?: boolean;
  alerts?: AlertRow[];
  className?: string;
};

export function InventoryRightRail({
  canWrite = false,
  alerts,
  className,
}: InventoryRightRailProps) {
  return (
    <aside
      className={cn(cardStack, "w-full min-w-0", className)}
      role="complementary"
      aria-label="Quick actions and alerts"
    >
      <InventoryQuickActionsCard canWrite={canWrite} />
      <InventoryAlertsCard alerts={alerts} />
    </aside>
  );
}
