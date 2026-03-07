import { NextRequest } from "next/server";
import { z } from "zod";
import * as savedSearchesService from "@/modules/customers/service/saved-searches";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  parseUuidParam,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id } = await params;
    const searchId = parseUuidParam(id);
    const meta = getRequestMeta(request);
    const updated = await savedSearchesService.setDefaultSavedSearch(
      ctx.dealershipId,
      ctx.userId,
      searchId,
      ctx.permissions,
      meta
    );
    return jsonResponse({
      data: {
        id: updated.id,
        name: updated.name,
        visibility: updated.visibility,
        stateJson: updated.stateJson,
        isDefault: updated.isDefault,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        ownerUserId: updated.ownerUserId,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
