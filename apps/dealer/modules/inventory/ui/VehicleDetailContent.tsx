"use client";

import { mainGrid, cardStack } from "@/lib/ui/recipes/layout";
import type { VehicleDetailResponse } from "./types";
import { getReconCostCents, getSalePriceCents } from "./types";
import { VehicleOverviewCard } from "./components/VehicleOverviewCard";
import { VehiclePricingCard } from "./components/VehiclePricingCard";
import { VehicleDetailsCard } from "./components/VehicleDetailsCard";
import { VehicleSpecsVinCard } from "./components/VehicleSpecsVinCard";
import { VehicleValuationsCard } from "./components/VehicleValuationsCard";
import { VehicleReconCard } from "./components/VehicleReconCard";
import { VehicleFloorplanCard } from "./components/VehicleFloorplanCard";
import { VehicleCostsAndDocumentsCard } from "./components/VehicleCostsAndDocumentsCard";
import { ReconStatusCard } from "./components/ReconStatusCard";
import { ActivityCard } from "./components/ActivityCard";
import { VehicleDetailQuickActionsCard } from "./components/VehicleDetailQuickActionsCard";
import { VehicleIntelligenceCard } from "./components/VehicleIntelligenceCard";
import { VehicleValuationCard } from "./components/VehicleValuationCard";
import { VehiclePricingAutomationCard } from "./components/VehiclePricingAutomationCard";
import { VehicleMarketingDistributionCard } from "./components/VehicleMarketingDistributionCard";

export type VehicleDetailContentMode = "page" | "modal";

export type VehicleDetailContentProps = {
  vehicle: VehicleDetailResponse;
  photoUrls: Record<string, string>;
  vehicleId: string;
  mode: VehicleDetailContentMode;
  canWrite?: boolean;
  signalRailTop?: React.ReactNode;
  signalTimeline?: React.ReactNode;
};

/**
 * Reusable vehicle detail layout: main grid (1fr + 280px), left card stack
 * (overview, pricing, details, specs/VIN, valuations, recon, floorplan),
 * right rail (recon status summary, activity, quick actions).
 */
export function VehicleDetailContent({
  vehicle,
  photoUrls,
  vehicleId,
  mode,
  canWrite = false,
  signalRailTop,
  signalTimeline,
}: VehicleDetailContentProps) {
  return (
    <div className={mainGrid}>
      <div className={cardStack}>
        <VehicleOverviewCard vehicle={vehicle} photoUrls={photoUrls} />
        <VehiclePricingCard vehicle={vehicle} />
        <VehicleIntelligenceCard intelligence={vehicle.intelligence} />
        <VehicleValuationCard vehicleId={vehicleId} />
        <VehiclePricingAutomationCard
          vehicleId={vehicleId}
          currentPriceCents={getSalePriceCents(vehicle) ?? "0"}
        />
        <VehicleMarketingDistributionCard vehicleId={vehicleId} />
        <VehicleDetailsCard vehicle={vehicle} />
        <VehicleSpecsVinCard vehicleId={vehicleId} vin={vehicle.vin} />
        <VehicleValuationsCard vehicleId={vehicleId} />
        <VehicleReconCard
          vehicleId={vehicleId}
          vehicleReconCostCents={getReconCostCents(vehicle)}
        />
        <VehicleCostsAndDocumentsCard vehicleId={vehicleId} />
        <VehicleFloorplanCard vehicleId={vehicleId} />
      </div>
      <aside className={`${cardStack} w-full min-w-0 lg:w-[280px]`} role="complementary">
        {signalRailTop}
        <ReconStatusCard vehicle={vehicle} />
        <ActivityCard vehicle={vehicle} />
        <VehicleDetailQuickActionsCard vehicleId={vehicleId} canWrite={canWrite} />
        {signalTimeline}
      </aside>
    </div>
  );
}
