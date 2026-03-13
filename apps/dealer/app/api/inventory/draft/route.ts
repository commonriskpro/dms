import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
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
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { toBigIntOrUndefined } from "@/lib/bigint";
import { draftCreateBodySchema } from "../schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const body = draftCreateBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const created = await inventoryService.createVehicleDraft(
      ctx.dealershipId,
      ctx.userId,
      {
        vin: body.vin,
        year: body.year,
        make: body.make,
        model: body.model,
        trim: body.trim,
        stockNumber: body.stockNumber,
        mileage: body.mileage,
        color: body.color,
        status: body.status,
        salePriceCents: toBigIntOrUndefined(body.salePriceCents),
        auctionCostCents: toBigIntOrUndefined(body.auctionCostCents),
        transportCostCents: toBigIntOrUndefined(body.transportCostCents),
        reconCostCents: toBigIntOrUndefined(body.reconCostCents),
        miscCostCents: toBigIntOrUndefined(body.miscCostCents),
        locationId: body.locationId,
      },
      meta
    );
    const totals = await costLedger.getCostTotals(ctx.dealershipId, created.id);
    const vehicleForResponse = mergeVehicleWithLedgerTotals(
      created as VehicleResponseInput,
      totals
    );
    return jsonResponse({ data: toVehicleResponse(vehicleForResponse) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
