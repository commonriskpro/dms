import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as publishService from "@/modules/websites-publishing/service";
import { serializeRelease } from "@/modules/websites-publishing/serializer";
import { publishWebsiteBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

/** POST /api/websites/publish — publish a new website release */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    publishWebsiteBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const release = await publishService.publishSite(ctx.dealershipId, ctx.userId, meta);
    return jsonResponse({ data: serializeRelease(release, release.id) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
