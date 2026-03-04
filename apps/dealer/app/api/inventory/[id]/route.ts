import { NextRequest } from "next/server";
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
import { updateBodySchema, idParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const vehicle = await inventoryService.getVehicle(ctx.dealershipId, id);
    const photos = await inventoryService.listVehiclePhotos(ctx.dealershipId, id);
    return jsonResponse({
      data: {
        ...toVehicleResponse(vehicle),
        photos: photos.map((p) => ({
          id: p.id,
          filename: p.filename,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await request.json();
    const data = updateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await inventoryService.updateVehicle(
      ctx.dealershipId,
      ctx.userId,
      id,
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
    return jsonResponse({ data: toVehicleResponse(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    const deleted = await inventoryService.deleteVehicle(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    if (!deleted) {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
