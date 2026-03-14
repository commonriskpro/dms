import { NextRequest } from "next/server";
import { getAuthContext, handleApiError, jsonResponse } from "@/lib/api/handler";
import * as sessionService from "@/modules/core-platform/service/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — Current user and active dealership (mobile-friendly).
 * Supports cookie (web) or Authorization: Bearer <supabase_access_token> (mobile).
 * Returns minimal shape: user, dealership, permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    const response = await sessionService.getCurrentUserContextSummary({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      email: ctx.email,
      permissions: ctx.permissions,
    });
    return jsonResponse(response);
  } catch (e) {
    return handleApiError(e);
  }
}
