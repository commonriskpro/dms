import { NextRequest } from "next/server";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { idParamSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** GET cost returns ledger-derived totals only (single source of truth). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    await inventoryService.getVehicle(ctx.dealershipId, id);
    const totals = await costLedger.getCostTotals(ctx.dealershipId, id);
    const breakdown = costLedger.ledgerTotalsToCostBreakdown(totals);
    return jsonResponse({
      data: {
        vehicleId: id,
        auctionCostCents: breakdown.auctionCostCents.toString(),
        transportCostCents: breakdown.transportCostCents.toString(),
        reconCostCents: breakdown.reconCostCents.toString(),
        miscCostCents: breakdown.miscCostCents.toString(),
        totalCostCents: breakdown.totalCostCents.toString(),
        acquisitionSubtotalCents: totals.acquisitionSubtotalCents.toString(),
        reconSubtotalCents: totals.reconSubtotalCents.toString(),
        feesSubtotalCents: totals.feesSubtotalCents.toString(),
        totalInvestedCents: totals.totalInvestedCents.toString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
