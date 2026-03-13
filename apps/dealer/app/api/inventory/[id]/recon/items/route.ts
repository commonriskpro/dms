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
import { idParamSchema, reconItemCreateBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function rateLimitKey(ctx: { dealershipId: string; userId: string }) {
  return `inventory:${ctx.dealershipId}:${ctx.userId}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const [items, totals] = await Promise.all([
      reconItemsService.listReconItems(ctx.dealershipId, id),
      reconItemsService.getReconTotals(ctx.dealershipId, id),
    ]);
    return jsonResponse({
      data: {
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          costCents: i.costCents,
          status: i.status,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          completedAt: i.completedAt,
          createdByUserId: i.createdByUserId,
        })),
        totals,
      },
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
    await guardPermission(ctx, "inventory.write");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "inventory_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = reconItemCreateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const item = await reconItemsService.addReconItem(
      ctx.dealershipId,
      id,
      { description: data.description, costCents: data.costCents, status: data.status },
      ctx.userId,
      meta
    );
    incrementRateLimit(rlKey, "inventory_mutation");
    return jsonResponse({
      data: {
        id: item.id,
        description: item.description,
        costCents: item.costCents,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        completedAt: item.completedAt,
        createdByUserId: item.createdByUserId,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
