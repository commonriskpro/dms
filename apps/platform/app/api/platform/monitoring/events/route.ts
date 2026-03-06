import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { redact } from "@/lib/redact";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  action: z.string().max(200).optional(),
});

/**
 * GET /api/platform/monitoring/events
 * Returns recent platform audit events and optional summaries for ops monitoring.
 * Uses existing PlatformAuditLog only.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      action: searchParams.get("action") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
    }

    const { limit, offset, dateFrom, dateTo, action } = parsed.data;
    const where: {
      createdAt?: { gte?: Date; lte?: Date };
      action?: { contains: string; mode: "insensitive" };
    } = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (action?.trim()) where.action = { contains: action.trim(), mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.platformAuditLog.count({ where }),
    ]);

    const recentAudit = rows.map((r) => {
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
        createdAt: r.createdAt.toISOString(),
      };
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [approvedCount, rejectedCount] = await Promise.all([
      prisma.platformAuditLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          action: { contains: "approve", mode: "insensitive" },
        },
      }),
      prisma.platformAuditLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          action: { contains: "reject", mode: "insensitive" },
        },
      }),
    ]);

    return jsonResponse({
      recentAudit,
      meta: { total, limit, offset },
      summaryLast24h: {
        applicationApproved: approvedCount,
        applicationRejected: rejectedCount,
      },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
