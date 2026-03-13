import { NextRequest } from "next/server";
import { z } from "zod";
import * as taskService from "@/modules/customers/service/task";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { customerIdParamSchema } from "../../schemas";
import { listTasksQuerySchema, createTaskBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const query = listTasksQuerySchema.parse(getQueryObject(request));
    const { data, total } = await taskService.listTasks(ctx.dealershipId, customerId, {
      limit: query.limit,
      offset: query.offset,
      completed: query.completed,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = createTaskBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await taskService.createTask(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      {
        title: data.title,
        description: data.description,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      },
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
