import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { dealIdTradeIdParamSchema, updateDealTradeBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeTrade } from "../../../serialize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; tradeId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const params = dealIdTradeIdParamSchema.parse(await context.params);
    const body = await request.json();
    const data = updateDealTradeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const trade = await dealService.updateTrade(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.tradeId,
      {
        vehicleDescription: data.vehicleDescription,
        allowanceCents: data.allowanceCents,
        payoffCents: data.payoffCents,
      },
      meta
    );
    return jsonResponse({ data: serializeTrade(trade) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
