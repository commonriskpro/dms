import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse, parseUuidParam } from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as platformInviteService from "@/modules/platform-admin/service/invite";
import {
  listInvitesQuerySchema,
  createInviteBodySchema,
} from "@/app/api/platform/schemas";
import { getRequestMeta } from "@/lib/api/handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const dealershipId = parseUuidParam((await params).id);
    const dealership = await import("@/modules/core-platform/db/dealership").then(
      (m) => m.getDealershipById(dealershipId)
    );
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");

    const { searchParams } = new URL(request.url);
    const { limit, offset, status } = listInvitesQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const { data, total } = await inviteDb.listInvitesByDealership(
      dealershipId,
      { status },
      { limit, offset }
    );

    return jsonResponse({
      data: data.map((i) => ({
        id: i.id,
        dealershipId: i.dealershipId,
        email: i.email,
        roleId: i.roleId,
        roleName: i.role.name,
        status: i.status,
        expiresAt: i.expiresAt ?? undefined,
        createdAt: i.createdAt,
        acceptedAt: i.acceptedAt ?? undefined,
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "invite_create")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const dealershipId = parseUuidParam((await params).id);
    const dealership = await import("@/modules/core-platform/db/dealership").then(
      (m) => m.getDealershipById(dealershipId)
    );
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");

    const body = await request.json();
    const { email, roleId, expiresAt } = createInviteBodySchema.parse(body);
    const meta = getRequestMeta(request);

    const result = await platformInviteService.createInvite(
      {
        dealershipId,
        email,
        roleId,
        expiresAt: expiresAt ?? null,
        actorUserId: user.userId,
      },
      meta
    );

    const invite = result.invite;
    if (!invite) throw new ApiError("INTERNAL", "Invite data missing");
    const serialized = {
      id: invite.id,
      dealershipId: invite.dealershipId,
      email: invite.email,
      roleId: invite.roleId,
      roleName: invite.role.name,
      status: invite.status,
      expiresAt: invite.expiresAt ?? undefined,
      createdAt: invite.createdAt,
      acceptedAt: "acceptedAt" in invite ? invite.acceptedAt ?? undefined : undefined,
    };

    if (result.created) {
      return jsonResponse({ data: serialized }, 201);
    }
    return jsonResponse({ data: serialized }, 200);
  } catch (e) {
    return handleApiError(e);
  }
}
