"use client";

import * as React from "react";
import { DMSCard } from "@/components/ui/dms-card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  Car,
  AlertTriangle,
  CircleAlert,
  CheckCircle,
  ChevronDown,
  Check,
} from "@/lib/ui/icons";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { VehicleDetailResponse } from "../types";
import {
  VEHICLE_STATUS_OPTIONS,
  getSalePriceCents,
  getTotalInvestedCents,
} from "../types";

function statusToVariant(status: string): StatusBadgeVariant {
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

type Signal = {
  severity: "warning" | "danger" | "success";
  title: string;
  detail: string;
};

function deriveSignals(
  vehicle: VehicleDetailResponse,
  canValuate: boolean
): Signal[] {
  const signals: Signal[] = [];
  const salePrice = getSalePriceCents(vehicle);
  if (!salePrice || salePrice === "0") {
    signals.push({ severity: "warning", title: "Set sale price.", detail: "" });
  }
  if (!canValuate) {
    signals.push({
      severity: "danger",
      title: "Insufficient permission.",
      detail: "Valuation requires permission.",
    });
  }
  const isAvailable = vehicle.status === "AVAILABLE";
  if (isAvailable) {
    signals.push({
      severity: "success",
      title: "Ready for sale.",
      detail: "Recon completed.",
    });
  } else {
    const hasPhotos = (vehicle.photos?.length ?? 0) > 0;
    if (!hasPhotos) {
      signals.push({
        severity: "warning",
        title: "Not ready.",
        detail: "Missing photos.",
      });
    }
  }
  return signals;
}

const SEVERITY_ICON = {
  warning: AlertTriangle,
  danger: CircleAlert,
  success: CheckCircle,
} as const;

export type VehicleDetailHeroProps = {
  vehicle: VehicleDetailResponse;
  photoUrls: Record<string, string>;
  canValuate?: boolean;
  className?: string;
};

export function VehicleDetailHero({
  vehicle,
  photoUrls,
  canValuate = false,
  className,
}: VehicleDetailHeroProps) {
  const photos = vehicle.photos ?? [];
  const [photoIdx, setPhotoIdx] = React.useState(0);
  const urls = photos.map((p) => photoUrls[p.id]).filter(Boolean);
  const hasPhotos = urls.length > 0;

  const vehicleTitle =
    [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
      .filter(Boolean)
      .join(" ") || vehicle.stockNumber;

  const salePrice = getSalePriceCents(vehicle);
  const totalInvested = getTotalInvestedCents(vehicle);
  const signals = deriveSignals(vehicle, canValuate);

  return (
    <DMSCard className={cn("overflow-hidden", className)}>
      <div className="flex flex-col lg:flex-row">
        {/* Photo carousel */}
        <div className="relative w-full lg:w-64 shrink-0 bg-[var(--surface-2)] lg:border-r border-b lg:border-b-0 border-[var(--border)]">
          <div className="aspect-[4/3] w-full">
            {hasPhotos ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed vehicle photo URLs */}
                <img
                  src={urls[photoIdx] ?? urls[0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {urls.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() =>
                        setPhotoIdx((i) =>
                          i === 0 ? urls.length - 1 : i - 1
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)] hover:bg-[var(--surface-2)] text-xs"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() =>
                        setPhotoIdx((i) =>
                          i === urls.length - 1 ? 0 : i + 1
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)] hover:bg-[var(--surface-2)] text-xs"
                    >
                      ›
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-soft)] text-sm">
                No photos
              </div>
            )}
          </div>
          {/* Photo indicator */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-center gap-2 bg-[var(--surface)]/90 backdrop-blur rounded-[var(--radius-input)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">
              <Check className="h-3.5 w-3.5 text-[var(--success)]" />
              <span className="flex-1 truncate">
                {hasPhotos ? `${photoIdx + 1} of ${urls.length}` : "back"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-soft)]" />
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0 p-4">
          {/* Title row */}
          <div className="flex items-start gap-3 mb-4">
            <Car className="h-6 w-6 text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--text)] leading-tight">
                {vehicleTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                {vehicle.vin && (
                  <span className="text-sm text-[var(--muted-text)]">
                    VIN: {vehicle.vin}
                  </span>
                )}
                <StatusBadge variant={statusToVariant(vehicle.status)}>
                  {VEHICLE_STATUS_OPTIONS.find(
                    (o) => o.value === vehicle.status
                  )?.label ?? vehicle.status}
                </StatusBadge>
                {signals.map((sig, i) => {
                  const Icon = SEVERITY_ICON[sig.severity];
                  return (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        sig.severity === "success" && "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
                        sig.severity === "warning" && "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
                        sig.severity === "danger" && "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]"
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      {sig.title}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Info panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-[var(--border)] rounded-[var(--radius-input)] overflow-hidden">
            {/* Vehicle Overview */}
            <div className="p-3 md:border-r border-b md:border-b-0 border-[var(--border)] bg-[var(--surface-2)]/30">
              <p className="text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider mb-2">
                Vehicle Overview
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Stock #</dt>
                  <dd className="text-[var(--text)] font-medium">
                    {vehicle.stockNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">VIN</dt>
                  <dd className="text-[var(--text)] font-mono text-xs truncate max-w-[140px]">
                    {vehicle.vin ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Year, Make</dt>
                  <dd className="text-[var(--text)]">
                    {[vehicle.year, vehicle.make].filter(Boolean).join("  ") ||
                      "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Trim</dt>
                  <dd className="text-[var(--text)]">
                    {vehicle.trim ?? "—"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Pricing & Profit */}
            <div className="p-3 md:border-r border-b md:border-b-0 border-[var(--border)] bg-[var(--surface-2)]/30">
              <p className="text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider mb-2">
                Pricing &amp; Profit
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Sale Price</dt>
                  <dd className="text-[var(--text)] font-medium">
                    {salePrice ? formatCents(salePrice) : "$0.00"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Total Invested</dt>
                  <dd className="text-[var(--text)]">
                    {totalInvested ? formatCents(totalInvested) : "$0.00"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-soft)]">Floorplan</dt>
                  <dd className="text-[var(--text)]">—</dd>
                </div>
              </dl>
            </div>

          </div>
        </div>
      </div>
    </DMSCard>
  );
}
