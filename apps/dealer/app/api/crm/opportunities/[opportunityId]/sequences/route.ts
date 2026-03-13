import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { opportunityIdParamSchema, startSequenceBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const ctx = await getAuthContext(_request);
    await guardPermission(ctx, "crm.read");
    const { opportunityId } = opportunityIdParamSchema.parse(await context.params);
    const data = await sequenceService.listSequencesForOpportunity(ctx.dealershipId, opportunityId);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { opportunityId } = opportunityIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const { templateId } = startSequenceBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const data = await sequenceService.startSequenceOnOpportunity(
      ctx.dealershipId,
      ctx.userId,
      opportunityId,
      templateId,
      meta
    );
    return jsonResponse({ data }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
