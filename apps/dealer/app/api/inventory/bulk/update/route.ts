import { NextRequest } from "next/server";
import { z } from "zod";
import * as bulkService from "@/modules/inventory/service/bulk";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { bulkUpdateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const body = bulkUpdateBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const result = await bulkService.bulkUpdateVehicles(
      ctx.dealershipId,
      ctx.userId,
      {
        vehicleIds: body.vehicleIds,
        status: body.status,
        locationId: body.locationId,
      },
      meta
    );
    return jsonResponse({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
