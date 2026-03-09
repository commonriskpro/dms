import { NextRequest } from "next/server";
import { getAuthContext, handleApiError, jsonResponse } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — Current user and active dealership (mobile-friendly).
 * Supports cookie (web) or Authorization: Bearer <supabase_access_token> (mobile).
 * Returns minimal shape: user, dealership, permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    const dealership = await prisma.dealership.findUnique({
      where: { id: ctx.dealershipId },
      select: { id: true, name: true },
    });
    return jsonResponse({
      user: { id: ctx.userId, email: ctx.email },
      dealership: dealership ? { id: dealership.id, name: dealership.name } : { id: ctx.dealershipId, name: undefined },
      permissions: ctx.permissions,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
