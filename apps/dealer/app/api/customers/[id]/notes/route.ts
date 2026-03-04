import { NextRequest } from "next/server";
import { z } from "zod";
import * as noteService from "@/modules/customers/service/note";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { customerIdParamSchema } from "../../schemas";
import { listNotesQuerySchema, createNoteBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const query = listNotesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await noteService.listNotes(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse({
      data,
      meta: { total, limit: query.limit, offset: query.offset },
    });
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
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await request.json();
    const data = createNoteBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await noteService.createNote(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      { body: data.body },
      meta
    );
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
