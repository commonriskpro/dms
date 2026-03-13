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
import { stepIdParamSchema, updateSequenceStepBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ stepId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { stepId } = stepIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateSequenceStepBodySchema.parse(body);
    const updated = await sequenceService.updateSequenceStep(
      ctx.dealershipId,
      ctx.userId,
      stepId,
      data
    );
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ stepId: string }> }
) {
  try {
    const ctx = await getAuthContext(_req);
    await guardPermission(ctx, "crm.write");
    const { stepId } = stepIdParamSchema.parse(await context.params);
    await sequenceService.deleteSequenceStep(ctx.dealershipId, ctx.userId, stepId);
    return jsonResponse({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
