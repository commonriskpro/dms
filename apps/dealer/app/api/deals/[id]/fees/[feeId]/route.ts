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
import { dealIdFeeIdParamSchema, updateDealFeeBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeFee } from "../../../serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const params = dealIdFeeIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateDealFeeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const fee = await dealService.updateFee(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.feeId,
      {
        label: data.label,
        amountCents: data.amountCents,
        taxable: data.taxable,
      },
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeFee(fee) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const params = dealIdFeeIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await dealService.deleteFee(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.feeId,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
