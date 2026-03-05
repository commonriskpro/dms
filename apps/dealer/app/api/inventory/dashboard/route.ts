/**
 * Optional GET /api/inventory/dashboard — returns KPIs, aging, alerts (as AlertRow[]), pipeline, team activity.
 * Primary use: server component loads via services (Promise.all); this route allows client refresh.
 */
import { NextRequest } from "next/server";
import * as dashboardService from "@/modules/inventory/service/dashboard";
import * as dealPipelineService from "@/modules/deals/service/deal-pipeline";
import * as teamActivityService from "@/modules/customers/service/team-activity";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import type { AlertRow } from "@/modules/inventory/ui/components/InventoryAlertsCard";

export const dynamic = "force-dynamic";

function toAlertRows(counts: { missingPhotos: number; stale: number; reconOverdue: number }): AlertRow[] {
  return [
    { id: "missing-photos", label: "Missing Photos", count: counts.missingPhotos, href: "/inventory?alertType=MISSING_PHOTOS" },
    { id: "units-90", label: "Units > 90 days", count: counts.stale, href: "/inventory?alertType=STALE" },
    { id: "units-recon", label: "Units Need Recon", count: counts.reconOverdue, href: "/inventory?alertType=RECON_OVERDUE" },
  ];
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const [initialKpis, initialAging, alertsCounts, initialPipeline, initialTeam] =
      await Promise.all([
        dashboardService.getKpis(ctx.dealershipId),
        dashboardService.getAgingBuckets(ctx.dealershipId),
        dashboardService.getAlertCounts(ctx.dealershipId, ctx.userId),
        dealPipelineService.getDealPipeline(ctx.dealershipId),
        teamActivityService.getTeamActivityToday(ctx.dealershipId),
      ]);
    const initialAlerts = toAlertRows(alertsCounts);
    return jsonResponse({
      data: {
        initialKpis,
        initialAging,
        initialAlerts,
        initialPipeline,
        initialTeam,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
