import { NextRequest } from "next/server";
import { z } from "zod";
import * as bookValuesService from "@/modules/inventory/service/book-values";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { idParamSchema, bookValuesBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function rateLimitKey(ctx: { dealershipId: string; userId: string }) {
  return `inventory:${ctx.dealershipId}:${ctx.userId}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const result = await bookValuesService.getBookValues(ctx.dealershipId, id);
    return jsonResponse({ data: result });
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
    await guardPermission(ctx, "inventory.write");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "inventory_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = bookValuesBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await bookValuesService.upsertBookValues(
      ctx.dealershipId,
      id,
      {
        retailCents: data.retailCents,
        tradeInCents: data.tradeInCents,
        wholesaleCents: data.wholesaleCents,
        auctionCents: data.auctionCents,
      },
      data.source ?? "MANUAL",
      ctx.userId,
      meta
    );
    incrementRateLimit(rlKey, "inventory_mutation");
    return jsonResponse({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
