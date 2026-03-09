"use client";

import * as React from "react";
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
import { ReconStatusCard } from "./components/ReconStatusCard";
import { ActivityCard } from "./components/ActivityCard";
import { VehicleDetailQuickActionsCard } from "./components/VehicleDetailQuickActionsCard";
import { VehicleIntelligenceCard } from "./components/VehicleIntelligenceCard";
import { VehicleValuationCard } from "./components/VehicleValuationCard";
import { VehiclePricingAutomationCard } from "./components/VehiclePricingAutomationCard";
import { VehicleMarketingDistributionCard } from "./components/VehicleMarketingDistributionCard";
import type { VehicleDetailTabId } from "./components/VehicleDetailTabs";
import { CostsTabContent } from "./components/CostsTabContent";

export type VehicleDetailContentProps = {
  vehicle: VehicleDetailResponse;
  photoUrls: Record<string, string>;
  vehicleId: string;
  activeTab: VehicleDetailTabId;
  canWrite?: boolean;
  signalRailTop?: React.ReactNode;
  signalTimeline?: React.ReactNode;
};

/**
 * Vehicle detail body (no header, no tabs — those live in VehiclePageHeader).
 * Renders Overview (costs) or Details card stack based on activeTab.
 */
export function VehicleDetailContent({
  vehicle,
  photoUrls,
  vehicleId,
  activeTab,
  canWrite = false,
  signalRailTop,
  signalTimeline,
}: VehicleDetailContentProps) {
  const isCostsTab = activeTab === "costs";

  if (isCostsTab) {
    return <CostsTabContent vehicleId={vehicleId} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-3 min-w-0">
        {/* Row 1: Overview + Pricing */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehicleOverviewCard vehicle={vehicle} photoUrls={photoUrls} />
          <VehiclePricingCard vehicle={vehicle} />
        </div>

        {/* Row 2: Market & Intelligence */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehicleIntelligenceCard intelligence={vehicle.intelligence} />
          <VehicleValuationCard vehicleId={vehicleId} />
        </div>

        {/* Row 3: Pricing automation + Marketing */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehiclePricingAutomationCard
            vehicleId={vehicleId}
            currentPriceCents={getSalePriceCents(vehicle) ?? "0"}
          />
          <VehicleMarketingDistributionCard vehicleId={vehicleId} />
        </div>

        {/* Row 4: Details + Specs */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehicleDetailsCard vehicle={vehicle} />
          <VehicleSpecsVinCard vehicleId={vehicleId} vin={vehicle.vin} />
        </div>

        {/* Row 5: Valuations + Recon + Floorplan */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <VehicleValuationsCard vehicleId={vehicleId} />
          <VehicleReconCard
            vehicleId={vehicleId}
            vehicleReconCostCents={getReconCostCents(vehicle)}
          />
          <VehicleFloorplanCard vehicleId={vehicleId} />
        </div>
      </div>

      <aside className="flex flex-col gap-3 min-w-0" role="complementary">
        {signalRailTop}
        <ReconStatusCard vehicle={vehicle} />
        <ActivityCard vehicle={vehicle} />
        <VehicleDetailQuickActionsCard vehicleId={vehicleId} canWrite={canWrite} />
        {signalTimeline}
      </aside>
    </div>
  );
}
