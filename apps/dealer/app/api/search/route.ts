import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext, handleApiError, jsonResponse } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { globalSearch } from "@/modules/search/service/global-search";
import { searchQuerySchema } from "./schemas";
import { getQueryObject } from "@/lib/api/query";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    const raw = getQueryObject(request);
    const query = searchQuerySchema.parse(raw);
    const limit = Math.min(50, query.limit); // enforce cap per spec (e.g. 51 → 50)
    const { data, meta } = await globalSearch({
      dealershipId: ctx.dealershipId,
      q: query.q,
      limit,
      offset: query.offset,
      permissions: ctx.permissions,
    });
    return jsonResponse({ data, meta });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
