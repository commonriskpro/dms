import { NextRequest } from "next/server";
import { z } from "zod";
import * as pipelineService from "@/modules/crm-pipeline-automation/service/pipeline";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { pipelineIdParamSchema, updatePipelineBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const ctx = await getAuthContext(_request);
    await guardPermission(ctx, "crm.read");
    const { pipelineId } = pipelineIdParamSchema.parse(await context.params);
    const data = await pipelineService.getPipeline(ctx.dealershipId, pipelineId);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { pipelineId } = pipelineIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updatePipelineBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await pipelineService.updatePipeline(
      ctx.dealershipId,
      ctx.userId,
      pipelineId,
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
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { pipelineId } = pipelineIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await pipelineService.deletePipeline(ctx.dealershipId, ctx.userId, pipelineId, meta);
    return jsonResponse({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
