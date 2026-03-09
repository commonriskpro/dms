import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { createSupportSessionToken } from "@/lib/support-session-token";
import { z } from "zod";

export const dynamic = "force-dynamic";

const startBodySchema = z.object({
  platformDealershipId: z.string().uuid(),
});

/**
 * POST /api/platform/impersonation/start
 * PLATFORM_OWNER only. Creates short-lived support-session token and returns redirect URL.
 * Dealer app consumes token at /support-session?token=...
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }
    const parsed = startBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const { platformDealershipId } = parsed.data;
    const mapping = await prisma.dealershipMapping.findUnique({
      where: { platformDealershipId },
      select: { dealerDealershipId: true },
    });
    if (!mapping) {
      return errorResponse("NOT_FOUND", "Dealership not provisioned or not found", 404);
    }

    const token = await createSupportSessionToken({
      purpose: "support_session",
      dealershipId: mapping.dealerDealershipId,
      platformUserId: user.userId,
    });

    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "impersonation.started",
      targetType: "platform_dealership",
      targetId: platformDealershipId,
      afterState: { targetDealershipId: platformDealershipId, dealerDealershipId: mapping.dealerDealershipId },
    });

    const baseUrl = process.env.DEALER_INTERNAL_API_URL?.replace(/\/$/, "") ?? "";
    const redirectUrl = `${baseUrl}/api/support-session/consume?token=${encodeURIComponent(token)}`;
    return jsonResponse({ redirectUrl });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
