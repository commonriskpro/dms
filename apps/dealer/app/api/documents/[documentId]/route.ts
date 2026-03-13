import { NextRequest } from "next/server";
import { z } from "zod";
import * as documentService from "@/modules/documents/service/documents";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { documentIdParamSchema } from "../schemas";
import { patchDocumentBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const ctx = await getAuthContext(_request);
    await guardPermission(ctx, "documents.write");
    const { documentId } = documentIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(_request);
    await documentService.deleteDocument(ctx.dealershipId, documentId, ctx.userId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "documents.write");
    const { documentId } = documentIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = patchDocumentBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await documentService.updateDocumentMetadata(
      ctx.dealershipId,
      documentId,
      { title: data.title, docType: data.docType, tags: data.tags },
      ctx.userId,
      meta
    );
    return jsonResponse(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
