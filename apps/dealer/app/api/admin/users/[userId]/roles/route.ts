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
  roleIds: z.array(z.string().uuid()).min(0).max(50),
});

/**
 * PATCH /api/admin/users/[userId]/roles — Assign roles to a user (same dealership).
 * Requires admin.roles.assign.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.roles.assign");
    const userId = parseUuidParam((await params).userId);
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await userAdminService.assignRoles(
      ctx.dealershipId,
      userId,
      data.roleIds,
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
