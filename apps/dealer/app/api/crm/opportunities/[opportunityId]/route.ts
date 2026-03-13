import { NextRequest } from "next/server";
import { z } from "zod";
import * as opportunityService from "@/modules/crm-pipeline-automation/service/opportunity";
import { getAuthContext, guardPermission, handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { opportunityIdParamSchema, updateOpportunityBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeOpportunity } from "../../serialize";

export async function GET(req: NextRequest, context: { params: Promise<{ opportunityId: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    await guardPermission(ctx, "crm.read");
    const { opportunityId } = opportunityIdParamSchema.parse(await context.params);
    const data = await opportunityService.getOpportunity(ctx.dealershipId, opportunityId);
    return jsonResponse({ data: serializeOpportunity(data) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ opportunityId: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    await guardPermission(ctx, "crm.write");
    const { opportunityId } = opportunityIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(req);
    const data = updateOpportunityBodySchema.parse(body);
    const meta = getRequestMeta(req);
    const updated = await opportunityService.updateOpportunity(
      ctx.dealershipId,
      ctx.userId,
      opportunityId,
      data,
      meta
    );
    return jsonResponse({ data: serializeOpportunity(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
