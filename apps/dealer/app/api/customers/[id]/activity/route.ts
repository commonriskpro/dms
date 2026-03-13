import { NextRequest } from "next/server";
import { z } from "zod";
import * as activityService from "@/modules/customers/service/activity";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { customerIdParamSchema, listActivityQuerySchema, createActivityBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const query = listActivityQuerySchema.parse(getQueryObject(request));
    const { data, total } = await activityService.listActivity(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
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
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createActivityBodySchema.parse(body);
    const created = await activityService.createActivity(ctx.dealershipId, ctx.userId, customerId, {
      activityType: data.activityType,
      metadata: data.metadata,
    });
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
