import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { platformSetDealershipStatusRequestSchema } from "@dms/contracts";
import { callDealerStatus } from "@/lib/call-dealer-internal";

/**
 * Lifecycle model: Option B — All-or-nothing. Platform status is updated only after dealer
 * status call succeeds. On dealer failure we write platform audit (attempt + dealerCallFailed),
 * return 502 with a safe message, and do not change platform status.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id } = await params;
    const body = await request.json();
    const parsed = platformSetDealershipStatusRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten());
    }
    const { status, reason } = parsed.data;

    const d = await prisma.platformDealership.findUnique({
      where: { id },
      include: { mapping: true },
    });
    if (!d) {
      return errorResponse("NOT_FOUND", "Dealership not found", 404);
    }

    const beforeState = { status: d.status };
    const requestId = `status-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (d.mapping?.dealerDealershipId) {
      const dealerResult = await callDealerStatus(
        d.mapping.dealerDealershipId,
        status,
        { reason, platformActorId: user.userId }
      );
      if (!dealerResult.ok) {
        const details: { requestId: string; upstreamStatus?: number } = { requestId };
        if (typeof dealerResult.status === "number") details.upstreamStatus = dealerResult.status;
        await platformAuditLog({
          actorPlatformUserId: user.userId,
          action: "dealership.status",
          targetType: "dealership",
          targetId: id,
          beforeState,
          afterState: { status: d.status, dealerCallFailed: true },
          reason: reason ?? undefined,
          requestId,
        });
        return errorResponse(
          "DEALER_STATUS_FAILED",
          "Dealer status update failed. Platform status unchanged.",
          502,
          details
        );
      }
    }

    await prisma.platformDealership.update({
      where: { id },
      data: { status },
    });

    const afterState = { status };
    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.status",
      targetType: "dealership",
      targetId: id,
      beforeState,
      afterState,
      reason: reason ?? undefined,
      requestId,
    });

    return jsonResponse({ ok: true, requestId });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
