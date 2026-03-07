import { NextRequest } from "next/server";
import { z } from "zod";
import * as auctionPurchaseService from "@/modules/inventory/service/auction-purchase";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { updateAuctionPurchaseBodySchema, auctionPurchaseIdParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function toAuctionPurchaseResponse(
  row: Awaited<ReturnType<typeof auctionPurchaseService.getAuctionPurchase>>
) {
  if (!row) return null;
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    auctionName: row.auctionName,
    lotNumber: row.lotNumber,
    purchasePriceCents: row.purchasePriceCents.toString(),
    feesCents: row.feesCents.toString(),
    shippingCents: row.shippingCents.toString(),
    etaDate: row.etaDate?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = auctionPurchaseIdParamSchema.parse(await context.params);
    const row = await auctionPurchaseService.getAuctionPurchase(ctx.dealershipId, id);
    return jsonResponse({ data: toAuctionPurchaseResponse(row) });
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
    const body = await request.json();
    const data = updateAuctionPurchaseBodySchema.parse(body);
    const updated = await auctionPurchaseService.updateAuctionPurchase(ctx.dealershipId, id, {
      vehicleId: data.vehicleId,
      auctionName: data.auctionName,
      lotNumber: data.lotNumber,
      purchasePriceCents: data.purchasePriceCents != null ? BigInt(data.purchasePriceCents) : undefined,
      feesCents: data.feesCents != null ? BigInt(data.feesCents) : undefined,
      shippingCents: data.shippingCents != null ? BigInt(data.shippingCents) : undefined,
      etaDate: data.etaDate != null ? new Date(data.etaDate) : undefined,
      status: data.status as "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED" | undefined,
      notes: data.notes,
    });
    return jsonResponse({ data: toAuctionPurchaseResponse(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
