"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { AlertTriangle, CheckCircle, CircleAlert } from "@/lib/ui/icons";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { VehicleDetailResponse } from "../types";
import { getSalePriceCents } from "../types";

type CheckItem = {
  label: string;
  severity: "success" | "warning" | "danger";
  detail: string;
};

function deriveChecklist(vehicle: VehicleDetailResponse): CheckItem[] {
  const hasPhotos = (vehicle.photos?.length ?? 0) > 0;
  const salePrice = getSalePriceCents(vehicle);
  const hasSalePrice = !!salePrice && salePrice !== "0";
  const isReady = vehicle.status === "AVAILABLE";

  return [
    {
      label: "Photos",
      severity: hasPhotos ? "success" : "danger",
      detail: hasPhotos ? `${vehicle.photos!.length} uploaded` : "No photos",
    },
    {
      label: "Pricing",
      severity: hasSalePrice ? "success" : "warning",
      detail: hasSalePrice ? "Price set" : "Set sale price",
    },
    {
      label: "Recon",
      severity: isReady ? "success" : "warning",
      detail: isReady ? "Ready" : "Pending",
    },
  ];
}

const SEVERITY_ICON = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: CircleAlert,
} as const;

const SEVERITY_DOT = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
} as const;

export type ReadinessChecklistCardProps = {
  vehicle: VehicleDetailResponse;
  className?: string;
};

export function ReadinessChecklistCard({
  vehicle,
  className,
}: ReadinessChecklistCardProps) {
  const items = deriveChecklist(vehicle);

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>
          Readiness Checklist
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <ul className="space-y-2" role="list">
          {items.map((item) => {
            const Icon = SEVERITY_ICON[item.severity];
            return (
              <li
                key={item.label}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      SEVERITY_DOT[item.severity]
                    )}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-[var(--text)]">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.severity !== "success" && (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        item.severity === "warning"
                          ? "text-[var(--warning)]"
                          : "text-[var(--danger)]"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      item.severity === "success"
                        ? "text-[var(--text)]"
                        : "text-[var(--text-soft)]"
                    )}
                  >
                    {item.severity === "success" && (
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5 text-[var(--success)] inline" />
                        {item.detail}
                      </span>
                    )}
                    {item.severity !== "success" && item.detail}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </DMSCardContent>
    </DMSCard>
  );
}
