import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/auth";
import { getActiveDealershipId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { handleApiError, jsonResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/dealerships — List dealerships the current user is a member of, with role and isActive.
 * Supports Bearer (mobile) or cookie. Does not require an active dealership.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const activeId = await getActiveDealershipId(user.userId, request);
    const memberships = await prisma.membership.findMany({
      where: { userId: user.userId, disabledAt: null },
      select: {
        dealershipId: true,
        dealership: { select: { id: true, name: true } },
        role: { select: { id: true, key: true, name: true } },
      },
    });
    const dealerships = memberships.map((m) => ({
      dealershipId: m.dealership.id,
      dealershipName: m.dealership.name,
      roleKey: m.role.key ?? null,
      roleName: m.role.name,
      isActive: m.dealershipId === activeId,
    }));
    return jsonResponse({ data: { dealerships } });
  } catch (e) {
    return handleApiError(e);
  }
}
