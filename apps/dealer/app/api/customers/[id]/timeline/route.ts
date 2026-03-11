import { NextRequest } from "next/server";
import { z } from "zod";
import * as timelineService from "@/modules/customers/service/timeline";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { customerIdParamSchema, timelineQuerySchema } from "../../schemas";
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
    const query = timelineQuerySchema.parse(getQueryObject(request));
    const { data, total } = await timelineService.listTimeline(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
      type: query.type,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
