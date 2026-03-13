import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import { dealIdTradeIdParamSchema, updateDealTradeBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeTrade } from "../../../serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; tradeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const params = dealIdTradeIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateDealTradeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const trade = await dealService.updateTrade(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.tradeId,
      {
        vehicleDescription: data.vehicleDescription,
        allowanceCents: data.allowanceCents,
        payoffCents: data.payoffCents,
      },
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeTrade(trade) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; tradeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const params = dealIdTradeIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await dealService.deleteTrade(ctx.dealershipId, ctx.userId, params.id, params.tradeId, meta);
    incrementRateLimit(rlKey, "deals_mutation");
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
