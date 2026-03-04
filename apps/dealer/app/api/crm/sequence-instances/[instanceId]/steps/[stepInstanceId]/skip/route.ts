import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import { getAuthContext, guardPermission, handleApiError, jsonResponse, getRequestMeta } from "@/lib/api/handler";
import { instanceIdParamSchema, stepInstanceIdParamSchema } from "../../../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function POST(r: NextRequest, ctx: { params: Promise<{ instanceId: string; stepInstanceId: string }> }) {
  try {
    const auth = await getAuthContext(r);
    await guardPermission(auth, "crm.write");
    const p = await ctx.params;
    const { instanceId } = instanceIdParamSchema.parse({ instanceId: p.instanceId });
    const { stepInstanceId } = stepInstanceIdParamSchema.parse({ stepInstanceId: p.stepInstanceId });
    const meta = getRequestMeta(r);
    const data = await sequenceService.skipSequenceStep(auth.dealershipId, auth.userId, instanceId, stepInstanceId, meta);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
