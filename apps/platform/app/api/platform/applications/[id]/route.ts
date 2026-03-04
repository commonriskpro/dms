import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { getOwnerInviteStatusForApplication } from "@/lib/application-onboarding";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);
    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({
      where: { id },
      include: { dealership: { include: { mapping: true } } },
    });
    if (!app) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Application not found" } }, 404);
    }

    let ownerInviteStatus: { status: string; expiresAt?: string | null; acceptedAt?: string | null; lastSentAt?: string | null } | undefined;
    if (app.dealershipId) {
      try {
        const status = await getOwnerInviteStatusForApplication(id);
        if (status) ownerInviteStatus = status;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const name = e instanceof Error ? e.name : "Unknown";
        console.error("[platform-api] getOwnerInviteStatusForApplication failed", {
          applicationId: id,
          errorName: name,
          errorMessage: msg,
        });
        throw e;
      }
    }

    const dealership = app.dealership
      ? {
          id: app.dealership.id,
          displayName: app.dealership.displayName,
          status: app.dealership.status,
          dealerDealershipId: app.dealership.mapping?.dealerDealershipId,
          provisionedAt: app.dealership.mapping?.provisionedAt?.toISOString(),
        }
      : undefined;

    return jsonResponse({
      id: app.id,
      status: app.status,
      legalName: app.legalName,
      displayName: app.displayName,
      contactEmail: app.contactEmail,
      contactPhone: app.contactPhone ?? undefined,
      notes: app.notes ?? undefined,
      reviewNotes: app.reviewNotes ?? undefined,
      rejectionReason: app.rejectionReason ?? undefined,
      dealershipId: app.dealershipId ?? undefined,
      dealership,
      ownerInviteStatus,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
