"use client";

import { PriceToMarketCard } from "./PriceToMarketCard";
import { DaysToTurnCard } from "./DaysToTurnCard";
import { TurnPerformanceCard } from "./TurnPerformanceCard";
import { AlertCenterCard } from "./AlertCenterCard";
import type { PriceToMarketCardProps } from "./PriceToMarketCard";
import type { DaysToTurnCardProps } from "./DaysToTurnCard";
import type { TurnPerformanceCardProps } from "./TurnPerformanceCard";
import type { AlertCenterItem } from "./AlertCenterCard";
import { cn } from "@/lib/utils";

export type InventoryIntelligencePanelProps = {
  priceToMarket: PriceToMarketCardProps;
  daysToTurn: DaysToTurnCardProps;
  turnPerformance: TurnPerformanceCardProps;
  alertCenter: AlertCenterItem[];
};

export function InventoryIntelligencePanel({
  priceToMarket,
  daysToTurn,
  turnPerformance,
  alertCenter,
}: InventoryIntelligencePanelProps) {
  return (
    <section
      className="grid grid-cols-1 gap-[var(--space-grid)] lg:grid-cols-[1fr_320px] items-start"
      aria-labelledby="inventory-intelligence-heading"
    >
      <h2
        id="inventory-intelligence-heading"
        className="sr-only"
      >
        Inventory Intelligence
      </h2>
      <div className="grid grid-cols-1 gap-[var(--space-grid)] md:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[auto_auto_1fr]">
        <div className="grid grid-cols-1 gap-[var(--space-grid)] sm:grid-cols-2">
          <PriceToMarketCard {...priceToMarket} />
          <DaysToTurnCard {...daysToTurn} />
        </div>
        <TurnPerformanceCard {...turnPerformance} />
      </div>
      <div className="lg:sticky lg:top-4">
        <AlertCenterCard alerts={alertCenter} />
      </div>
    </section>
  );
}
