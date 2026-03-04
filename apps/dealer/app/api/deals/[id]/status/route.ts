import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { dealIdParamSchema, updateDealStatusBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDeal } from "../../serialize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await request.json();
    const data = updateDealStatusBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await dealService.updateDealStatus(
      ctx.dealershipId,
      ctx.userId,
      id,
      data.status,
      meta
    );
    return jsonResponse({ data: serializeDeal(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
