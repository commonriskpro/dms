import { NextRequest } from "next/server";
import { z } from "zod";
import * as dmvService from "@/modules/deals/service/dmv";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import { validationErrorResponse } from "@/lib/api/validate";
import { toggleDmvChecklistItemBodySchema } from "../../schemas";

export const dynamic = "force-dynamic";

const itemIdParamSchema = z.object({ itemId: z.string().uuid() });

function serializeChecklistItem(item: {
  id: string;
  dealId: string;
  dealershipId: string;
  label: string;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    dealId: item.dealId,
    dealershipId: item.dealershipId,
    label: item.label,
    completed: item.completed,
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { itemId } = itemIdParamSchema.parse(await context.params);
    const body = toggleDmvChecklistItemBodySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const updated = await dmvService.toggleChecklistItem(
      ctx.dealershipId,
      ctx.userId,
      itemId,
      body.completed,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    if (!updated) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Checklist item not found" } },
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeChecklistItem(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
