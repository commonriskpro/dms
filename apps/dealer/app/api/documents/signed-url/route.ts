import { NextRequest } from "next/server";
import { z } from "zod";
import * as documentService from "@/modules/documents/service/documents";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { signedUrlQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "documents.read");
    const query = signedUrlQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const meta = getRequestMeta(request);
    const result = await documentService.getSignedUrl(
      ctx.dealershipId,
      query.documentId,
      ctx.userId,
      meta
    );
    return jsonResponse({ url: result.url, expiresAt: result.expiresAt });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
