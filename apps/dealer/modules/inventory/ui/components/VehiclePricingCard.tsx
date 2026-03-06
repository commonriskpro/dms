"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { formatCents } from "@/lib/money";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { getSalePriceCents, getAuctionCostCents } from "../types";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

/** Floor plan: not in API; show placeholder. Profit = sale - cost (simplified). */
function getFloorPlanCents(_v: VehicleDetailResponse): string {
  return "";
}

function getProfitCents(v: VehicleDetailResponse): string {
  const sale = getSalePriceCents(v);
  const cost = getAuctionCostCents(v);
  if (sale === "" || cost === "") return "";
  const s = BigInt(sale);
  const c = BigInt(cost);
  return String(s - c);
}

export type VehiclePricingCardProps = {
  vehicle: VehicleDetailResponse;
  className?: string;
};

export function VehiclePricingCard({ vehicle, className }: VehiclePricingCardProps) {
  const salePrice = getSalePriceCents(vehicle);
  const cost = getAuctionCostCents(vehicle);
  const floorPlan = getFloorPlanCents(vehicle);
  const profit = getProfitCents(vehicle);

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
            <dt className={typography.muted}>Cost</dt>
            <dd className="text-[var(--text)]">
              {cost !== "" ? formatCents(cost) : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Floor Plan</dt>
            <dd className="text-[var(--text)]">
              {floorPlan !== "" ? formatCents(floorPlan) : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Profit</dt>
            <dd className="font-medium text-[var(--text)]">
              {profit !== "" ? formatCents(profit) : "—"}
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
