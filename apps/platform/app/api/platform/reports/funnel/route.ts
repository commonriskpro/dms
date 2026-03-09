import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Application funnel: counts by status. */
export async function GET(_request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const [applied, underReview, approved, rejected] = await Promise.all([
      prisma.application.count({ where: { status: "APPLIED" } }),
      prisma.application.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.application.count({ where: { status: "APPROVED" } }),
      prisma.application.count({ where: { status: "REJECTED" } }),
    ]);

    return jsonResponse({
      data: [
        { status: "APPLIED", count: applied },
        { status: "UNDER_REVIEW", count: underReview },
        { status: "APPROVED", count: approved },
        { status: "REJECTED", count: rejected },
      ],
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
