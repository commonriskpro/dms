import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import { toVehicleResponse } from "@/modules/inventory/api-response";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { listQuerySchema, createBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await inventoryService.listVehicles(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        status: query.status,
        locationId: query.locationId,
        year: query.year,
        make: query.make,
        model: query.model,
        vin: query.vin,
        stockNumber: query.stockNumber,
        minPrice: query.minPrice != null ? BigInt(query.minPrice) : undefined,
        maxPrice: query.maxPrice != null ? BigInt(query.maxPrice) : undefined,
        search: query.search,
      },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse({
      data: data.map((row) => toVehicleResponse(row)),
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const body = await request.json();
    const data = createBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await inventoryService.createVehicle(
      ctx.dealershipId,
      ctx.userId,
      {
        vin: data.vin,
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim,
        stockNumber: data.stockNumber,
        mileage: data.mileage,
        color: data.color,
        status: data.status,
        salePriceCents: data.salePriceCents != null ? BigInt(data.salePriceCents) : undefined,
        auctionCostCents: data.auctionCostCents != null ? BigInt(data.auctionCostCents) : undefined,
        transportCostCents: data.transportCostCents != null ? BigInt(data.transportCostCents) : undefined,
        reconCostCents: data.reconCostCents != null ? BigInt(data.reconCostCents) : undefined,
        miscCostCents: data.miscCostCents != null ? BigInt(data.miscCostCents) : undefined,
        locationId: data.locationId,
      },
      meta
    );
    revalidatePath("/inventory");
    return jsonResponse({ data: toVehicleResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
