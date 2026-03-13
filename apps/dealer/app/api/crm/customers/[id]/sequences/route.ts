import { NextRequest } from "next/server";
import { z } from "zod";
import * as sequenceService from "@/modules/crm-pipeline-automation/service/sequence";
import { getAuthContext, guardPermission, handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { startSequenceBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(_r);
    await guardPermission(auth, "crm.read");
    const { id: customerId } = idParamSchema.parse(await ctx.params);
    const data = await sequenceService.listSequencesForCustomer(auth.dealershipId, customerId);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function POST(r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(r);
    await guardPermission(auth, "crm.write");
    const { id: customerId } = idParamSchema.parse(await ctx.params);
    const body = await readSanitizedJson(r);
    const { templateId } = startSequenceBodySchema.parse(body);
    const meta = getRequestMeta(r);
    const data = await sequenceService.startSequenceOnCustomer(auth.dealershipId, auth.userId, customerId, templateId, meta);
    return jsonResponse({ data }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
