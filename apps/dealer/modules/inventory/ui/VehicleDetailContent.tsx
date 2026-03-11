"use client";

import * as React from "react";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { formatCents } from "@/lib/money";
import type { VehicleDetailResponse } from "./types";
import { getProjectedGrossCents, getSalePriceCents, getTotalInvestedCents } from "./types";
import { MarketPricingCard } from "./components/MarketPricingCard";
import { VehicleDetailsCard } from "./components/VehicleDetailsCard";
import { VehicleSpecsVinCard } from "./components/VehicleSpecsVinCard";
import { ReconReadinessCard } from "./components/ReconReadinessCard";
import { ActivityCard } from "./components/ActivityCard";
import { VehicleDetailQuickActionsCard } from "./components/VehicleDetailQuickActionsCard";
import { ReadinessChecklistCard } from "./components/ReadinessChecklistCard";
import { VehiclePricingCard } from "./components/VehiclePricingCard";
import type { VehicleDetailTabId } from "./components/VehicleDetailTabs";
import { CostsTabContent } from "./components/CostsTabContent";
import { MediaTabContent } from "./components/MediaTabContent";

export type VehicleDetailContentProps = {
  vehicle: VehicleDetailResponse;
  photoUrls: Record<string, string>;
  vehicleId: string;
  activeTab: VehicleDetailTabId;
  canWrite?: boolean;
  onPhotosChange?: () => void;
  signalRailTop?: React.ReactNode;
  signalTimeline?: React.ReactNode;
};

function parseCents(value: string): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function computeDaysInStock(vehicle: VehicleDetailResponse): number {
  const days = vehicle.intelligence?.daysToTurn?.daysInStock;
  if (typeof days === "number" && Number.isFinite(days)) return days;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(vehicle.createdAt).getTime()) / 86_400_000)
  );
}

function buildReadinessSummary(vehicle: VehicleDetailResponse) {
  const photos = vehicle.photos?.length ?? 0;
  const salePrice = getSalePriceCents(vehicle);
  const isPriced = salePrice !== "" && salePrice !== "0";
  const isAvailable = vehicle.status === "AVAILABLE";
  const blockers = [photos === 0, !isPriced, !isAvailable].filter(Boolean).length;
  const readinessScore = Math.max(0, 100 - blockers * 34);
  const readinessLabel =
    blockers === 0 ? "Retail-ready" : blockers === 1 ? "1 blocker" : `${blockers} blockers`;

  return {
    photos,
    blockers,
    readinessScore,
    readinessLabel,
    priced: isPriced,
    available: isAvailable,
  };
}

export function VehicleDetailContent({
  vehicle,
  photoUrls: _photoUrls,
  vehicleId,
  activeTab,
  canWrite = false,
  onPhotosChange,
  signalRailTop,
  signalTimeline,
}: VehicleDetailContentProps) {
  if (activeTab === "costs") {
    return <CostsTabContent vehicleId={vehicleId} mode="embedded" />;
  }
  if (activeTab === "media") {
    return <MediaTabContent vehicleId={vehicleId} onPhotosChange={onPhotosChange} />;
  }

  const salePriceCents = parseCents(getSalePriceCents(vehicle));
  const totalInvestedCents = parseCents(getTotalInvestedCents(vehicle));
  const projectedGrossCents = parseCents(getProjectedGrossCents(vehicle));
  const daysInStock = computeDaysInStock(vehicle);
  const readiness = buildReadinessSummary(vehicle);
  const marketStatus = vehicle.intelligence?.priceToMarket?.marketStatus ?? "No market data";
  const agingBucket = vehicle.intelligence?.daysToTurn?.agingBucket ?? "<30 days";

  return (
    <div className="space-y-4 min-[1800px]:space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7">
        <KpiCard
          label="Sale Price"
          value={salePriceCents > 0 ? formatCents(String(salePriceCents)) : "$0"}
          sub={readiness.priced ? "price set" : "set pricing"}
          color="blue"
          hasUpdate={salePriceCents > 0}
          trend={[salePriceCents || 1, salePriceCents || 1]}
        />
        <KpiCard
          label="Total Invested"
          value={totalInvestedCents > 0 ? formatCents(String(totalInvestedCents)) : "$0"}
          sub="ledger-derived total"
          color="default"
          trend={[totalInvestedCents || 1, totalInvestedCents || 1]}
        />
        <KpiCard
          label="Projected Gross"
          value={formatCents(String(projectedGrossCents))}
          sub={projectedGrossCents >= 0 ? "frontline margin" : "underwater"}
          color={projectedGrossCents >= 0 ? "green" : "amber"}
          accentValue={projectedGrossCents < 0}
          hasUpdate={projectedGrossCents !== 0}
          trend={[Math.max(projectedGrossCents, 1), Math.max(projectedGrossCents, 1)]}
        />
        <KpiCard
          label="Days In Stock"
          value={daysInStock}
          sub={agingBucket}
          color={daysInStock > 90 ? "amber" : "cyan"}
          accentValue={daysInStock > 90}
          hasUpdate={daysInStock > 30}
          trend={[daysInStock || 1, daysInStock || 1]}
        />
        <KpiCard
          label="Readiness"
          value={`${readiness.readinessScore}%`}
          sub={readiness.readinessLabel}
          color={readiness.blockers === 0 ? "green" : readiness.blockers === 1 ? "amber" : "violet"}
          accentValue={readiness.blockers > 1}
          hasUpdate={readiness.blockers > 0}
          trend={[Math.max(readiness.readinessScore, 1), Math.max(readiness.readinessScore, 1)]}
        />
        <KpiCard
          label="Photos"
          value={readiness.photos}
          sub={readiness.photos > 0 ? "assets uploaded" : "media missing"}
          color={readiness.photos > 0 ? "cyan" : "amber"}
          hasUpdate={readiness.photos > 0}
          trend={[Math.max(readiness.photos, 1), Math.max(readiness.photos, 1)]}
          className="min-[1800px]:block hidden"
        />
        <KpiCard
          label="Market"
          value={marketStatus}
          sub="price-to-market"
          color="violet"
          trend={[1, 1]}
          className="min-[2200px]:block hidden"
        />
      </div>

      <div className="grid gap-4 min-[1800px]:gap-5 lg:grid-cols-[minmax(0,1.82fr)_minmax(300px,0.7fr)] min-[1800px]:grid-cols-[minmax(0,1.95fr)_minmax(320px,0.68fr)] min-[2200px]:grid-cols-[minmax(0,2.1fr)_minmax(360px,0.72fr)]">
        <div className="space-y-4 min-[1800px]:space-y-5">
          <Widget
            title="Vehicle command center"
            subtitle="Keep readiness, pricing, and market position visible before you drop into detail cards and workflow tabs."
            compact
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Readiness</p>
                <p className="mt-2 text-[30px] font-semibold leading-none text-[var(--text)]">{readiness.readinessScore}%</p>
                <p className="mt-2 text-sm text-[var(--muted-text)]">{readiness.blockers === 0 ? "No active blockers." : `${readiness.blockers} blockers across pricing, photos, and sale readiness.`}</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Margin posture</p>
                <p className="mt-2 text-[30px] font-semibold leading-none text-[var(--text)]">{formatCents(String(projectedGrossCents))}</p>
                <p className="mt-2 text-sm text-[var(--muted-text)]">Projected spread between current retail and total invested.</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Aging risk</p>
                <p className="mt-2 text-[30px] font-semibold leading-none text-[var(--text)]">{daysInStock}</p>
                <p className="mt-2 text-sm text-[var(--muted-text)]">Current lot age bucket: {agingBucket}.</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Market stance</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{marketStatus}</p>
                <p className="mt-2 text-sm text-[var(--muted-text)]">Latest market guidance from valuation intelligence.</p>
              </div>
            </div>
          </Widget>

          <div className="grid gap-4 md:grid-cols-2 min-[1800px]:gap-5">
            <VehiclePricingCard vehicle={vehicle} />
            <MarketPricingCard vehicleId={vehicleId} intelligence={vehicle.intelligence} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 min-[1800px]:gap-5">
            <ReconReadinessCard vehicleId={vehicleId} vehicle={vehicle} />
            <ReadinessChecklistCard vehicle={vehicle} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 min-[1800px]:gap-5">
            <VehicleDetailsCard vehicle={vehicle} />
            <VehicleSpecsVinCard vehicleId={vehicleId} vin={vehicle.vin} />
          </div>
        </div>

        <aside className="space-y-3 min-[1800px]:space-y-4" role="complementary">
          <VehicleDetailQuickActionsCard vehicleId={vehicleId} canWrite={canWrite} />
          {signalRailTop}
          <ActivityCard vehicle={vehicle} />
          {signalTimeline}
        </aside>
      </div>
    </div>
  );
}
