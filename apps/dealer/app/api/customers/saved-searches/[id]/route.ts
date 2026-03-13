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
  readSanitizedJson,
} from "@/lib/api/handler";
import { updateSavedSearchBodySchema } from "../../saved-schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id } = await params;
    const searchId = parseUuidParam(id);
    const body = await readSanitizedJson(request);
    const data = updateSavedSearchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const patch: Parameters<typeof savedSearchesService.updateSavedSearch>[3] = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.state !== undefined) patch.state = data.state;
    if (data.isDefault !== undefined) patch.isDefault = data.isDefault;
    const updated = await savedSearchesService.updateSavedSearch(
      ctx.dealershipId,
      ctx.userId,
      searchId,
      patch,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id } = await params;
    const searchId = parseUuidParam(id);
    const meta = getRequestMeta(request);
    await savedSearchesService.deleteSavedSearch(
      ctx.dealershipId,
      ctx.userId,
      searchId,
      ctx.permissions,
      meta
    );
    return jsonResponse({ data: { id: searchId } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
