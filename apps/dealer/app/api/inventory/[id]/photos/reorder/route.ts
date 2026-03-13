import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { idParamSchema, reorderPhotosBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    await guardPermission(ctx, "documents.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = reorderPhotosBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    await inventoryService.reorderVehiclePhotos(
      ctx.dealershipId,
      ctx.userId,
      id,
      body.fileIds,
      meta
    );
    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
