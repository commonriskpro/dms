import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { callDealerRevokeInvite } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"]);

    const { id: platformDealershipId, inviteId } = await ctx.params;
    const mapping = await prisma.dealershipMapping.findUnique({
      where: { platformDealershipId },
    });
    if (!mapping) {
      return jsonResponse(
        { error: { code: "NOT_PROVISIONED", message: "Dealership is not provisioned" } },
        422
      );
    }

    const result = await callDealerRevokeInvite(
      mapping.dealerDealershipId,
      inviteId,
      user.userId
    );

    if (!result.ok) {
      if (result.error.status === 404) {
        return jsonResponse(
          { error: { code: "NOT_FOUND", message: result.error.message } },
          404
        );
      }
      if (result.error.status === 409) {
        return jsonResponse(
          { error: { code: "CONFLICT", message: result.error.message } },
          409
        );
      }
      return jsonResponse(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.status >= 400 ? result.error.status : 502
      );
    }

    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.invite.revoked",
      targetType: "dealership",
      targetId: platformDealershipId,
      afterState: { inviteId },
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
