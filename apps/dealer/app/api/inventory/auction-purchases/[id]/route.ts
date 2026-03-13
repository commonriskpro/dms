import { NextRequest } from "next/server";
import { z } from "zod";
import * as auctionPurchaseService from "@/modules/inventory/service/auction-purchase";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { updateAuctionPurchaseBodySchema, auctionPurchaseIdParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { toBigIntOrUndefined } from "@/lib/bigint";
import { serializeAuctionPurchase } from "@/modules/inventory/serialize-auction-purchase";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = auctionPurchaseIdParamSchema.parse(await context.params);
    const row = await auctionPurchaseService.getAuctionPurchase(ctx.dealershipId, id);
    return jsonResponse({ data: serializeAuctionPurchase(row) });
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
    const { id } = auctionPurchaseIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateAuctionPurchaseBodySchema.parse(body);
    const updated = await auctionPurchaseService.updateAuctionPurchase(ctx.dealershipId, id, {
      vehicleId: data.vehicleId,
      auctionName: data.auctionName,
      lotNumber: data.lotNumber,
      purchasePriceCents: toBigIntOrUndefined(data.purchasePriceCents),
      feesCents: toBigIntOrUndefined(data.feesCents),
      shippingCents: toBigIntOrUndefined(data.shippingCents),
      etaDate: data.etaDate != null ? new Date(data.etaDate) : undefined,
      status: data.status as "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED" | undefined,
      notes: data.notes,
    });
    return jsonResponse({ data: serializeAuctionPurchase(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
