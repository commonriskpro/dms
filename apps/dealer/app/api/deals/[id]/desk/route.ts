import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealDeskService from "@/modules/deals/service/deal-desk";
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
import { dealIdParamSchema, updateDealDeskBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

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
    const data = updateDealDeskBodySchema.parse(body);
    const meta = getRequestMeta(request);

    const payload: dealDeskService.FullDeskPayload = {};
    if (data.salePriceCents !== undefined) payload.salePriceCents = data.salePriceCents;
    if (data.taxRateBps !== undefined) payload.taxRateBps = data.taxRateBps;
    if (data.docFeeCents !== undefined) payload.docFeeCents = data.docFeeCents;
    if (data.downPaymentCents !== undefined) payload.downPaymentCents = data.downPaymentCents;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.cashDownCents !== undefined) payload.cashDownCents = data.cashDownCents;
    if (data.termMonths !== undefined) payload.termMonths = data.termMonths;
    if (data.aprBps !== undefined) payload.aprBps = data.aprBps;
    if (data.fees !== undefined) payload.fees = data.fees;
    if (data.trade !== undefined) payload.trade = data.trade;
    if (data.products !== undefined) {
      payload.products = data.products.map((p) => ({
        ...p,
        costCents: p.costCents ?? null,
      }));
    }

    const updated = await dealDeskService.saveFullDealDesk(
      ctx.dealershipId,
      ctx.userId,
      id,
      payload,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
