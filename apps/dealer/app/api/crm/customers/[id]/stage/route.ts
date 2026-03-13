import { NextRequest } from "next/server";
import { z } from "zod";
import { transitionStage } from "@/modules/crm-pipeline-automation/service/stage-transition";
import { getAuthContext, guardPermission, handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { patchStageBodySchema, customerIdParamSchemaForStage } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(req);
    await guardPermission(ctx, "crm.write");
    const { id: customerId } = customerIdParamSchemaForStage.parse(await context.params);
    const body = patchStageBodySchema.parse(await readSanitizedJson(req));
    const result = await transitionStage(
      ctx.dealershipId,
      ctx.userId,
      "customer",
      customerId,
      body.newStageId
    );
    return jsonResponse({ data: result }, 200);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
