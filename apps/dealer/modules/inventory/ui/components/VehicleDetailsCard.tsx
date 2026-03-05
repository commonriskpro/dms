"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

/** Extended vehicle shape for optional specs not yet in API. */
type VehicleWithSpecs = VehicleDetailResponse & {
  transmission?: string | null;
  drivetrain?: string | null;
  engine?: string | null;
  fuelType?: string | null;
};

function spec(v: VehicleWithSpecs, key: keyof VehicleWithSpecs): string {
  const val = v[key];
  if (val == null || val === "") return "—";
  return String(val);
}

export type VehicleDetailsCardProps = {
  vehicle: VehicleWithSpecs;
  className?: string;
};

export function VehicleDetailsCard({ vehicle, className }: VehicleDetailsCardProps) {
  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Details</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className={typography.muted}>Transmission</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "transmission")}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Drivetrain</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "drivetrain")}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Color</dt>
            <dd className="text-[var(--text)]">{vehicle.color ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Engine</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "engine")}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Fuel Type</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "fuelType")}</dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
