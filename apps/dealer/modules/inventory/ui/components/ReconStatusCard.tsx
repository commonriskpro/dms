"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

const RECON_STEPS = [
  { key: "inspection", label: "Inspection" },
  { key: "detail", label: "Detail" },
  { key: "photos", label: "Photos" },
  { key: "ready", label: "Ready for sale" },
] as const;

export type ReconStatusCardProps = {
  vehicle: VehicleDetailResponse;
  className?: string;
};

/** Derives completion from vehicle state; no backend change. */
function getStepCompleted(
  vehicle: VehicleDetailResponse,
  key: (typeof RECON_STEPS)[number]["key"]
): boolean {
  switch (key) {
    case "photos":
      return (vehicle.photos?.length ?? 0) > 0;
    case "ready":
      return vehicle.status === "AVAILABLE";
    case "inspection":
    case "detail":
    default:
      return false;
  }
}

export function ReconStatusCard({ vehicle, className }: ReconStatusCardProps) {
  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Recon Status</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <ul className="space-y-2" role="list">
          {RECON_STEPS.map((step) => {
            const done = getStepCompleted(vehicle, step.key);
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-input)] border border-[var(--border)] p-3",
                  done ? "bg-[var(--success-muted)]/20 border-[var(--success-muted)]" : "bg-[var(--surface-2)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    done
                      ? "bg-[var(--success)] text-white"
                      : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-soft)]"
                  )}
                  aria-hidden
                >
                  {done ? "✓" : "—"}
                </span>
                <span className={cn("text-sm", done ? "text-[var(--text)]" : "text-[var(--text-soft)]")}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </DMSCardContent>
    </DMSCard>
  );
}
