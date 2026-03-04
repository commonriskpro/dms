import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { checkPlatformRateLimit, getPlatformClientIdentifier } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { hashEmail, maskEmail } from "@/lib/hash";
import { callDealerOwnerInviteStatus } from "@/lib/call-dealer-internal";
import {
  getOwnerInviteStatusCached,
  setOwnerInviteStatusCached,
} from "@/lib/onboarding-status-cache";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

const TAIL_LENGTH = 6;

function tail(id: string): string {
  return id.slice(-TAIL_LENGTH);
}

function computeNextAction(
  applicationStatus: string,
  platformDealershipId: string | null,
  mapping: { dealerDealershipId: string; provisionedAt: Date } | null,
  ownerInvite: { status: string } | null
): string {
  if (applicationStatus !== "APPROVED") return "NONE";
  if (!platformDealershipId) return "PROVISION";
  if (!mapping) return "PROVISION";
  if (!ownerInvite || ownerInvite.status === "UNKNOWN") return "INVITE_OWNER";
  if (ownerInvite.status === "PENDING") return "WAIT_FOR_ACCEPT";
  if (ownerInvite.status === "EXPIRED" || ownerInvite.status === "CANCELLED") return "RESEND_INVITE";
  if (ownerInvite.status === "ACCEPTED") return "NONE";
  return "NONE";
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const clientId = getPlatformClientIdentifier(request);
    if (!checkPlatformRateLimit(clientId, "onboarding_status")) {
      return errorResponse("RATE_LIMITED", "Too many requests", 429);
    }

    const paramsResult = paramsSchema.safeParse(await ctx.params);
    if (!paramsResult.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid application id", 422, paramsResult.error.flatten());
    }
    const applicationId = paramsResult.data.id;

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        dealership: {
          include: { mapping: true },
        },
      },
    });

    if (!app) {
      return errorResponse("NOT_FOUND", "Application not found", 404);
    }

    const applicationStatus = app.status;
    const contactEmail = app.contactEmail ?? "";
    const contactEmailHash = contactEmail ? hashEmail(contactEmail) : "";
    const contactEmailMasked = contactEmail ? maskEmail(contactEmail) : undefined;

    const platformDealershipId = app.dealershipId ?? null;
    const platformDealershipStatus = app.dealership?.status ?? null;
    const mappingRow = app.dealership?.mapping ?? null;
    const mapping = mappingRow
      ? {
          dealerDealershipId: mappingRow.dealerDealershipId,
          provisionedAt: mappingRow.provisionedAt.toISOString(),
        }
      : null;

    let ownerInvite: {
      status: string;
      invitedAt?: string;
      expiresAt?: string | null;
      acceptedAt?: string | null;
    } | null = null;

    if (mapping && contactEmail) {
      const cached = getOwnerInviteStatusCached(mappingRow!.dealerDealershipId, contactEmailHash);
      if (cached) {
        ownerInvite = {
          status: cached.status,
          expiresAt: cached.expiresAt,
          acceptedAt: cached.acceptedAt,
          ...(cached.invitedAt && { invitedAt: cached.invitedAt }),
        };
      } else {
        const result = await callDealerOwnerInviteStatus(
          mappingRow!.dealerDealershipId,
          contactEmail
        );
        if (result.ok) {
          ownerInvite = {
            status: result.data.status,
            expiresAt: result.data.expiresAt ?? null,
            acceptedAt: result.data.acceptedAt ?? null,
          };
          setOwnerInviteStatusCached(mappingRow!.dealerDealershipId, contactEmailHash, {
            status: result.data.status,
            expiresAt: result.data.expiresAt ?? null,
            acceptedAt: result.data.acceptedAt ?? null,
          });
        } else {
          ownerInvite = { status: "UNKNOWN" };
        }
      }
    }

    const ownerJoined = ownerInvite?.status === "ACCEPTED";
    const nextAction = computeNextAction(
      applicationStatus,
      platformDealershipId,
      mappingRow ? { dealerDealershipId: mappingRow.dealerDealershipId, provisionedAt: mappingRow.provisionedAt } : null,
      ownerInvite
    );

    const timelineRows = await prisma.platformAuditLog.findMany({
      where: {
        targetType: "application",
        targetId: applicationId,
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        action: true,
        createdAt: true,
        actorPlatformUserId: true,
      },
    });
    const timeline = timelineRows.map((r) => ({
      eventType: r.action,
      createdAt: r.createdAt.toISOString(),
      actorIdTail: r.actorPlatformUserId ? tail(r.actorPlatformUserId) : undefined,
    }));

    const data = {
      applicationId: app.id,
      applicationStatus,
      contactEmailMasked,
      contactEmailHash,
      platformDealershipId,
      platformDealershipStatus,
      mapping,
      ownerInvite,
      ownerJoined,
      nextAction,
      timeline,
    };

    return jsonResponse({ data });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
