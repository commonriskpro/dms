import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/auth";
import { getActiveDealershipId } from "@/lib/tenant";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as sessionService from "@/modules/core-platform/service/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/dealerships — List dealerships the current user is a member of, with role and isActive.
 * Supports Bearer (mobile) or cookie. Does not require an active dealership.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const activeId = await getActiveDealershipId(user.userId, request);
    const dealerships = await sessionService.listUserDealerships(user.userId, {
      activeDealershipId: activeId,
    });
    return jsonResponse({ data: { dealerships } });
  } catch (e) {
    return handleApiError(e);
  }
}
