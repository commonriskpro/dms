import { NextRequest } from "next/server";
import { z } from "zod";
import * as fileService from "@/modules/core-platform/service/file";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { getQueryObject } from "@/lib/api/query";

const querySchema = z.object({
  fileId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "signed_url")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "documents.read");
    const query = querySchema.parse(getQueryObject(request));
    const meta = getRequestMeta(request);
    const result = await fileService.getSignedUrl(
      ctx.dealershipId,
      query.fileId,
      ctx.userId,
      meta
    );
    return jsonResponse({ url: result.url, expiresAt: result.expiresAt });
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing or invalid fileId" } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
