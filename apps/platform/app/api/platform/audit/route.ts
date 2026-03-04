import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { redact } from "@/lib/redact";
import { platformAuditQuerySchema, type PlatformAuditListResponse } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    const parsed = platformAuditQuerySchema.safeParse(query);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
    }

    const { limit, offset, actor, action, targetType, targetId, dateFrom, dateTo } = parsed.data;

    const where: {
      actorPlatformUserId?: string;
      action?: { contains: string; mode: "insensitive" };
      targetType?: string;
      targetId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (actor) where.actorPlatformUserId = actor;
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [rows, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.platformAuditLog.count({ where }),
    ]);

    const data = rows.map((r) => {
      const beforeState = r.beforeState as Record<string, unknown> | null;
      const afterState = r.afterState as Record<string, unknown> | null;
      return {
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
      };
    });

    const response: PlatformAuditListResponse = {
      data,
      meta: { limit, offset, total },
    };
    return jsonResponse(response);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
