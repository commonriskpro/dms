import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as dashboard from "@/modules/inventory/service/dashboard";
import * as dealPipeline from "@/modules/deals/service/deal-pipeline";
import type { InventoryKpis, InventoryAgingBuckets } from "@/modules/inventory/service/dashboard";
import type { DealPipelineStages } from "@/modules/deals/service/deal-pipeline";
import { InventoryPage } from "@/modules/inventory/ui/InventoryPage";
import type { AlertRow } from "@/modules/inventory/ui/components/InventoryAlertsCard";

export const dynamic = "force-dynamic";

const DEFAULT_KPIS: InventoryKpis = {
  totalUnits: 0,
  delta7d: null,
  inReconUnits: 0,
  inReconPercent: 0,
  salePendingUnits: 0,
  salePendingValueCents: null,
  inventoryValueCents: 0,
  avgValueCents: 0,
};

const DEFAULT_AGING: InventoryAgingBuckets = {
  lt30: 0,
  d30to60: 0,
  d60to90: 0,
  gt90: 0,
};

const DEFAULT_ALERT_ROWS: AlertRow[] = [
  { id: "missing-photos", label: "Missing Photos", count: 0, href: "/inventory?alertType=MISSING_PHOTOS" },
  { id: "units-90", label: "Units > 90 days", count: 0, href: "/inventory?alertType=STALE" },
  { id: "units-recon", label: "Units Need Recon", count: 0, href: "/inventory?alertType=RECON_OVERDUE" },
];

const DEFAULT_PIPELINE: DealPipelineStages = {
  leads: 0,
  appointments: 0,
  workingDeals: 0,
  pendingFunding: 0,
  soldToday: 0,
};

function toAlertRows(counts: { missingPhotos: number; stale: number; reconOverdue: number }): AlertRow[] {
  return [
    { id: "missing-photos", label: "Missing Photos", count: counts.missingPhotos, href: "/inventory?alertType=MISSING_PHOTOS" },
    { id: "units-90", label: "Units > 90 days", count: counts.stale, href: "/inventory?alertType=STALE" },
    { id: "units-recon", label: "Units Need Recon", count: counts.reconOverdue, href: "/inventory?alertType=RECON_OVERDUE" },
  ];
}

export default async function InventoryRoute() {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const userId = session?.userId ?? null;
  const permissions = session?.permissions ?? [];
  const hasInventoryRead = permissions.includes("inventory.read");
  const hasPipeline = permissions.includes("crm.read") || permissions.includes("deals.read");

  const [
    kpisResult,
    agingResult,
    alertsResult,
    pipelineResult,
  ] = await Promise.all([
    hasInventoryRead && dealershipId
      ? dashboard.getKpis(dealershipId).catch(() => DEFAULT_KPIS)
      : Promise.resolve(DEFAULT_KPIS),
    hasInventoryRead && dealershipId
      ? dashboard.getAgingBuckets(dealershipId).catch(() => DEFAULT_AGING)
      : Promise.resolve(DEFAULT_AGING),
    hasInventoryRead && dealershipId && userId
      ? dashboard.getAlertCounts(dealershipId, userId, true).then(toAlertRows).catch(() => DEFAULT_ALERT_ROWS)
      : Promise.resolve(DEFAULT_ALERT_ROWS),
    hasPipeline && dealershipId
      ? dealPipeline.getDealPipeline(dealershipId).catch(() => DEFAULT_PIPELINE)
      : Promise.resolve(DEFAULT_PIPELINE),
  ]);

  return (
    <InventoryPage
      initialKpis={kpisResult}
      initialAging={agingResult}
      initialAlerts={alertsResult}
      initialPipeline={pipelineResult}
    />
  );
}
