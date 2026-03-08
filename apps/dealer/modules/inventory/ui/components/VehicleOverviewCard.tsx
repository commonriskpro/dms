"use client";

import * as React from "react";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { ui, typography, spacingTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { VehicleDetailResponse } from "../types";
import { VEHICLE_STATUS_OPTIONS } from "../types";

function vehicleStatusToVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "HOLD":
    case "REPAIR":
      return "warning";
    case "SOLD":
      return "info";
    case "WHOLESALE":
      return "neutral";
    case "ARCHIVED":
      return "danger";
    default:
      return "neutral";
  }
}

export type VehicleOverviewCardProps = {
  vehicle: VehicleDetailResponse;
  photoUrls: Record<string, string>;
  className?: string;
};

export function VehicleOverviewCard({
  vehicle,
  photoUrls,
  className,
}: VehicleOverviewCardProps) {
  const photos = vehicle.photos ?? [];
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const urls = photos.map((p) => photoUrls[p.id]).filter(Boolean);
  const hasPhotos = urls.length > 0;

  return (
    <DMSCard className={cn("overflow-hidden", className)}>
      <div className="relative aspect-[16/10] w-full bg-[var(--surface-2)] border-b border-[var(--border)]">
        {hasPhotos ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed/remote vehicle photo URLs; next/image not used to avoid loader config for dynamic URLs */}
            <img
              src={urls[carouselIndex] ?? urls[0]}
              alt=""
              className="w-full h-full object-contain"
            />
            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => setCarouselIndex((i) => (i === 0 ? urls.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)] hover:bg-[var(--surface-2)]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => setCarouselIndex((i) => (i === urls.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)] hover:bg-[var(--surface-2)]"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {urls.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Photo ${i + 1}`}
                      onClick={() => setCarouselIndex(i)}
                      className={cn(
                        "w-2 h-2 rounded-full border border-[var(--border)]",
                        i === carouselIndex ? "bg-[var(--accent)]" : "bg-[var(--surface)]"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-soft)] text-sm">
            No photos
          </div>
        )}
      </div>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Overview</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className={typography.muted}>Stock #</dt>
            <dd className="font-medium text-[var(--text)]">{vehicle.stockNumber}</dd>
          </div>
          <div>
            <dt className={typography.muted}>VIN</dt>
            <dd className="font-mono text-sm text-[var(--text)]">{vehicle.vin ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Year</dt>
            <dd className="text-[var(--text)]">{vehicle.year ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Make</dt>
            <dd className="text-[var(--text)]">{vehicle.make ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Model</dt>
            <dd className="text-[var(--text)]">{vehicle.model ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Trim</dt>
            <dd className="text-[var(--text)]">{vehicle.trim ?? "—"}</dd>
          </div>
          <div>
            <dt className={typography.muted}>Mileage</dt>
            <dd className="text-[var(--text)]">
              {vehicle.mileage != null ? vehicle.mileage.toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className={typography.muted}>Status</dt>
            <dd>
              <StatusBadge variant={vehicleStatusToVariant(vehicle.status)}>
                {VEHICLE_STATUS_OPTIONS.find((o) => o.value === vehicle.status)?.label ?? vehicle.status}
              </StatusBadge>
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
