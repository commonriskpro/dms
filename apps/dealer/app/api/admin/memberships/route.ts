import { NextRequest } from "next/server";
import { z } from "zod";
import * as membershipService from "@/modules/core-platform/service/membership";
import {
  getAuthContext,
  guardAnyPermission,
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
  roleId: z.string().uuid().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const createBodySchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"]);
    const query = querySchema.parse(getQueryObject(request));
    const { limit, offset } = parsePagination(query);
    const { data, total } = await membershipService.listMemberships(ctx.dealershipId, {
      limit,
      offset,
      roleId: query.roleId,
      status: query.status,
    });
    return jsonResponse(
      listPayload(
        data.map((m) => ({
        id: m.id,
        user: m.user,
        role: m.role,
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.invite", "admin.memberships.write"]);
    const body = await readSanitizedJson(request);
    const data = createBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await membershipService.inviteMember(
      ctx.dealershipId,
      ctx.userId,
      { email: data.email, roleId: data.roleId },
      meta
    );
    return jsonResponse({
      id: created.id,
      dealershipId: created.dealershipId,
      userId: created.userId,
      roleId: created.roleId,
      user: created.user,
      role: created.role,
      invitedAt: created.invitedAt,
      joinedAt: created.joinedAt,
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
