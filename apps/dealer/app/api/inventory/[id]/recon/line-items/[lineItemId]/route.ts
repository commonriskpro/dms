import { NextRequest } from "next/server";
import { z } from "zod";
import * as reconService from "@/modules/inventory/service/recon";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  reconLineItemBodySchema,
  reconLineItemIdParamSchema,
} from "../../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; lineItemId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const params = reconLineItemIdParamSchema.parse(await context.params);
    const body = reconLineItemBodySchema.partial().parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await reconService.updateLineItem(
      ctx.dealershipId,
      params.id,
      params.lineItemId,
      body,
      ctx.userId,
      meta
    );
    return jsonResponse({
      data: {
        id: updated.id,
        description: updated.description,
        costCents: updated.costCents,
        category: updated.category,
        sortOrder: updated.sortOrder,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; lineItemId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const params = reconLineItemIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await reconService.deleteLineItem(
      ctx.dealershipId,
      params.id,
      params.lineItemId,
      ctx.userId,
      meta
    );
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
