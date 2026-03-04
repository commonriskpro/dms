import { NextRequest } from "next/server";
import { z } from "zod";
import * as opportunityService from "@/modules/crm-pipeline-automation/service/opportunity";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { opportunityIdParamSchema, listActivityQuerySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const { opportunityId } = opportunityIdParamSchema.parse(await context.params);
    const query = listActivityQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await opportunityService.listActivity(
      ctx.dealershipId,
      opportunityId,
      { limit: query.limit, offset: query.offset }
    );
    return jsonResponse({
      data,
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
