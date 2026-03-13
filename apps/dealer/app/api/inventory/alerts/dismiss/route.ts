import { NextRequest } from "next/server";
import { z } from "zod";
import * as alertsService from "@/modules/inventory/service/alerts";
import { getAuthContext, guardPermission, handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { dismissAlertBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const body = dismissAlertBodySchema.parse(await readSanitizedJson(request));
    const result = await alertsService.dismissAlert(ctx.dealershipId, ctx.userId, {
      vehicleId: body.vehicleId,
      alertType: body.alertType,
      action: body.action,
      snoozedUntil: body.snoozedUntil,
    });
    return jsonResponse({ data: result }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
