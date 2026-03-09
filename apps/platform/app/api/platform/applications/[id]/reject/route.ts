import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { applicationRejectRequestSchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"]);
    const { id } = await ctx.params;
    const body = await request.json();
    const { reason } = applicationRejectRequestSchema.parse(body);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Application not found" } }, 404);
    }
    if (app.status === "REJECTED") {
      return jsonResponse({ id: app.id, status: "REJECTED" as const });
    }
    const beforeState = { status: app.status };
    const updated = await prisma.application.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason, updatedAt: new Date() },
    });
    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "application.rejected",
      targetType: "application",
      targetId: id,
      beforeState,
      afterState: { status: updated.status },
      reason,
    });
    return jsonResponse({ id: updated.id, status: "REJECTED" as const });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
