import { NextRequest } from "next/server";
import * as valuationService from "@/modules/inventory/service/valuation-engine";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = await params;
    const row = await valuationService.getVehicleValuation(ctx.dealershipId, id);
    if (!row) return jsonResponse({ data: null });
    return jsonResponse({
      data: {
        id: row.id,
        vehicleId: row.vehicleId,
        marketAverageCents: row.marketAverageCents,
        marketLowestCents: row.marketLowestCents,
        marketHighestCents: row.marketHighestCents,
        recommendedRetailCents: row.recommendedRetailCents,
        recommendedWholesaleCents: row.recommendedWholesaleCents,
        priceToMarketPercent: row.priceToMarketPercent,
        marketDaysSupply: row.marketDaysSupply,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
