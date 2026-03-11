import { NextRequest } from "next/server";
import { z } from "zod";
import * as documentService from "@/modules/documents/service/documents";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { listDocumentsQuerySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "documents.read");
    const query = listDocumentsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await documentService.listDocuments(ctx.dealershipId, query.entityType, query.entityId, {
      limit: query.limit,
      offset: query.offset,
      filters: query.docType != null ? { docType: query.docType } : undefined,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
