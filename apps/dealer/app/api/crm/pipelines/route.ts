import { NextRequest } from "next/server";
import { z } from "zod";
import * as pipelineService from "@/modules/crm-pipeline-automation/service/pipeline";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { listPipelinesQuerySchema, createPipelineBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = listPipelinesQuerySchema.parse(getQueryObject(request));
    const { data, total } = await pipelineService.listPipelines(ctx.dealershipId, query);
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
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
    const data = createPipelineBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await pipelineService.createPipeline(
      ctx.dealershipId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({ data: created }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
