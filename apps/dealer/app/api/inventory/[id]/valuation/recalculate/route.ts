import { NextRequest } from "next/server";
import * as valuationService from "@/modules/inventory/service/valuation-engine";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.pricing.write");
    const { id } = await params;
    const row = await valuationService.recalculateVehicleValuation(ctx.dealershipId, id);
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
    }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
