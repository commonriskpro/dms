import { NextRequest } from "next/server";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { idParamSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const vehicle = await inventoryService.getVehicle(ctx.dealershipId, id);
    const breakdown = inventoryService.calculateVehicleCost(vehicle);
    return jsonResponse({
      data: {
        vehicleId: vehicle.id,
        auctionCostCents: breakdown.auctionCostCents.toString(),
        transportCostCents: breakdown.transportCostCents.toString(),
        reconCostCents: breakdown.reconCostCents.toString(),
        miscCostCents: breakdown.miscCostCents.toString(),
        totalCostCents: breakdown.totalCostCents.toString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
