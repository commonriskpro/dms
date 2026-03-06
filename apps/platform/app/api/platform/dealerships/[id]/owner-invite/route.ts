import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { callDealerOwnerInvite } from "@/lib/call-dealer-internal";
import { hashEmail } from "@/lib/hash";
import { sendOwnerInviteEmail } from "@/lib/email/resend";
import {
  platformOwnerInviteRequestSchema,
  type PlatformOwnerInviteResponse,
} from "@dms/contracts";

export const dynamic = "force-dynamic";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `owner-invite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id: platformDealershipId } = await params;
    if (!platformDealershipId) {
      return errorResponse("VALIDATION_ERROR", "Missing dealership id", 422);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }

    const parsed = platformOwnerInviteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const { email } = parsed.data;
    const recipientHash = hashEmail(email);

    const mapping = await prisma.dealershipMapping.findUnique({
      where: { platformDealershipId },
      include: { platformDealership: { select: { displayName: true, legalName: true } } },
    });
    if (!mapping) {
      return errorResponse(
        "NOT_PROVISIONED",
        "Dealership is not provisioned yet. Provision the dealer tenant first.",
        422
      );
    }

    const dealerDealershipId = mapping.dealerDealershipId;
    const idempotencyKey = `platform-owner-invite-${platformDealershipId}-${email}-${Date.now()}`;

    const result = await callDealerOwnerInvite(
      dealerDealershipId,
      email,
      platformDealershipId,
      user.userId,
      idempotencyKey,
      { requestId }
    );

    if (!result.ok) {
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "dealership.owner_invite.email_failed",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: null,
        afterState: { dealerCallFailed: true, requestId },
      });
      if (result.error.status === 404) {
        return errorResponse("NOT_FOUND", result.error.message, 404);
      }
      if (result.error.status === 409) {
        return errorResponse("CONFLICT", result.error.message, 409);
      }
      return errorResponse(
        result.error.code,
        result.error.message,
        result.error.status >= 400 ? result.error.status : 502
      );
    }

    const acceptUrl = result.data.acceptUrl ?? undefined;
    const dealershipName = mapping.platformDealership?.displayName ?? mapping.platformDealership?.legalName ?? "Dealership";

    if (!acceptUrl) {
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "dealership.owner_invite.email_sent",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: null,
        afterState: { recipientHash, requestId, inviteId: result.data.inviteId, noEmailNoUrl: true },
        requestId,
      });
      const responseNoUrl: PlatformOwnerInviteResponse = {
        ok: true,
        dealerDealershipId,
        inviteId: result.data.inviteId,
        alreadySentRecently: false,
      };
      return jsonResponse(responseNoUrl, 201);
    }

    const fiveMinutesAgo = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recentLog = await prisma.platformEmailLog.findFirst({
      where: {
        platformDealershipId,
        type: "OWNER_INVITE",
        recipientHash,
        sentAt: { gte: fiveMinutesAgo },
      },
      orderBy: { sentAt: "desc" },
    });

    if (recentLog) {
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "dealership.owner_invite.email_skipped_recent",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: null,
        afterState: { recipientHash, requestId },
        requestId,
      });
      const response: PlatformOwnerInviteResponse = {
        ok: true,
        dealerDealershipId,
        inviteId: result.data.inviteId,
        ...(acceptUrl && { acceptUrl }),
        alreadySentRecently: true,
      };
      return jsonResponse(response, 200);
    }

    const sendResult = await sendOwnerInviteEmail({
      toEmail: email,
      dealershipName,
      acceptUrl,
      supportEmail: process.env.PLATFORM_SUPPORT_EMAIL ?? undefined,
    });

    if (sendResult.error) {
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "dealership.owner_invite.email_failed",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: null,
        afterState: { recipientHash, requestId, emailFailed: true },
        requestId,
      });
      return errorResponse(
        "EMAIL_FAILED",
        "Failed to send invite email. Please try again or copy the invite link.",
        502
      );
    }

    await prisma.platformEmailLog.create({
      data: {
        platformDealershipId,
        type: "OWNER_INVITE",
        recipientHash,
        sentAt: new Date(),
        requestId,
      },
    });

    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.owner_invite.email_sent",
      targetType: "dealership",
      targetId: platformDealershipId,
      beforeState: null,
      afterState: { recipientHash, requestId, inviteId: result.data.inviteId },
      requestId,
    });

    const response: PlatformOwnerInviteResponse = {
      ok: true,
      dealerDealershipId,
      inviteId: result.data.inviteId,
      ...(acceptUrl && { acceptUrl }),
      alreadySentRecently: false,
    };
    return jsonResponse(response, 201);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
