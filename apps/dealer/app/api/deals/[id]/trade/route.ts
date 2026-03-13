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
import { dealIdParamSchema, createDealTradeBodySchema, listDealTradesQuerySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeTrade } from "../../serialize";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const query = listDealTradesQuerySchema.parse(getQueryObject(request));
    const result = await dealService.listTrades(ctx.dealershipId, id, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse({
      data: result.data.map((t) => serializeTrade(t)),
      meta: { total: result.total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createDealTradeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const trade = await dealService.addTrade(ctx.dealershipId, ctx.userId, id, {
      vehicleDescription: data.vehicleDescription,
      allowanceCents: data.allowanceCents,
      payoffCents: data.payoffCents,
    }, meta);
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeTrade(trade) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
