import { NextRequest } from "next/server";
import { z } from "zod";
import * as alertsService from "@/modules/inventory/service/alerts";
import { getAuthContext, guardPermission, handleApiError } from "@/lib/api/handler";
import { dismissalIdParamSchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = dismissalIdParamSchema.parse(await context.params);
    await alertsService.undoDismissal(ctx.dealershipId, ctx.userId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
