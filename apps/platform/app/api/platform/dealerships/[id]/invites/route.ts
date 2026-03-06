import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { callDealerListInvites } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { id: platformDealershipId } = await ctx.params;
    const mapping = await prisma.dealershipMapping.findUnique({
      where: { platformDealershipId },
    });
    if (!mapping) {
      return jsonResponse(
        { error: { code: "NOT_PROVISIONED", message: "Dealership is not provisioned" } },
        422
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const status = searchParams.get("status") ?? undefined;

    const result = await callDealerListInvites(
      mapping.dealerDealershipId,
      { limit, offset, status: status || undefined }
    );

    if (!result.ok) {
      return jsonResponse(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.status >= 400 ? result.error.status : 502
      );
    }

    return jsonResponse({
      data: result.data.data,
      meta: result.data.meta,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
