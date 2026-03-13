import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import { getAuthContext, guardPermission, handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { instanceIdParamSchema, updateSequenceInstanceBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(_r: NextRequest, ctx: { params: Promise<{ instanceId: string }> }) {
  try {
    const auth = await getAuthContext(_r);
    await guardPermission(auth, "crm.read");
    const { instanceId } = instanceIdParamSchema.parse(await ctx.params);
    const data = await sequenceService.getSequenceInstance(auth.dealershipId, instanceId);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function PATCH(r: NextRequest, ctx: { params: Promise<{ instanceId: string }> }) {
  try {
    const auth = await getAuthContext(r);
    await guardPermission(auth, "crm.write");
    const { instanceId } = instanceIdParamSchema.parse(await ctx.params);
    const body = await readSanitizedJson(r);
    const { status } = updateSequenceInstanceBodySchema.parse(body);
    const meta = getRequestMeta(r);
    const updated = await sequenceService.updateSequenceInstanceStatus(auth.dealershipId, auth.userId, instanceId, status, meta);
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
