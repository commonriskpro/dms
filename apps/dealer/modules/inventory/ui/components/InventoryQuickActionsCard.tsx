"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventoryQuickActionsCardProps = {
  canWrite?: boolean;
  className?: string;
};

export function InventoryQuickActionsCard({ canWrite = false, className }: InventoryQuickActionsCardProps) {
  return (
    <DMSCard className={cn("transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Quick Actions</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-2">
        {canWrite && (
          <Link href="/inventory/new" className="block">
            <Button
              className="w-full justify-center focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              variant="default"
            >
              + Add Vehicle
            </Button>
          </Link>
        )}
        <Link href="/crm/opportunities" className="block">
          <Button
            variant="secondary"
            className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            + Add Lead
          </Button>
        </Link>
        <Link href="/deals/new" className="block">
          <Button
            variant="secondary"
            className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Start Deal
          </Button>
        </Link>
      </DMSCardContent>
    </DMSCard>
  );
}
