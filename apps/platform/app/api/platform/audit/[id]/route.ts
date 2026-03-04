import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { redact } from "@/lib/redact";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { id } = await ctx.params;
    const r = await prisma.platformAuditLog.findUnique({ where: { id } });
    if (!r) {
      return errorResponse("NOT_FOUND", "Audit entry not found", 404);
    }

    const beforeState = r.beforeState as Record<string, unknown> | null;
    const afterState = r.afterState as Record<string, unknown> | null;
    return jsonResponse({
      id: r.id,
      actorPlatformUserId: r.actorPlatformUserId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      beforeState: beforeState ? redact(structuredClone(beforeState)) : null,
      afterState: afterState ? redact(structuredClone(afterState)) : null,
      reason: r.reason,
      requestId: r.requestId,
      idempotencyKey: r.idempotencyKey,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
