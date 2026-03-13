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
import { customerIdParamSchema, smsStubBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request).catch(() => ({}));
    smsStubBodySchema.parse(body);
    const created = await activityService.logSmsSent(ctx.dealershipId, ctx.userId, customerId);
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
