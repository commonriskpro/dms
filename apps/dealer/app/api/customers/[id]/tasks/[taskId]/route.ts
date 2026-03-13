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
import { taskIdParamSchema, updateTaskBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId, taskId } = taskIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request).catch(() => ({}));
    const data = updateTaskBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await taskService.updateTask(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      taskId,
      {
        title: data.title,
        description: data.description,
        dueAt: data.dueAt != null ? (data.dueAt ? new Date(data.dueAt) : null) : undefined,
        completedAt:
          data.completedAt !== undefined
            ? data.completedAt
              ? new Date(data.completedAt)
              : null
            : undefined,
        completedBy: data.completedBy,
      },
      meta
    );
    return jsonResponse({ data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId, taskId } = taskIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await taskService.deleteTask(ctx.dealershipId, ctx.userId, customerId, taskId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
