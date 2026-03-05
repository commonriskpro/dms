import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
  parseUuidParam,
} from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import * as membershipDb from "@/modules/core-platform/db/membership";
import * as userRolesDb from "@/modules/core-platform/db/user-roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[userId] — Get one user (membership) in dealership with roleIds and overrides.
 * Requires admin.users.read or admin.memberships.read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"]);
    const userId = parseUuidParam((await params).userId);
    const membership = await membershipDb.getMembershipByUserId(ctx.dealershipId, userId);
    if (!membership) {
      throw new ApiError("NOT_FOUND", "User not found in this dealership");
    }
    const [roleIds, permissionOverrides] = await Promise.all([
      userRolesDb.listUserRoleIds(userId, ctx.dealershipId),
      userRolesDb.listUserPermissionOverrides(userId),
    ]);
    return jsonResponse({
      ...membership,
      roleIds,
      permissionOverrides,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
