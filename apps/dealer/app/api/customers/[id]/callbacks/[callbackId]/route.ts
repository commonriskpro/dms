import { NextRequest } from "next/server";
import { z } from "zod";
import * as callbacksService from "@/modules/customers/service/callbacks";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { callbackIdParamSchema, updateCallbackBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; callbackId: string }> }
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

    const { id: customerId, callbackId } = callbackIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateCallbackBodySchema.parse(body);
    const meta = getRequestMeta(request);

    const updated = await callbacksService.updateCallback(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      callbackId,
      {
        status: data.status,
        snoozedUntil: data.snoozedUntil != null ? new Date(data.snoozedUntil) : undefined,
      },
      meta
    );
    incrementRateLimit(rlKey, "customers_mutation");

    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
