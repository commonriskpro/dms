import { NextRequest } from "next/server";
import { z } from "zod";
import * as lastVisitService from "@/modules/customers/service/last-visit";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { customerIdParamSchema } from "../../schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");

    const rlKey = `customers:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "customers_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }

    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);

    await lastVisitService.updateLastVisit(ctx.dealershipId, ctx.userId, customerId, meta);
    incrementRateLimit(rlKey, "customers_mutation");

    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: e.issues } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
