import { NextRequest } from "next/server";
import { z } from "zod";
import * as pricingService from "@/modules/inventory/service/pricing";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { idParamSchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.pricing.read");
    const { id } = idParamSchema.parse(await params);
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
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
