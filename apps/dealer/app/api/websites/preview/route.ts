import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as publishService from "@/modules/websites-publishing/service";

export const dynamic = "force-dynamic";

/** POST /api/websites/preview — return preview snapshot without writing a release */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const snapshot = await publishService.previewSnapshot(ctx.dealershipId);
    return jsonResponse({ data: snapshot });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
