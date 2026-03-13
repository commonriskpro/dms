import { NextRequest } from "next/server";
import { z } from "zod";
import * as reconItemsService from "@/modules/inventory/service/recon-items";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { reconItemIdParamSchema, reconItemUpdateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function rateLimitKey(ctx: { dealershipId: string; userId: string }) {
  return `inventory:${ctx.dealershipId}:${ctx.userId}`;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reconItemId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "inventory_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const { reconItemId } = reconItemIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = reconItemUpdateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await reconItemsService.updateReconItem(
      ctx.dealershipId,
      reconItemId,
      {
        description: data.description,
        costCents: data.costCents,
        status: data.status,
      },
      ctx.userId,
      meta
    );
    incrementRateLimit(rlKey, "inventory_mutation");
    return jsonResponse({
      data: {
        id: updated.id,
        description: updated.description,
        costCents: updated.costCents,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        completedAt: updated.completedAt,
        createdByUserId: updated.createdByUserId,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
