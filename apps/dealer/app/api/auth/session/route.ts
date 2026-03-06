import { getSessionContextOrNull, handleApiError, jsonResponse } from "@/lib/api/handler";

export async function GET() {
  try {
    const session = await getSessionContextOrNull();
    if (!session) {
      return jsonResponse({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
    }
    return jsonResponse({
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName ?? undefined,
        avatarUrl: session.avatarUrl ?? undefined,
      },
      activeDealership: session.activeDealership,
      lifecycleStatus: session.lifecycleStatus ?? undefined,
      lastStatusReason: session.lastStatusReason ?? undefined,
      closedDealership: session.closedDealership ?? undefined,
      permissions: session.permissions,
      platformAdmin: session.platformAdmin,
      pendingApproval: session.pendingApproval,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
