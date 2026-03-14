import { getSessionContextOrNull, handleApiError, jsonResponse } from "@/lib/api/handler";
import { fetchEntitlementsForDealership } from "@/lib/call-platform-internal";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionContextOrNull(request);
    if (!session) {
      return jsonResponse({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
    }
    let entitlements = null;
    if (session.activeDealershipId) {
      try {
        entitlements = await fetchEntitlementsForDealership(session.activeDealershipId);
      } catch {
        entitlements = null;
      }
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
      entitlements,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
