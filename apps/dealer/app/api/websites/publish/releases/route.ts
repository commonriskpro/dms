import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";
import { parsePagination } from "@/lib/api/pagination";
import * as publishService from "@/modules/websites-publishing/service";
import { serializeRelease } from "@/modules/websites-publishing/serializer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const query = getQueryObject(request);
    const { limit, offset } = parsePagination(query);
    const { data, total, activeSiteReleaseId } = await publishService.listReleases(
      ctx.dealershipId,
      { limit, offset }
    );
    return jsonResponse(
      listPayload(
        data.map((r) => serializeRelease(r, activeSiteReleaseId)),
        total,
        limit,
        offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
