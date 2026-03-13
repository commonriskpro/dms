import { NextRequest } from "next/server";
import { z } from "zod";
import * as financeService from "@/modules/finance-shell/service";
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
import {
  dealIdProductIdParamSchema,
  updateFinanceProductBodySchema,
} from "../../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDealFinanceProduct } from "../../../../serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id, productId } = dealIdProductIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateFinanceProductBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const { product } = await financeService.updateProduct(
      ctx.dealershipId,
      ctx.userId,
      id,
      productId,
      {
        productType: data.productType,
        name: data.name,
        priceCents: data.priceCents,
        costCents: data.costCents,
        taxable: data.taxable,
        includedInAmountFinanced: data.includedInAmountFinanced,
      },
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDealFinanceProduct(product) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id, productId } = dealIdProductIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await financeService.deleteProduct(
      ctx.dealershipId,
      ctx.userId,
      id,
      productId,
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
