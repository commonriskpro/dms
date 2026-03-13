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
import {
  customerIdParamSchema,
  listCallbacksQuerySchema,
  createCallbackBodySchema,
} from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const query = listCallbacksQuerySchema.parse(getQueryObject(request));
    const { data, total } = await callbacksService.listCallbacks(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
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
    const data = createCallbackBodySchema.parse(body);
    const meta = getRequestMeta(request);

    const created = await callbacksService.createCallback(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      {
        callbackAt: new Date(data.callbackAt),
        reason: data.reason ?? undefined,
        assignedToUserId: data.assignedToUserId ?? undefined,
      },
      meta
    );
    incrementRateLimit(rlKey, "customers_mutation");

    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
