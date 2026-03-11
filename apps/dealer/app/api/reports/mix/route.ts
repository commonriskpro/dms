import { NextRequest } from "next/server";
import { z } from "zod";
import { getMix } from "@/modules/reports/service";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { mixQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "reports.read");
    const query = mixQuerySchema.parse(
      getQueryObject(request)
    );
    const data = await getMix({
      dealershipId: ctx.dealershipId,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
