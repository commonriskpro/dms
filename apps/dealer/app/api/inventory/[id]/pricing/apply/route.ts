import { NextRequest } from "next/server";
import * as pricingService from "@/modules/inventory/service/pricing";
import { toVehicleResponse } from "@/modules/inventory/api-response";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
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
    const meta = getRequestMeta(request);
    const { vehicle, preview } = await pricingService.applyVehiclePriceAdjustment(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    return jsonResponse({
      data: {
        vehicle: vehicle ? toVehicleResponse(vehicle) : null,
        preview: {
          vehicleId: preview.vehicleId,
          currentPriceCents: preview.currentPriceCents,
          suggestedPriceCents: preview.suggestedPriceCents,
          steps: preview.steps,
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
