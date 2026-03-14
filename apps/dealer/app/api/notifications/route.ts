import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { parsePagination } from "@/lib/api/pagination";
import { listNotificationsQuerySchema } from "./schemas";
import * as notificationsService from "@/modules/notifications/service/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "notifications.read");

    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { limit, offset } = parsePagination(query);
    const { unreadOnly } = listNotificationsQuerySchema.parse(query);
    const data = await notificationsService.listForUser(ctx.dealershipId, ctx.userId, {
      limit,
      offset,
      unreadOnly,
    });
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
