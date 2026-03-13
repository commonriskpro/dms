import { NextRequest } from "next/server";
import { z } from "zod";
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
import * as userAdminService from "@/modules/core-platform/service/user-admin";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  permissionKey: z.string().min(1).max(128),
  enabled: z.boolean(),
});

/**
 * PATCH /api/admin/users/[userId]/permission-overrides — Set a single permission override.
 * Requires admin.permissions.manage.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.permissions.manage");
    const userId = parseUuidParam((await params).userId);
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await userAdminService.setPermissionOverride(
      ctx.dealershipId,
      userId,
      data.permissionKey,
      data.enabled,
      ctx.userId,
      meta
    );
    return jsonResponse(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
