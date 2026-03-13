import { NextRequest } from "next/server";
import { z } from "zod";
import * as opportunityService from "@/modules/crm-pipeline-automation/service/opportunity";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { listOpportunitiesQuerySchema, createOpportunityBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeOpportunity } from "../serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = listOpportunitiesQuerySchema.parse(getQueryObject(request));
    const { data, total } = await opportunityService.listOpportunities(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        pipelineId: query.pipelineId,
        stageId: query.stageId,
        ownerId: query.ownerId,
        status: query.status,
        customerId: query.customerId,
        source: query.source,
        q: query.q,
      },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse(
      listPayload(
        data.map((o) => serializeOpportunity(o)),
        total,
        query.limit,
        query.offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const body = await readSanitizedJson(request);
    const data = createOpportunityBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await opportunityService.createOpportunity(
      ctx.dealershipId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({ data: serializeOpportunity(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
