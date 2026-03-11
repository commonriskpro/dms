import { NextRequest } from "next/server";
import { z } from "zod";
import * as jobDb from "@/modules/crm-pipeline-automation/db/job";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { listJobsQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = listJobsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await jobDb.listJobs(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, queueType: query.queueType },
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
