import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/auth";
import { getActiveDealershipId, setActiveDealershipForUser } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { meCurrentDealershipPostBodySchema } from "@/lib/types/me";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/current-dealership — Current active dealership and membership metadata, or null.
 * Supports Bearer or cookie. Does not require an active dealership (so multi-dealership user can call before selecting).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const activeId = await getActiveDealershipId(user.userId, request);
    if (!activeId) {
      const count = await prisma.membership.count({
        where: { userId: user.userId, disabledAt: null },
      });
      return jsonResponse({
        data: null,
        availableCount: count,
      });
    }
    const [dealership, membership] = await Promise.all([
      prisma.dealership.findUnique({
        where: { id: activeId },
        select: { id: true, name: true },
      }),
      prisma.membership.findFirst({
        where: { userId: user.userId, dealershipId: activeId, disabledAt: null },
        select: { role: { select: { key: true, name: true } } },
      }),
    ]);
    if (!dealership) {
      return jsonResponse({ data: null, availableCount: 0 });
    }
    const availableCount = await prisma.membership.count({
      where: { userId: user.userId, disabledAt: null },
    });
    return jsonResponse({
      data: {
        dealershipId: dealership.id,
        dealershipName: dealership.name,
        roleKey: membership?.role.key ?? null,
        roleName: membership?.role.name ?? "—",
      },
      availableCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/me/current-dealership — Set active dealership (switch). Validates membership, persists, sets cookie, audits.
 * Supports Bearer (mobile) or cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "session_switch")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const user = await requireUserFromRequest(request);
    const body = await readSanitizedJson(request).catch(() => ({}));
    const { dealershipId } = meCurrentDealershipPostBodySchema.parse(body);

    const membership = await prisma.membership.findFirst({
      where: { userId: user.userId, dealershipId, disabledAt: null },
    });
    if (!membership) {
      throw new ApiError("FORBIDDEN", "Not a member of this dealership");
    }
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true, name: true, lifecycleStatus: true, isActive: true },
    });
    if (!dealership || dealership.lifecycleStatus === "CLOSED") {
      throw new ApiError("FORBIDDEN", "Dealership not available");
    }
    if (!dealership.isActive) {
      throw new ApiError("FORBIDDEN", "Dealership not active");
    }

    const previousRow = await prisma.userActiveDealership.findUnique({
      where: { userId: user.userId },
      select: { activeDealershipId: true },
    });
    const previousDealershipId = previousRow?.activeDealershipId ?? null;

    await setActiveDealershipForUser(user.userId, dealershipId);

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId,
      actorUserId: user.userId,
      action: "auth.dealership_switched",
      entity: "UserActiveDealership",
      metadata: {
        previousDealershipId: previousDealershipId ?? undefined,
        newDealershipId: dealershipId,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const role = await prisma.membership.findFirst({
      where: { userId: user.userId, dealershipId, disabledAt: null },
      select: { role: { select: { key: true, name: true } } },
    });

    return jsonResponse({
      data: {
        dealershipId: dealership.id,
        dealershipName: dealership.name,
        roleKey: role?.role.key ?? null,
        roleName: role?.role.name ?? "—",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
