import { NextRequest } from "next/server";
import { z } from "zod";
import * as auditService from "@/modules/core-platform/service/audit";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  entity: z.string().optional(),
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.audit.read");
    const query = querySchema.parse(getQueryObject(request));
    const { limit, offset } = parsePagination(query);
    const filters = {
      entity: query.entity,
      entityId: query.entityId,
      actorId: query.actorId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
    const { data, total } = await auditService.listAuditLogs(
      ctx.dealershipId,
      limit,
      offset,
      filters
    );
    return jsonResponse(
      listPayload(
        data.map((a) => ({
        id: a.id,
        dealershipId: a.dealershipId,
        actorId: a.actorId,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        metadata: a.metadata,
        ip: a.ip,
        userAgent: a.userAgent,
        createdAt: a.createdAt,
        })),
        total,
        limit,
        offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
