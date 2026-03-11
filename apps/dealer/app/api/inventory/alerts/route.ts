import { NextRequest } from "next/server";
import { z } from "zod";
import * as alertsService from "@/modules/inventory/service/alerts";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { alertsListQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = alertsListQuerySchema.parse(getQueryObject(request));
    const result = await alertsService.listAlerts(ctx.dealershipId, ctx.userId, {
      limit: query.limit,
      offset: query.offset,
      alertType: query.alertType,
    });
    return jsonResponse({
      data: result.data,
      meta: { total: result.total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
