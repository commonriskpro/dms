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
import { dealIdParamSchema, createDealFeeBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeFee } from "../../serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const deal = await dealService.getDeal(ctx.dealershipId, id);
    const fees = deal.fees ?? [];
    return jsonResponse({
      data: fees.map((f) => serializeFee(f)),
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
    const data = createDealFeeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const fee = await dealService.addFee(ctx.dealershipId, ctx.userId, id, {
      label: data.label,
      amountCents: data.amountCents,
      taxable: data.taxable,
    }, meta);
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeFee(fee) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
