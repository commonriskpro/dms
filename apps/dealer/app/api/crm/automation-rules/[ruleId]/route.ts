import { NextRequest } from "next/server";
import { z } from "zod";
import * as automationRuleService from "@/modules/crm-pipeline-automation/service/automation-rule";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { ruleIdParamSchema, updateAutomationRuleBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ ruleId: string }> }
) {
  try {
    const ctx = await getAuthContext(_req);
    await guardPermission(ctx, "crm.read");
    const { ruleId } = ruleIdParamSchema.parse(await context.params);
    const data = await automationRuleService.getAutomationRule(ctx.dealershipId, ruleId);
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
  context: { params: Promise<{ ruleId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { ruleId } = ruleIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateAutomationRuleBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await automationRuleService.updateAutomationRule(
      ctx.dealershipId,
      ctx.userId,
      ruleId,
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
  context: { params: Promise<{ ruleId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const { ruleId } = ruleIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await automationRuleService.deleteAutomationRule(ctx.dealershipId, ctx.userId, ruleId, meta);
    return jsonResponse({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
