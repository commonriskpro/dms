import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Billing scaffold: list dealerships with plan and limits (display only). No Stripe or external billing. */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const [items, total] = await Promise.all([
      prisma.platformDealership.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          displayName: true,
          planKey: true,
          limits: true,
          status: true,
        },
      }),
      prisma.platformDealership.count(),
    ]);

    const planKeys = [...new Set(items.map((d) => d.planKey))];

    return jsonResponse({
      data: items.map((d) => ({
        id: d.id,
        displayName: d.displayName,
        planKey: d.planKey,
        limits: d.limits as Record<string, unknown> | null,
        status: d.status,
      })),
      meta: { total, limit, offset },
      planKeys,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
