import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Tenant usage overview: dealerships with plan and status. */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const [items, total] = await Promise.all([
      prisma.platformDealership.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          displayName: true,
          legalName: true,
          planKey: true,
          limits: true,
          status: true,
          createdAt: true,
          mapping: { select: { provisionedAt: true } },
        },
      }),
      prisma.platformDealership.count(),
    ]);

    return jsonResponse({
      data: items.map((d) => ({
        id: d.id,
        displayName: d.displayName,
        legalName: d.legalName,
        planKey: d.planKey,
        limits: d.limits,
        status: d.status,
        provisionedAt: d.mapping?.provisionedAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
