"use client";

import * as React from "react";
import type { VehicleDetailResponse } from "./types";
import { VehicleDetailHero } from "./components/VehicleDetailHero";
import { MarketPricingCard } from "./components/MarketPricingCard";
import { VehicleDetailsCard } from "./components/VehicleDetailsCard";
import { VehicleSpecsVinCard } from "./components/VehicleSpecsVinCard";
import { ReconReadinessCard } from "./components/ReconReadinessCard";
import { ActivityCard } from "./components/ActivityCard";
import { VehicleDetailQuickActionsCard } from "./components/VehicleDetailQuickActionsCard";
import { ReadinessChecklistCard } from "./components/ReadinessChecklistCard";
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
  onPhotosChange,
  signalRailTop,
  signalTimeline,
}: VehicleDetailContentProps) {
  if (activeTab === "costs") {
    return <CostsTabContent vehicleId={vehicleId} />;
  }
  if (activeTab === "media") {
    return <MediaTabContent vehicleId={vehicleId} onPhotosChange={onPhotosChange} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
      {/* Main column */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Hero banner */}
        <VehicleDetailHero
          vehicle={vehicle}
          photoUrls={photoUrls}
        />

        {/* Row 1: Market & Pricing + Vehicle Specs (VIN) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MarketPricingCard
            vehicleId={vehicleId}
            intelligence={vehicle.intelligence}
          />
          <VehicleSpecsVinCard vehicleId={vehicleId} vin={vehicle.vin} />
        </div>

        {/* Row 2: Vehicle Specs (details) + Recon & Readiness */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehicleDetailsCard vehicle={vehicle} />
          <ReconReadinessCard vehicleId={vehicleId} vehicle={vehicle} />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex flex-col gap-3 min-w-0" role="complementary">
        <VehicleDetailQuickActionsCard
          vehicleId={vehicleId}
          canWrite={canWrite}
        />
        <ActivityCard vehicle={vehicle} />
        {signalTimeline}
        <ReadinessChecklistCard vehicle={vehicle} />
      </aside>
    </div>
  );
}
