import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonResponse } from "@/lib/api/handler";

/**
 * GET /api/auth/dealerships — List dealerships the current user is a member of.
 * Use when the user has no active dealership (e.g. on Get Started after platform invite).
 * Does not require an active dealership.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.membership.findMany({
      where: { userId: user.userId, disabledAt: null },
      select: {
        dealershipId: true,
        dealership: { select: { id: true, name: true } },
      },
    });
    const dealerships = memberships.map((m) => ({
      id: m.dealership.id,
      name: m.dealership.name,
    }));
    return jsonResponse({ data: { dealerships } });
  } catch (e) {
    return handleApiError(e);
  }
}
