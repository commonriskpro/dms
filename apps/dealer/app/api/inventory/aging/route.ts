import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { agingQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = agingQuerySchema.parse(getQueryObject(request));
    const { data, total } = await inventoryService.getAgingReport(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    const out = data.map((row) => {
      const salePriceCents = String(row.salePriceCents);
      return {
        vehicleId: row.vehicleId,
        stockNumber: row.stockNumber,
        year: row.year,
        make: row.make,
        model: row.model,
        status: row.status,
        salePriceCents,
        /** @deprecated Use salePriceCents. Remove after UI Step 3. */
        listPriceCents: salePriceCents,
        createdAt: row.createdAt,
        daysInStock: row.daysInStock,
      };
    });
    return jsonResponse(listPayload(out, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
