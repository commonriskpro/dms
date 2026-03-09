import { NextRequest } from "next/server";
import { z } from "zod";
import * as pricingService from "@/modules/inventory/service/pricing";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import {
  toVehicleResponse,
  mergeVehicleWithLedgerTotals,
  type VehicleResponseInput,
} from "@/modules/inventory/api-response";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
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
    await guardPermission(ctx, "inventory.pricing.write");
    const { id } = idParamSchema.parse(await params);
    const meta = getRequestMeta(request);
    const { vehicle, preview } = await pricingService.applyVehiclePriceAdjustment(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    let vehicleResponse: Record<string, unknown> | null = null;
    if (vehicle != null) {
      const totals = await costLedger.getCostTotals(ctx.dealershipId, vehicle.id);
      vehicleResponse = toVehicleResponse(
        mergeVehicleWithLedgerTotals(vehicle as VehicleResponseInput, totals)
      );
    }
    return jsonResponse({
      data: {
        vehicle: vehicleResponse,
        preview: {
          vehicleId: preview.vehicleId,
          currentPriceCents: preview.currentPriceCents,
          suggestedPriceCents: preview.suggestedPriceCents,
          steps: preview.steps,
        },
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
