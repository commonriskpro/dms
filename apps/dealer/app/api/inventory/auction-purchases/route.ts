import { NextRequest } from "next/server";
import { z } from "zod";
import * as auctionPurchaseService from "@/modules/inventory/service/auction-purchase";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { listAuctionPurchasesQuerySchema, createAuctionPurchaseBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function toAuctionPurchaseResponse(
  row: Awaited<ReturnType<typeof auctionPurchaseService.getAuctionPurchase>> | { id: string; dealershipId: string; vehicleId: string | null; auctionName: string; lotNumber: string; purchasePriceCents: bigint; feesCents: bigint; shippingCents: bigint; etaDate: Date | null; status: string; notes: string | null; createdAt: Date; updatedAt: Date; vehicle: unknown }
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

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = listAuctionPurchasesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await auctionPurchaseService.listAuctionPurchases(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, vehicleId: query.vehicleId },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse({
      data: data.map((row) => toAuctionPurchaseResponse(row)),
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
    const data = createAuctionPurchaseBodySchema.parse(body);
    const created = await auctionPurchaseService.createAuctionPurchase(ctx.dealershipId, ctx.userId, {
      vehicleId: data.vehicleId ?? undefined,
      auctionName: data.auctionName,
      lotNumber: data.lotNumber,
      purchasePriceCents: BigInt(data.purchasePriceCents),
      feesCents: data.feesCents != null ? BigInt(data.feesCents) : undefined,
      shippingCents: data.shippingCents != null ? BigInt(data.shippingCents) : undefined,
      etaDate: data.etaDate != null ? new Date(data.etaDate) : undefined,
      status: data.status as "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED",
      notes: data.notes ?? undefined,
    });
    return jsonResponse({ data: toAuctionPurchaseResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
