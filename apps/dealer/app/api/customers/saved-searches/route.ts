import { NextRequest } from "next/server";
import { z } from "zod";
import * as savedSearchesService from "@/modules/customers/service/saved-searches";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { createSavedSearchBodySchema } from "../saved-schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const list = await savedSearchesService.listSavedSearches(ctx.dealershipId, ctx.userId);
    return jsonResponse({
      data: list.map((s) => ({
        id: s.id,
        name: s.name,
        visibility: s.visibility,
        stateJson: s.stateJson,
        isDefault: s.isDefault,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        ownerUserId: s.ownerUserId,
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const body = await readSanitizedJson(request);
    const data = createSavedSearchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await savedSearchesService.createSavedSearch(
      ctx.dealershipId,
      ctx.userId,
      {
        name: data.name,
        visibility: data.visibility,
        state: data.state,
        isDefault: data.isDefault,
      },
      ctx.permissions,
      meta
    );
    return jsonResponse(
      {
        data: {
          id: created.id,
          name: created.name,
          visibility: created.visibility,
          stateJson: created.stateJson,
          isDefault: created.isDefault,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          ownerUserId: created.ownerUserId,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
