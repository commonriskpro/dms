"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { WriteGuard } from "@/components/write-guard";
import { Pencil, Upload, Handshake, PlusCircle, Banknote } from "@/lib/ui/icons";
import { spacingTokens, typography } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { inventoryCostsPath, inventoryEditPath } from "@/lib/routes/detail-paths";

const actionBtnClass =
  "w-full justify-start gap-2.5 border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

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
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>
          Quick Actions
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={cn(spacingTokens.cardContentPad, "space-y-2")}>
        {canWrite && (
          <WriteGuard>
            <Link href={inventoryEditPath(vehicleId)} className="block">
              <Button variant="secondary" className={actionBtnClass}>
                <Pencil className="h-4 w-4 shrink-0" />
                Edit
              </Button>
            </Link>
            <Link href={inventoryEditPath(vehicleId)} className="block">
              <Button variant="secondary" className={actionBtnClass}>
                <Upload className="h-4 w-4 shrink-0" />
                Upload Photos
              </Button>
            </Link>
          </WriteGuard>
        )}
        <Link href={`/deals/new?vehicleId=${vehicleId}`} className="block">
          <Button variant="secondary" className={actionBtnClass}>
            <Handshake className="h-4 w-4 shrink-0" />
            Create Deal
          </Button>
        </Link>
        {canWrite && (
          <WriteGuard>
            <Link href={inventoryCostsPath(vehicleId)} className="block">
              <Button variant="secondary" className={actionBtnClass}>
                <PlusCircle className="h-4 w-4 shrink-0" />
                Add Cost
              </Button>
            </Link>
            <Link href={inventoryCostsPath(vehicleId)} className="block">
              <Button variant="secondary" className={actionBtnClass}>
                <Banknote className="h-4 w-4 shrink-0" />
                Add Floorplan
              </Button>
            </Link>
          </WriteGuard>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
