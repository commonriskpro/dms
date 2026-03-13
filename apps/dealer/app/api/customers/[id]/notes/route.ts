import { NextRequest } from "next/server";
import { z } from "zod";
import * as noteService from "@/modules/customers/service/note";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { customerIdParamSchema } from "../../schemas";
import { listNotesQuerySchema, createNoteBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const query = listNotesQuerySchema.parse(getQueryObject(request));
    const { data, total } = await noteService.listNotes(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");

    const rlKey = `customers:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "customers_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }

    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createNoteBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await noteService.createNote(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      { body: data.body },
      meta
    );
    incrementRateLimit(rlKey, "customers_mutation");
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
