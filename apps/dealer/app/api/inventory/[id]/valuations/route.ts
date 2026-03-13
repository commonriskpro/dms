import { NextRequest } from "next/server";
import { z } from "zod";
import * as valuationService from "@/modules/inventory/service/valuation";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
} from "@/lib/api/rate-limit";
import {
  idParamSchema,
  valuationsListQuerySchema,
  requestValuationBodySchema,
} from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const query = valuationsListQuerySchema.parse(
      getQueryObject(request)
    );
    const result = await valuationService.listValuations(ctx.dealershipId, id, {
      limit: query.limit,
      offset: query.offset,
      source: query.source,
    });
    return jsonResponse({
      data: result.data.map((d) => ({
        id: d.id,
        source: d.source,
        valueCents: d.valueCents,
        capturedAt: d.capturedAt,
        condition: d.condition,
        odometer: d.odometer,
      })),
      meta: result.meta,
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
    await guardPermission(ctx, "finance.read");
    if (!checkRateLimitByDealership(ctx.dealershipId, "valuation_request")) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many valuation requests",
          },
        },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = requestValuationBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const created = await valuationService.requestValuation(
      ctx.dealershipId,
      id,
      ctx.userId,
      body,
      meta
    );
    incrementRateLimitByDealership(ctx.dealershipId, "valuation_request");
    return jsonResponse(
      {
        data: {
          id: created.id,
          source: created.source,
          valueCents: created.valueCents,
          capturedAt: created.capturedAt,
          condition: created.condition,
          odometer: created.odometer,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
