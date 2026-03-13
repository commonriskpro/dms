import { NextRequest } from "next/server";
import { z } from "zod";
import * as savedFiltersService from "@/modules/customers/service/saved-filters";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  createSavedFilterBodySchema,
} from "../saved-schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const list = await savedFiltersService.listSavedFilters(ctx.dealershipId, ctx.userId);
    return jsonResponse({
      data: list.map((f) => ({
        id: f.id,
        name: f.name,
        visibility: f.visibility,
        definitionJson: f.definitionJson,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        ownerUserId: f.ownerUserId,
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
    const data = createSavedFilterBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await savedFiltersService.createSavedFilter(
      ctx.dealershipId,
      ctx.userId,
      { name: data.name, visibility: data.visibility, definition: data.definition },
      ctx.permissions,
      meta
    );
    return jsonResponse(
      {
        data: {
          id: created.id,
          name: created.name,
          visibility: created.visibility,
          definitionJson: created.definitionJson,
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
