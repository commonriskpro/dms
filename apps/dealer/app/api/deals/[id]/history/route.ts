import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { dealIdParamSchema, listDealHistoryQuerySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const query = listDealHistoryQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await dealService.listDealHistory(ctx.dealershipId, id, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse({
      data,
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
