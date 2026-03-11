import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import * as userAdminService from "@/modules/core-platform/service/user-admin";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  roleId: z.string().uuid().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

/**
 * GET /api/admin/users — List users (memberships) in dealership with role IDs and permission overrides.
 * Requires admin.users.read or admin.memberships.read.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"]);
    const query = querySchema.parse(getQueryObject(request));
    const { limit, offset } = parsePagination(query);
    const { data, total } = await userAdminService.listUsersWithRolesAndOverrides(
      ctx.dealershipId,
      { limit, offset, roleId: query.roleId, status: query.status }
    );
    return jsonResponse(
      listPayload(
        data.map((m) => ({
          id: m.id,
          userId: m.userId,
          user: m.user,
          roleId: m.roleId,
          role: m.role,
          roleIds: m.roleIds,
          permissionOverrides: m.permissionOverrides,
          invitedAt: m.invitedAt,
          joinedAt: m.joinedAt,
          disabledAt: m.disabledAt,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
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
