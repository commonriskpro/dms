import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDeal } from "../serialize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const query = parsePagination(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await dealService.listDeliveryQueue(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse({
      data: data.map((d) => serializeDeal(d)),
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
