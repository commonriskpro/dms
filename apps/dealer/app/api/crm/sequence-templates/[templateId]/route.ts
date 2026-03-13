import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import { getAuthContext, guardPermission, handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { templateIdParamSchema, updateSequenceTemplateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(_req: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const ctx = await getAuthContext(_req);
    await guardPermission(ctx, "crm.read");
    const { templateId } = templateIdParamSchema.parse(await context.params);
    const data = await sequenceService.getSequenceTemplate(ctx.dealershipId, templateId);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { templateId } = templateIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateSequenceTemplateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await sequenceService.updateSequenceTemplate(ctx.dealershipId, ctx.userId, templateId, data, meta);
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { templateId } = templateIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await sequenceService.deleteSequenceTemplate(ctx.dealershipId, ctx.userId, templateId, meta);
    return jsonResponse({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
