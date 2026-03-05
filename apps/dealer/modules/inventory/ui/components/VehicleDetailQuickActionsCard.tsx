"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { WriteGuard } from "@/components/write-guard";
import { cn } from "@/lib/utils";

export type VehicleDetailQuickActionsCardProps = {
  vehicleId: string;
  canWrite?: boolean;
  className?: string;
};

export function VehicleDetailQuickActionsCard({
  vehicleId,
  canWrite = false,
  className,
}: VehicleDetailQuickActionsCardProps) {
  return (
    <DMSCard className={cn("transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Quick Actions</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-2">
        {canWrite && (
          <WriteGuard>
            <Link href={`/inventory/${vehicleId}/edit`} className="block">
              <Button
                variant="secondary"
                className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                Edit
              </Button>
            </Link>
            <Link href={`/inventory/${vehicleId}/edit`} className="block">
              <Button
                variant="secondary"
                className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                Upload Photos
              </Button>
            </Link>
          </WriteGuard>
        )}
        <Link href={`/deals/new?vehicleId=${vehicleId}`} className="block">
          <Button className="w-full justify-center focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            Create Deal
          </Button>
        </Link>
      </DMSCardContent>
    </DMSCard>
  );
}
