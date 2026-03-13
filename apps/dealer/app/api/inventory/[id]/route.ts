import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import * as priceToMarket from "@/modules/inventory/service/price-to-market";
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
import { updateBodySchema, idParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { toBigIntOrUndefined } from "@/lib/bigint";

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
    const [totals, photos, ptm] = await Promise.all([
      costLedger.getCostTotals(ctx.dealershipId, id),
      inventoryService.listVehiclePhotos(ctx.dealershipId, id),
      priceToMarket.getPriceToMarketForVehicle(ctx.dealershipId, id, {
        make: vehicle.make,
        model: vehicle.model,
        salePriceCents: vehicle.salePriceCents,
      }),
    ]);
    const daysInStock = priceToMarket.computeDaysInStock(vehicle.createdAt);
    const daysToTurn = {
      daysInStock,
      agingBucket: priceToMarket.agingBucketFromDays(daysInStock),
      targetDays: priceToMarket.DAYS_TO_TURN_TARGET,
      turnRiskStatus: priceToMarket.turnRiskStatus(
        daysInStock,
        priceToMarket.DAYS_TO_TURN_TARGET
      ),
    };
    const vehicleForResponse = mergeVehicleWithLedgerTotals(vehicle as VehicleResponseInput, totals);
    return jsonResponse({
      data: {
        ...toVehicleResponse(vehicleForResponse),
        photos: photos.map((p) => ({
          id: p.id,
          fileObjectId: p.fileObjectId,
          filename: p.filename,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          sortOrder: p.sortOrder,
          isPrimary: p.isPrimary,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        })),
        intelligence: {
          priceToMarket: {
            marketStatus: ptm.marketStatus,
            marketDeltaCents: ptm.marketDeltaCents,
            marketDeltaPercent: ptm.marketDeltaPercent,
            sourceLabel: ptm.sourceLabel,
          },
          daysToTurn,
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await inventoryService.updateVehicle(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        isDraft: data.isDraft,
        vin: data.vin,
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim,
        stockNumber: data.stockNumber,
        mileage: data.mileage,
        color: data.color,
        status: data.status,
        salePriceCents: toBigIntOrUndefined(data.salePriceCents),
        auctionCostCents: toBigIntOrUndefined(data.auctionCostCents),
        transportCostCents: toBigIntOrUndefined(data.transportCostCents),
        reconCostCents: toBigIntOrUndefined(data.reconCostCents),
        miscCostCents: toBigIntOrUndefined(data.miscCostCents),
        locationId: data.locationId,
      },
      meta
    );
    const totals = await costLedger.getCostTotals(ctx.dealershipId, id);
    const vehicleForResponse = mergeVehicleWithLedgerTotals(updated as VehicleResponseInput, totals);
    return jsonResponse({ data: toVehicleResponse(vehicleForResponse) });
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
