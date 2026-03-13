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
import { listAuctionPurchasesQuerySchema, createAuctionPurchaseBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";
import { toBigIntOrUndefined } from "@/lib/bigint";
import { serializeAuctionPurchase } from "@/modules/inventory/serialize-auction-purchase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = listAuctionPurchasesQuerySchema.parse(getQueryObject(request));
    const { data, total } = await auctionPurchaseService.listAuctionPurchases(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, vehicleId: query.vehicleId },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse(
      listPayload(
        data.map((row) => serializeAuctionPurchase(row)),
        total,
        query.limit,
        query.offset
      )
    );
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
    const body = await readSanitizedJson(request);
    const data = createAuctionPurchaseBodySchema.parse(body);
    const created = await auctionPurchaseService.createAuctionPurchase(ctx.dealershipId, ctx.userId, {
      vehicleId: data.vehicleId ?? undefined,
      auctionName: data.auctionName,
      lotNumber: data.lotNumber,
      purchasePriceCents: BigInt(data.purchasePriceCents),
      feesCents: toBigIntOrUndefined(data.feesCents),
      shippingCents: toBigIntOrUndefined(data.shippingCents),
      etaDate: data.etaDate != null ? new Date(data.etaDate) : undefined,
      status: data.status as "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED",
      notes: data.notes ?? undefined,
    });
    return jsonResponse({ data: serializeAuctionPurchase(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
