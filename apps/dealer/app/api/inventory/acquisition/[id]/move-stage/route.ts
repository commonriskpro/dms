import { NextRequest } from "next/server";
import { z } from "zod";
import * as acquisitionService from "@/modules/inventory/service/acquisition";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { moveStageBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.acquisition.write");
    const { id } = await params;
    const body = await readSanitizedJson(request);
    const { status } = moveStageBodySchema.parse(body);
    const updated = await acquisitionService.moveInventorySourceLeadStage(ctx.dealershipId, id, status);
    return jsonResponse({ data: { id: updated.id, status: updated.status } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
