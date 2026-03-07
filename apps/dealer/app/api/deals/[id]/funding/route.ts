import { NextRequest } from "next/server";
import { z } from "zod";
import * as fundingService from "@/modules/deals/service/funding";
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
import { dealIdParamSchema, createDealFundingBodySchema } from "../../schemas";

export const dynamic = "force-dynamic";

function serializeDealFunding(f: {
  id: string;
  dealId: string;
  dealershipId: string;
  lenderApplicationId: string | null;
  fundingStatus: string;
  fundingAmountCents: bigint;
  fundingDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lenderApplication?: { id: string; lenderName: string } | null;
}) {
  return {
    id: f.id,
    dealId: f.dealId,
    dealershipId: f.dealershipId,
    lenderApplicationId: f.lenderApplicationId,
    fundingStatus: f.fundingStatus,
    fundingAmountCents: String(f.fundingAmountCents),
    fundingDate: f.fundingDate?.toISOString() ?? null,
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    ...(f.lenderApplication && { lenderName: f.lenderApplication.lenderName }),
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const rlKey = `deals:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "deals_mutation")) throw new ApiError("RATE_LIMITED", "Too many requests");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = createDealFundingBodySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const funding = await fundingService.createFundingRecord(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        lenderApplicationId: body.lenderApplicationId ?? undefined,
        fundingAmountCents: body.fundingAmountCents,
        notes: body.notes ?? undefined,
      },
      meta
    );
    incrementRateLimit(rlKey, "deals_mutation");
    return jsonResponse({ data: serializeDealFunding(funding) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
