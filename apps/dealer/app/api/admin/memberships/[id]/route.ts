import { NextRequest } from "next/server";
import { z } from "zod";
import * as membershipService from "@/modules/core-platform/service/membership";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  parseUuidParam,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

const patchBodySchema = z.object({
  roleId: z.string().uuid().optional(),
  disabled: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"]);
    const { id } = await params;
    const membershipId = parseUuidParam(id);
    const m = await membershipService.getMembership(ctx.dealershipId, membershipId);
    return jsonResponse({
      id: m.id,
      dealershipId: m.dealershipId,
      userId: m.userId,
      roleId: m.roleId,
      user: m.user,
      role: m.role,
      invitedAt: m.invitedAt,
      joinedAt: m.joinedAt,
      disabledAt: m.disabledAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
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
    await guardAnyPermission(ctx, ["admin.users.update", "admin.users.disable", "admin.memberships.write"]);
    const { id } = await params;
    const membershipId = parseUuidParam(id);
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await membershipService.updateMembership(
      ctx.dealershipId,
      membershipId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({
      id: updated.id,
      dealershipId: updated.dealershipId,
      userId: updated.userId,
      roleId: updated.roleId,
      user: updated.user,
      role: updated.role,
      invitedAt: updated.invitedAt,
      joinedAt: updated.joinedAt,
      disabledAt: updated.disabledAt,
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
    await guardAnyPermission(ctx, ["admin.users.disable", "admin.memberships.write"]);
    const { id } = await params;
    const membershipId = parseUuidParam(id);
    const meta = getRequestMeta(request);
    await membershipService.disableMembership(ctx.dealershipId, membershipId, ctx.userId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}
