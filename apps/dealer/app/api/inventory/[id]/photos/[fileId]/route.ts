import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  getRequestMeta,
} from "@/lib/api/handler";
import { photoFileIdParamSchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    await guardPermission(ctx, "documents.write");
    const params = photoFileIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await inventoryService.deleteVehiclePhoto(
      ctx.dealershipId,
      ctx.userId,
      params.id,
      params.fileId,
      meta
    );
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
