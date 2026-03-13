import { NextRequest } from "next/server";
import { z } from "zod";
import * as roleService from "@/modules/core-platform/service/role";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  parseUuidParam,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

const patchBodySchema = z.object({
  name: z.string().min(1).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.read");
    const { id } = await params;
    const roleId = parseUuidParam(id);
    const role = await roleService.getRole(ctx.dealershipId, roleId);
    return jsonResponse({
      id: role.id,
      dealershipId: role.dealershipId,
      name: role.name,
      isSystem: role.isSystem,
      permissionIds: role.rolePermissions.map((rp) => rp.permission.id),
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        description: rp.permission.description,
        module: rp.permission.module,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.write");
    const { id } = await params;
    const roleId = parseUuidParam(id);
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await roleService.updateRole(
      ctx.dealershipId,
      roleId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({
      id: updated.id,
      dealershipId: updated.dealershipId,
      name: updated.name,
      isSystem: updated.isSystem,
      permissionIds: updated.rolePermissions.map((rp) => rp.permission.id),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.write");
    const { id } = await params;
    const roleId = parseUuidParam(id);
    const meta = getRequestMeta(request);
    await roleService.deleteRole(ctx.dealershipId, roleId, ctx.userId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}
