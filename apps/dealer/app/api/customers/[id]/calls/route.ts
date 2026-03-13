import { NextRequest } from "next/server";
import { z } from "zod";
import * as activityService from "@/modules/customers/service/activity";
import * as lastVisitService from "@/modules/customers/service/last-visit";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { customerIdParamSchema, logCallBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");

    const rlKey = `customers:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "customers_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }

    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = logCallBodySchema.parse(body);
    const meta = getRequestMeta(request);

    const created = await activityService.logCall(ctx.dealershipId, ctx.userId, customerId, {
      summary: data.summary ?? undefined,
      durationSeconds: data.durationSeconds ?? undefined,
      direction: data.direction ?? undefined,
    });
    incrementRateLimit(rlKey, "customers_mutation");

    await lastVisitService.updateLastVisit(ctx.dealershipId, ctx.userId, customerId, meta);

    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
