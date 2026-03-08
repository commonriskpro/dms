"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { formatCents } from "@/lib/money";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { getSalePriceCents, getTotalInvestedCents, getProjectedGrossCents } from "../types";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

/** Floor plan: not in API; show placeholder. */
function getFloorPlanCents(_v: VehicleDetailResponse): string {
  return "";
}

export type VehiclePricingCardProps = {
  vehicle: VehicleDetailResponse;
  className?: string;
};

export function VehiclePricingCard({ vehicle, className }: VehiclePricingCardProps) {
  const salePrice = getSalePriceCents(vehicle);
  const totalInvested = getTotalInvestedCents(vehicle);
  const floorPlan = getFloorPlanCents(vehicle);
  const projectedGross = getProjectedGrossCents(vehicle);

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Pricing</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className={typography.muted}>Sale Price</dt>
            <dd className="font-medium text-[var(--text)]">
              {salePrice !== "" ? formatCents(salePrice) : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Total Invested</dt>
            <dd className="text-[var(--text)]">
              {totalInvested !== "" ? formatCents(totalInvested) : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Floor Plan</dt>
            <dd className="text-[var(--text)]">
              {floorPlan !== "" ? formatCents(floorPlan) : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Projected Gross</dt>
            <dd className="font-medium text-[var(--text)]">
              {projectedGross !== "" ? formatCents(projectedGross) : "—"}
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
