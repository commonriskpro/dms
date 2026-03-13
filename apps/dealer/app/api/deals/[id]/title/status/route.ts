import { NextRequest } from "next/server";
import { z } from "zod";
import * as titleService from "@/modules/deals/service/title";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDealTitle } from "../../../serialize";
import { dealIdParamSchema, updateDealTitleStatusBodySchema } from "../../../schemas";

export const dynamic = "force-dynamic";

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
    const body = updateDealTitleStatusBodySchema.parse(await readSanitizedJson(request));
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
