import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as formService from "@/modules/websites-core/service/form";
import { serializeForm } from "@/modules/websites-core/serialize";
import { formIdParamSchema, updateWebsiteLeadFormBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { formId } = formIdParamSchema.parse(params);
    const body = updateWebsiteLeadFormBodySchema.parse(await readSanitizedJson(request));
    const updated = await formService.updateForm(ctx.dealershipId, formId, {
      ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
      ...(body.routingConfigJson !== undefined && { routingConfigJson: body.routingConfigJson as object }),
    });
    return jsonResponse({ data: serializeForm(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
