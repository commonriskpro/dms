import { NextRequest } from "next/server";
import { z } from "zod";
import * as jobDb from "@/modules/crm-pipeline-automation/db/job";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { listJobsQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = listJobsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await jobDb.listJobs(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, queueType: query.queueType },
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
