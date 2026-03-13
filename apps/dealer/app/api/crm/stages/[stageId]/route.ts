import { NextRequest } from "next/server";
import { z } from "zod";
import * as stageService from "@/modules/crm-pipeline-automation/service/stage";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { stageIdParamSchema, updateStageBodySchema, deleteStageBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { stageId } = stageIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateStageBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await stageService.updateStage(
      ctx.dealershipId,
      ctx.userId,
      stageId,
      data,
      meta
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
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { stageId } = stageIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    const body = await readSanitizedJson(request).catch(() => ({}));
    const { targetStageId } = deleteStageBodySchema.parse(body);
    if (targetStageId) {
      await stageService.deleteStageWithReassign(
        ctx.dealershipId,
        ctx.userId,
        stageId,
        targetStageId,
        meta
      );
    } else {
      await stageService.deleteStage(ctx.dealershipId, ctx.userId, stageId, meta);
    }
    return jsonResponse({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
