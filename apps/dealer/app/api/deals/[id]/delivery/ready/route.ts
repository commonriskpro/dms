import { NextRequest } from "next/server";
import { z } from "zod";
import * as deliveryService from "@/modules/deals/service/delivery";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import { dealIdParamSchema } from "../../../schemas";
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
    const meta = getRequestMeta(request);
    const updated = await deliveryService.markDealReadyForDelivery(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDeal(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: e.issues } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
