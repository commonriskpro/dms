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
import { dealIdParamSchema, createDmvChecklistBodySchema } from "../../schemas";

export const dynamic = "force-dynamic";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const items = await dmvService.getChecklistForDeal(ctx.dealershipId, id);
    return jsonResponse({
      data: items.map(serializeChecklistItem),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));
    const parsed = createDmvChecklistBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const items = await dmvService.createChecklistItemsForDeal(
      ctx.dealershipId,
      ctx.userId,
      id,
      parsed.labels,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: items.map(serializeChecklistItem) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
