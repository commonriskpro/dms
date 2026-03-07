import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { getPlatformStats } from "@/lib/service/subscriptions";

export const dynamic = "force-dynamic";

const RECENT_APPLICATIONS_LIMIT = 10;
const RECENT_AUDIT_LIMIT = 10;

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const [
      totalDealerships,
      activeDealerships,
      totalApplications,
      appliedApplications,
      totalPlatformUsers,
      recentApplications,
      recentAudit,
      applicationsLast7Days,
      platformStats,
    ] = await Promise.all([
      prisma.platformDealership.count(),
      prisma.platformDealership.count({
        where: { status: { in: ["ACTIVE", "PROVISIONED"] } },
      }),
      prisma.application.count(),
      prisma.application.count({ where: { status: "APPLIED" } }),
      prisma.platformUser.count({ where: { disabledAt: null } }),
      prisma.application.findMany({
        take: RECENT_APPLICATIONS_LIMIT,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          displayName: true,
          legalName: true,
          contactEmail: true,
          createdAt: true,
        },
      }),
      prisma.platformAuditLog.findMany({
        take: RECENT_AUDIT_LIMIT,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          createdAt: true,
        },
      }),
      prisma.application.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      getPlatformStats(),
    ]);

    return jsonResponse({
      kpis: {
        totalDealerships,
        activeDealerships,
        totalApplications,
        appliedApplications,
        totalPlatformUsers,
        applicationsLast7Days,
        activeSubscriptions: platformStats.activeSubscriptions,
        trialSubscriptions: platformStats.trialSubscriptions,
        monthlyRevenueEstimate: platformStats.monthlyRevenueEstimate,
      },
      recentApplications: recentApplications.map((a) => ({
        id: a.id,
        status: a.status,
        displayName: a.displayName,
        legalName: a.legalName,
        contactEmail: a.contactEmail,
        createdAt: a.createdAt.toISOString(),
      })),
      recentAudit: recentAudit.map((e) => ({
        id: e.id,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
