import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as notificationsService from "@/modules/notifications/service/notifications";
import { markNotificationReadBodySchema, notificationIdParamSchema } from "../schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "notifications.read");
    const { id } = notificationIdParamSchema.parse(await context.params);
    markNotificationReadBodySchema.parse(
      await readSanitizedJson(request).catch(() => ({}))
    );

    const data = await notificationsService.markAsRead(ctx.dealershipId, ctx.userId, id);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
