import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);
    const { id } = await params;
    const d = await prisma.platformDealership.findUnique({
      where: { id },
      include: { mapping: true },
    });
    if (!d) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Dealership not found" } }, 404);
    }
    return jsonResponse({
      id: d.id,
      legalName: d.legalName,
      displayName: d.displayName,
      planKey: d.planKey,
      limits: d.limits,
      status: d.status,
      dealerDealershipId: d.mapping?.dealerDealershipId ?? undefined,
      provisionedAt: d.mapping?.provisionedAt?.toISOString(),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
