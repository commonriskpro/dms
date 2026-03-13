import { NextRequest } from "next/server";
import { z } from "zod";
import * as fundingService from "@/modules/deals/service/funding";
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
import { serializeDealFunding } from "../../../serialize";
import { dealIdParamSchema, updateDealFundingStatusBodySchema } from "../../../schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id: dealId } = dealIdParamSchema.parse(await context.params);
    const body = updateDealFundingStatusBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await fundingService.updateFundingStatus(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      body.fundingId,
      {
        fundingStatus: body.fundingStatus,
        fundingAmountCents: body.fundingAmountCents,
        fundingDate: body.fundingDate,
        notes: body.notes,
      },
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDealFunding(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
