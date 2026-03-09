import { NextRequest } from "next/server";
import * as pricingService from "@/modules/inventory/service/pricing";
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
    await guardPermission(ctx, "inventory.pricing.read");
    const { id } = await params;
    const preview = await pricingService.previewVehiclePriceAdjustment(ctx.dealershipId, id);
    return jsonResponse({
      data: {
        vehicleId: preview.vehicleId,
        currentPriceCents: preview.currentPriceCents,
        suggestedPriceCents: preview.suggestedPriceCents,
        steps: preview.steps,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
