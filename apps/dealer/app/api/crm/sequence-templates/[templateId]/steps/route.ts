import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { templateIdParamSchema, createSequenceStepBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { templateId } = templateIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createSequenceStepBodySchema.parse(body);
    const created = await sequenceService.createSequenceStep(
      ctx.dealershipId,
      ctx.userId,
      templateId,
      data
    );
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
