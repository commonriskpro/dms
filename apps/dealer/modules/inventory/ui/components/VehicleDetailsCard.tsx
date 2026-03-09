"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { ScanLine } from "@/lib/ui/icons";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

type VehicleWithSpecs = VehicleDetailResponse & {
  transmission?: string | null;
  drivetrain?: string | null;
  engine?: string | null;
  fuelType?: string | null;
  msrp?: string | null;
};

function spec(v: VehicleWithSpecs, key: keyof VehicleWithSpecs): string {
  const val = v[key];
  if (val == null || val === "") return "—";
  return String(val);
}

export type VehicleDetailsCardProps = {
  vehicle: VehicleWithSpecs;
  onDecode?: () => void;
  className?: string;
};

export function VehicleDetailsCard({
  vehicle,
  onDecode,
  className,
}: VehicleDetailsCardProps) {
  const hasPhotos = (vehicle.photos?.length ?? 0) > 0;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DMSCardTitle className={typography.cardTitle}>
            Vehicle Specs
          </DMSCardTitle>
          {onDecode && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDecode}
              className="gap-1.5"
            >
              <ScanLine className="h-3.5 w-3.5" />
              Decode
            </Button>
          )}
        </div>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className={typography.muted}>Powertrain</dt>
            <dd className="text-[var(--text)]">
              {spec(vehicle, "drivetrain")}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Transmission</dt>
            <dd className="text-[var(--text)]">
              {spec(vehicle, "transmission")}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Engine</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "engine")}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Fuel Type</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "fuelType")}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Color</dt>
            <dd className="text-[var(--text)]">{vehicle.color ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>MSRP</dt>
            <dd className="text-[var(--text)]">{spec(vehicle, "msrp")}</dd>
          </div>
        </dl>
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-soft)]">
            {hasPhotos
              ? `${vehicle.photos!.length} Photos`
              : "No Photos"}
          </p>
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
