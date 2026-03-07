import { NextRequest } from "next/server";
import { z } from "zod";
import * as titleService from "@/modules/deals/service/title";
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
import { dealIdParamSchema, updateDealTitleStatusBodySchema } from "../../../schemas";

export const dynamic = "force-dynamic";

function serializeDealTitle(t: {
  id: string;
  dealId: string;
  dealershipId: string;
  titleStatus: string;
  titleNumber: string | null;
  lienholderName: string | null;
  lienReleasedAt: Date | null;
  sentToDmvAt: Date | null;
  receivedFromDmvAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    dealId: t.dealId,
    dealershipId: t.dealershipId,
    titleStatus: t.titleStatus,
    titleNumber: t.titleNumber,
    lienholderName: t.lienholderName,
    lienReleasedAt: t.lienReleasedAt?.toISOString() ?? null,
    sentToDmvAt: t.sentToDmvAt?.toISOString() ?? null,
    receivedFromDmvAt: t.receivedFromDmvAt?.toISOString() ?? null,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = updateDealTitleStatusBodySchema.parse(await request.json());
    const payload = {
      ...(body.titleStatus !== undefined && { titleStatus: body.titleStatus }),
      ...(body.titleNumber !== undefined && { titleNumber: body.titleNumber }),
      ...(body.lienholderName !== undefined && { lienholderName: body.lienholderName }),
      ...(body.lienReleasedAt !== undefined && { lienReleasedAt: body.lienReleasedAt }),
      ...(body.sentToDmvAt !== undefined && { sentToDmvAt: body.sentToDmvAt }),
      ...(body.receivedFromDmvAt !== undefined && { receivedFromDmvAt: body.receivedFromDmvAt }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };
    const meta = getRequestMeta(request);
    const updated = await titleService.updateTitleStatus(
      ctx.dealershipId,
      ctx.userId,
      id,
      payload,
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDealTitle(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
