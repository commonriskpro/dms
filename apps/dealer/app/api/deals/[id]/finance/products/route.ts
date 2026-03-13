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
  dealIdParamSchema,
  listFinanceProductsQuerySchema,
  createFinanceProductBodySchema,
} from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDealFinanceProduct } from "../../../serialize";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const query = listFinanceProductsQuerySchema.parse(
      getQueryObject(request)
    );
    const result = await financeService.listProducts(ctx.dealershipId, id, {
      limit: query.limit,
      offset: query.offset,
    });
    if (!result) {
      const { errorResponse } = await import("@/lib/api/errors");
      return Response.json(
        errorResponse("NOT_FOUND", "Deal finance not found"),
        { status: 404 }
      );
    }
    return jsonResponse({
      data: result.data.map(serializeDealFinanceProduct),
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
    await guardPermission(ctx, "finance.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createFinanceProductBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const { product } = await financeService.addProduct(
      ctx.dealershipId,
      ctx.userId,
      id,
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
    return jsonResponse(
      { data: serializeDealFinanceProduct(product) },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
