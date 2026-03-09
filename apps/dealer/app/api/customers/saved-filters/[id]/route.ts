import { NextRequest } from "next/server";
import { z } from "zod";
import * as savedFiltersService from "@/modules/customers/service/saved-filters";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id } = await params;
    const filterId = parseUuidParam(id);
    const meta = getRequestMeta(request);
    await savedFiltersService.deleteSavedFilter(
      ctx.dealershipId,
      ctx.userId,
      filterId,
      ctx.permissions,
      meta
    );
    return jsonResponse({ data: { id: filterId } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
