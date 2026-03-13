import { NextRequest } from "next/server";
import { z } from "zod";
import * as roleService from "@/modules/core-platform/service/role";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeSystem: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const createBodySchema = z.object({
  name: z.string().min(1),
  permissionIds: z.array(z.string().uuid()),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.read");
    const query = querySchema.parse(getQueryObject(request));
    const { limit, offset } = parsePagination(query);
    const { data, total } = await roleService.listRoles(ctx.dealershipId, {
      limit,
      offset,
      includeSystem: query.includeSystem,
    });
    return jsonResponse(
      listPayload(
        data.map((r) => ({
        id: r.id,
        dealershipId: r.dealershipId,
        name: r.name,
        isSystem: r.isSystem,
        permissionIds: r.rolePermissions.map((rp) => rp.permission.id),
        permissions: r.rolePermissions.map((rp) => ({ id: rp.permission.id, key: rp.permission.key })),
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.write");
    const body = await readSanitizedJson(request);
    const data = createBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await roleService.createRole(
      ctx.dealershipId,
      ctx.userId,
      { name: data.name, permissionIds: data.permissionIds },
      meta
    );
    return jsonResponse({
      id: created.id,
      dealershipId: created.dealershipId,
      name: created.name,
      isSystem: created.isSystem,
      permissionIds: created.rolePermissions.map((rp) => rp.permission.id),
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
