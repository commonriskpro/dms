import { NextRequest } from "next/server";
import { getClientIdentifier } from "@/lib/api/rate-limit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { ApiError } from "@/lib/auth";
import { z } from "zod";

const paramsSchema = z.object({ token: z.string().min(1) });

export const dynamic = "force-dynamic";

/**
 * GET /api/apply/invite/[token] — Resolve invite token and return application for invite flow.
 * If no application exists for this invite, creates a draft (source=invite) and returns it.
 * Rate limited. Returns 404/410 for invalid or expired invite.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const clientId = getClientIdentifier(_request);
  if (!checkRateLimit(clientId, "apply")) {
    return jsonResponse(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      429
    );
  }
  try {
    const params = paramsSchema.parse(await context.params);
    const invite = await inviteDb.getInviteByToken(params.token);
    if (!invite) throw new ApiError("INVITE_NOT_FOUND", "Invite not found");
    if (invite.status === "ACCEPTED") {
      throw new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used");
    }
    if (invite.status === "EXPIRED" || invite.status === "CANCELLED") {
      throw new ApiError("INVITE_EXPIRED", "This invite has expired or was cancelled");
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new ApiError("INVITE_EXPIRED", "This invite has expired");
    }

    let app = await dealerApplicationService.getApplicationByInviteId(invite.id);
    if (!app) {
      app = await dealerApplicationService.createDraft(
        {
          source: "invite",
          ownerEmail: invite.email,
          inviteId: invite.id,
          invitedByUserId: invite.createdBy ?? undefined,
        },
        undefined
      );
    }

    return jsonResponse({
      applicationId: app.id,
      status: app.status,
      source: app.source,
      ownerEmail: app.ownerEmail,
      inviteId: invite.id,
      submittedAt: app.submittedAt?.toISOString() ?? null,
      profile: app.profile
        ? {
            businessInfo: app.profile.businessInfo,
            ownerInfo: app.profile.ownerInfo,
            primaryContact: app.profile.primaryContact,
            additionalLocations: app.profile.additionalLocations,
            pricingPackageInterest: app.profile.pricingPackageInterest,
            acknowledgments: app.profile.acknowledgments,
          }
        : null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
