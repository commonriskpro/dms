import { NextRequest } from "next/server";
import { z } from "zod";
import * as deliveryService from "@/modules/deals/service/delivery";
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
import { validationErrorResponse } from "@/lib/api/validate";
import { dealIdParamSchema, markDealDeliveredBodySchema } from "../../../schemas";
import { serializeDeal } from "../../../serialize";

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
    const body = await readSanitizedJson(request).catch(() => ({}));
    const data = markDealDeliveredBodySchema.parse(body);
    const deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : undefined;
    const meta = getRequestMeta(request);
    const updated = await deliveryService.markDealDelivered(
      ctx.dealershipId,
      ctx.userId,
      id,
      deliveredAt ?? undefined,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDeal(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
