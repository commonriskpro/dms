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
import { pipelineIdParamSchema, createStageBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const { pipelineId } = pipelineIdParamSchema.parse(await context.params);
    const data = await stageService.listStages(ctx.dealershipId, pipelineId);
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
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { pipelineId } = pipelineIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createStageBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await stageService.createStage(
      ctx.dealershipId,
      ctx.userId,
      pipelineId,
      data,
      meta
    );
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
