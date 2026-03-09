import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  getRequestMeta,
  handleApiError,
  jsonResponse,
  parseUuidParam,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import * as platformInviteService from "@/modules/platform-admin/service/invite";
import { patchInviteBodySchema } from "@/app/api/platform/schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const { id: dealershipId, inviteId } = await params;
    const pathDealershipId = parseUuidParam(dealershipId);
    const pathInviteId = parseUuidParam(inviteId);
    const body = await request.json();
    const data = patchInviteBodySchema.parse(body);
    const meta = getRequestMeta(request);

    if (data.cancel === true) {
      await platformInviteService.cancelInvite(
        pathDealershipId,
        pathInviteId,
        user.userId,
        meta
      );
      return new Response(null, { status: 204 });
    }

    if (data.expiresAt !== undefined) {
      const clientId = getClientIdentifier(request);
      if (!checkRateLimit(clientId, "invite_resend")) {
        return Response.json(
          { error: { code: "RATE_LIMITED", message: "Too many requests" } },
          { status: 429 }
        );
      }
      const updated = await platformInviteService.resendInvite(
        pathDealershipId,
        pathInviteId,
        user.userId,
        { expiresAt: data.expiresAt },
        meta
      );
      return jsonResponse({
        data: {
          id: updated.id,
          dealershipId: updated.dealershipId,
          email: updated.email,
          roleId: updated.roleId,
          status: updated.status,
          expiresAt: updated.expiresAt ?? undefined,
          createdAt: updated.createdAt,
          acceptedAt: updated.acceptedAt ?? undefined,
        },
      });
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}
