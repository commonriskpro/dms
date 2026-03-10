import { getSessionContextOrNull, handleApiError, jsonResponse } from "@/lib/api/handler";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionContextOrNull(request);
    if (!session) {
      return jsonResponse({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
    }
    return jsonResponse({
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName ?? undefined,
        avatarUrl: session.avatarUrl ?? undefined,
        emailVerified: session.emailVerified ?? true,
      },
      activeDealership: session.activeDealership,
      lifecycleStatus: session.lifecycleStatus ?? undefined,
      lastStatusReason: session.lastStatusReason ?? undefined,
      closedDealership: session.closedDealership ?? undefined,
      permissions: session.permissions,
      pendingApproval: session.pendingApproval,
      isSupportSession: session.isSupportSession ?? false,
      supportSessionPlatformUserId: session.supportSessionPlatformUserId ?? undefined,
      emailVerified: session.emailVerified ?? true,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
