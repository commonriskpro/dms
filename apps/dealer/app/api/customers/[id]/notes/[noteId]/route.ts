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
import { noteIdParamSchema, updateNoteBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId, noteId } = noteIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request).catch(() => ({}));
    const data = updateNoteBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await noteService.updateNote(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      noteId,
      data,
      meta
    );
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId, noteId } = noteIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await noteService.softDeleteNote(ctx.dealershipId, ctx.userId, customerId, noteId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
