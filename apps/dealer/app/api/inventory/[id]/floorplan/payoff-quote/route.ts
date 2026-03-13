import { NextRequest } from "next/server";
import { z } from "zod";
import * as floorplanService from "@/modules/inventory/service/floorplan";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
} from "@/lib/api/rate-limit";
import { idParamSchema, payoffQuoteBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    if (!checkRateLimitByDealership(ctx.dealershipId, "floorplan_payoff_quote")) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many payoff quote requests",
          },
        },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = payoffQuoteBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const floorplan = await floorplanService.setPayoffQuote(
      ctx.dealershipId,
      id,
      body.payoffQuoteCents,
      new Date(body.payoffQuoteExpiresAt),
      ctx.userId,
      meta
    );
    incrementRateLimitByDealership(ctx.dealershipId, "floorplan_payoff_quote");
    return jsonResponse({
      data: {
        payoffQuoteCents: floorplan?.payoffQuoteCents ?? body.payoffQuoteCents,
        payoffQuoteExpiresAt:
          floorplan?.payoffQuoteExpiresAt?.toISOString() ??
          body.payoffQuoteExpiresAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
