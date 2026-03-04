import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { dealIdFeeIdParamSchema, updateDealFeeBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeFee } from "../../../serialize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const params = dealIdFeeIdParamSchema.parse(await context.params);
    const body = await request.json();
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
    const params = dealIdFeeIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await dealService.deleteFee(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.feeId,
      meta
    );
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
